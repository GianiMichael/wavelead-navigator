import { ISO_REGIONS, type IsoRegion } from "@/data/iso-regions";

/**
 * GridStatus.io wholesale price fetchers.
 *
 * Free tier budget: 250 requests + 500k rows per month. We pull exactly one
 * row per ISO (6 requests) on a once-daily schedule → ~186 requests/month.
 * Visitors NEVER hit GridStatus; they read the cached rows in the database.
 */

const BASE = "https://api.gridstatus.io/v1/datasets";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export interface IsoPriceRow {
  iso: string;
  iso_name: string;
  hub: string;
  price_mwh: number | null;
  market: string;
  interval_start: string | null;
  fetched_at: string;
  error: string | null;
}

async function fetchIsoPrice(region: IsoRegion, apiKey: string): Promise<IsoPriceRow> {
  const base: IsoPriceRow = {
    iso: region.code,
    iso_name: region.name,
    hub: region.hubLabel,
    price_mwh: null,
    market: "Day-ahead hourly avg (24h)",
    interval_start: null,
    fetched_at: new Date().toISOString(),
    error: null,
  };

  // Day-ahead hourly is the representative price for a once-daily snapshot:
  // real-time 5-min LMPs spike on transient congestion and misrepresent a region.
  const start = new Date(Date.now() - 30 * 60 * 60 * 1000).toISOString();
  const params = new URLSearchParams();
  params.set("api_key", apiKey);
  params.set("start_time", start);
  params.set("filter_column", "location");
  params.set("filter_value", region.hub);
  params.set("limit", "100");

  try {
    const res = await fetch(`${BASE}/${region.dataset}/query?${params.toString()}`, {
      headers: { "Accept-Encoding": "gzip" },
    });
    if (!res.ok) throw new Error(`GridStatus responded ${res.status}`);
    const json = (await res.json()) as { data?: Record<string, unknown>[] };
    const all = json.data ?? [];
    if (!all.length) throw new Error("No rows returned for hub.");

    // Keep the most recent 24 hourly intervals.
    const sorted = [...all].sort((a, b) =>
      String(a["interval_start_utc"] ?? "").localeCompare(String(b["interval_start_utc"] ?? "")),
    );
    const window = sorted.slice(-24);

    const prices = window
      .map((row) => {
        const raw = row[region.priceColumn] ?? row["lmp"] ?? row["spp"];
        return typeof raw === "string" ? Number.parseFloat(raw) : Number(raw);
      })
      .filter((n) => Number.isFinite(n));
    if (!prices.length) throw new Error("No price values in response.");

    const avg = prices.reduce((a, b) => a + b, 0) / prices.length;
    const first = window[0]?.["interval_start_utc"];
    return {
      ...base,
      price_mwh: Math.round(avg * 100) / 100,
      interval_start: typeof first === "string" ? new Date(first).toISOString() : null,
    };
  } catch (e) {
    return { ...base, error: e instanceof Error ? e.message : "GridStatus request failed." };
  }
}


/** Fetch all ISO hubs and upsert them into the shared cache table. */
export async function refreshIsoPrices() {
  const apiKey = process.env["GRIDSTATUS_API_KEY"];
  if (!apiKey) return { ok: false as const, error: "GRIDSTATUS_API_KEY is not configured." };

  // Free tier throttles concurrent requests (429), so fetch serially with a
  // short gap and one retry per region.
  const rows: IsoPriceRow[] = [];
  for (const region of ISO_REGIONS) {
    let row = await fetchIsoPrice(region, apiKey);
    if (row.error?.includes("429")) {
      await sleep(4000);
      row = await fetchIsoPrice(region, apiKey);
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
