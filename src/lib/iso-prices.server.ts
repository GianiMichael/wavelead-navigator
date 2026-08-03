import { ISO_REGIONS, type IsoRegion } from "@/data/iso-regions";

/**
 * GridStatus.io wholesale price fetchers.
 *
 * Free tier budget: 250 requests + 500k rows per month. We pull exactly one
 * row per ISO (6 requests) on a once-daily schedule → ~186 requests/month.
 * Visitors NEVER hit GridStatus; they read the cached rows in the database.
 */

const BASE = "https://api.gridstatus.io/v1/datasets";

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
    market: region.dataset.includes("15_min") ? "Real-time 15-min" : "Real-time 5-min",
    interval_start: null,
    fetched_at: new Date().toISOString(),
    error: null,
  };

  const params = new URLSearchParams();
  params.set("api_key", apiKey);
  params.set("time", "latest");
  params.set("filter_column", "location");
  params.set("filter_value", region.hub);
  params.set("limit", "1");

  try {
    const res = await fetch(`${BASE}/${region.dataset}/query?${params.toString()}`, {
      headers: { "Accept-Encoding": "gzip" },
    });
    if (!res.ok) throw new Error(`GridStatus responded ${res.status}`);
    const json = (await res.json()) as { data?: Record<string, unknown>[] };
    const row = json.data?.[0];
    if (!row) throw new Error("No rows returned for hub.");

    const raw = row[region.priceColumn] ?? row["lmp"] ?? row["spp"];
    const price = typeof raw === "string" ? Number.parseFloat(raw) : Number(raw);
    if (!Number.isFinite(price)) throw new Error("No price value in response.");

    const start = row["interval_start_utc"] ?? row["interval_start_local"] ?? row["time"];
    return {
      ...base,
      price_mwh: price,
      interval_start: typeof start === "string" ? new Date(start).toISOString() : null,
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
