import { ISO_REGIONS, type IsoRegion } from "@/data/iso-regions";

/**
 * GridStatus.io wholesale market fetchers.
 *
 * Free tier budget: 250 requests + 500k rows per month. Each refresh pulls
 * 3 series per ISO (day-ahead price, real-time price, regional load) = 18
 * requests, so the schedule runs every 3rd day (~11 refreshes ≈ 198
 * requests/month). Visitors NEVER hit GridStatus; they read the cached rows.
 */

const BASE = "https://api.gridstatus.io/v1/datasets";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export interface IsoPriceRow {
  iso: string;
  iso_name: string;
  hub: string;
  price_mwh: number | null;
  rt_price_mwh: number | null;
  spread_pct: number | null;
  load_mw: number | null;
  load_at: string | null;
  market: string;
  interval_start: string | null;
  fetched_at: string;
  error: string | null;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

async function gridStatus(
  dataset: string,
  apiKey: string,
  extra: Record<string, string>,
): Promise<Record<string, unknown>[]> {
  const params = new URLSearchParams({ api_key: apiKey, ...extra });
  const res = await fetch(`${BASE}/${dataset}/query?${params.toString()}`, {
    headers: { "Accept-Encoding": "gzip" },
  });
  if (!res.ok) throw new Error(`GridStatus responded ${res.status}`);
  const json = (await res.json()) as { data?: Record<string, unknown>[] };
  return json.data ?? [];
}

function numeric(row: Record<string, unknown>, column: string): number {
  const raw = row[column] ?? row["lmp"] ?? row["spp"];
  return typeof raw === "string" ? Number.parseFloat(raw) : Number(raw);
}

/** Average the most recent `hours` worth of intervals for a hub. */
function averagePrice(
  rows: Record<string, unknown>[],
  region: IsoRegion,
  keep: number,
): { avg: number; start: string | null } | null {
  const sorted = [...rows].sort((a, b) =>
    String(a["interval_start_utc"] ?? "").localeCompare(String(b["interval_start_utc"] ?? "")),
  );
  const window = sorted.slice(-keep);
  const prices = window.map((r) => numeric(r, region.priceColumn)).filter((n) => Number.isFinite(n));
  if (!prices.length) return null;
  const first = window[0]?.["interval_start_utc"];
  return {
    avg: prices.reduce((a, b) => a + b, 0) / prices.length,
    start: typeof first === "string" ? new Date(first).toISOString() : null,
  };
}

async function fetchIsoRow(region: IsoRegion, apiKey: string): Promise<IsoPriceRow> {
  const base: IsoPriceRow = {
    iso: region.code,
    iso_name: region.name,
    hub: region.hubLabel,
    price_mwh: null,
    rt_price_mwh: null,
    spread_pct: null,
    load_mw: null,
    load_at: null,
    market: "Day-ahead hourly avg (24h)",
    interval_start: null,
    fetched_at: new Date().toISOString(),
    error: null,
  };

  // Day-ahead hourly is the representative price for a cached snapshot:
  // real-time LMPs spike on transient congestion and misrepresent a region.
  const start = new Date(Date.now() - 30 * 60 * 60 * 1000).toISOString();
  const hubFilter = {
    start_time: start,
    filter_column: "location",
    filter_value: region.hub,
  };

  let row = base;
  try {
    const da = averagePrice(
      await gridStatus(region.dataset, apiKey, { ...hubFilter, limit: "100" }),
      region,
      24,
    );
    if (!da) throw new Error("No day-ahead rows returned for hub.");
    row = { ...row, price_mwh: round2(da.avg), interval_start: da.start };
  } catch (e) {
    return { ...row, error: e instanceof Error ? e.message : "GridStatus request failed." };
  }

  // Real-time average over the same window → volatility spread. Optional:
  // a failure here must not discard the good day-ahead price.
  await sleep(1500);
  try {
    const rtRows = await gridStatus(region.rtDataset, apiKey, { ...hubFilter, limit: "400" });
    const perHour = region.rtDataset.includes("15_min") ? 4 : 12;
    const rt = averagePrice(rtRows, region, 24 * perHour);
    if (rt && row.price_mwh) {
      row = {
        ...row,
        rt_price_mwh: round2(rt.avg),
        spread_pct: round2(((rt.avg - row.price_mwh) / Math.abs(row.price_mwh)) * 100),
      };
    }
  } catch {
    /* spread is supplementary */
  }

  await sleep(1500);
  try {
    const loadRows = await gridStatus(region.loadDataset, apiKey, {
      time: "latest",
      limit: "1",
    });
    const first = loadRows[0];
    const load = first ? Number(first["load"]) : Number.NaN;
    if (Number.isFinite(load)) {
      const at = first?.["interval_start_utc"];
      row = {
        ...row,
        load_mw: Math.round(load),
        load_at: typeof at === "string" ? new Date(at).toISOString() : null,
      };
    }
  } catch {
    /* load is supplementary */
  }

  return row;
}

/** Fetch all ISO series and upsert them into the shared cache table. */
export async function refreshIsoPrices() {
  const apiKey = process.env["GRIDSTATUS_API_KEY"];
  if (!apiKey) return { ok: false as const, error: "GRIDSTATUS_API_KEY is not configured." };

  // Free tier throttles concurrent requests (429), so fetch serially with a
  // short gap and one retry per region.
  const rows: IsoPriceRow[] = [];
  for (const region of ISO_REGIONS) {
    let row = await fetchIsoRow(region, apiKey);
    if (row.error?.includes("429")) {
      await sleep(4000);
      row = await fetchIsoRow(region, apiKey);
    }
    rows.push(row);
    await sleep(1500);
  }

  // Only overwrite a cached price when the fetch succeeded — a transient
  // failure must not blank out the last good reading.
  const good = rows.filter((r) => r.price_mwh !== null);

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  if (good.length) {
    const { error } = await supabaseAdmin.from("iso_wholesale_prices").upsert(good, {
      onConflict: "iso",
    });
    if (error) return { ok: false as const, error: error.message };
  }

  return {
    ok: true as const,
    updated: good.map((r) => r.iso),
    failed: rows.filter((r) => r.price_mwh === null).map((r) => ({ iso: r.iso, error: r.error })),
  };
}
