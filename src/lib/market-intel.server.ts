import { STEO_REGIONS } from "@/data/steo-regions";
import { MARKETS } from "@/data/deregulated-markets";
import { CBP_VINTAGE, NAICS_MAP, STATE_FIPS, naicsForIndustry } from "@/data/naics-map";

/**
 * EIA + Census fetchers with an in-memory TTL cache. Both datasets refresh
 * monthly/annually, so there is no reason to re-hit the APIs per page load.
 */

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

interface CacheEntry<T> {
  value: T;
  expires: number;
}
const cache = new Map<string, CacheEntry<unknown>>();

async function cached<T extends { error?: string }>(
  key: string,
  ttlMs: number,
  fn: () => Promise<T>,
): Promise<T> {
  const hit = cache.get(key);
  if (hit && hit.expires > Date.now()) return hit.value as T;
  const value = await fn();
  // Never cache a failed fetch — otherwise a transient/API-key error sticks for days.
  if (!value.error) cache.set(key, { value, expires: Date.now() + ttlMs });
  return value;
}


/** States we care about: fully or partially deregulated. */
export function targetStates() {
  return MARKETS.filter((m) => m.status === "deregulated" || m.status === "partial");
}

// ── EIA retail rates ──────────────────────────────────────────────────

export interface StateRate {
  state: string;
  stateName: string;
  marketStatus: "deregulated" | "partial";
  /** cents per kWh */
  rateCents: number;
  /** YYYY-MM of the observation */
  period: string;
  /** Fractional change vs. ~3 months earlier (0.08 = +8%). */
  trendPct?: number;
  /** Recent monthly history, oldest first. */
  history: { period: string; rateCents: number }[];
}

export interface RetailRateResult {
  rates: StateRate[];
  /** Latest data month present across all states. */
  dataMonth: string;
  fetchedAt: string;
  error?: string;
}

export async function fetchCommercialRates(): Promise<RetailRateResult> {
  return cached("eia:retail-rates", DAY, async () => {
    const apiKey = process.env["EIA_API_KEY"];
    const states = targetStates();
    if (!apiKey) {
      return {
        rates: [],
        dataMonth: "",
        fetchedAt: new Date().toISOString(),
        error: "EIA API key is not configured.",
      } satisfies RetailRateResult;
    }

    const params = new URLSearchParams();
    params.set("api_key", apiKey);
    params.set("frequency", "monthly");
    params.append("data[0]", "price");
    params.append("facets[sectorid][]", "COM");
    for (const s of states) params.append("facets[stateid][]", s.code);
    params.append("sort[0][column]", "period");
    params.append("sort[0][direction]", "desc");
    params.set("length", String(states.length * 14));

    try {
      const res = await fetch(
        `https://api.eia.gov/v2/electricity/retail-sales/data/?${params.toString()}`,
      );
      if (!res.ok) throw new Error(`EIA responded ${res.status}`);
      const json = (await res.json()) as {
        response?: { data?: { period: string; stateid: string; price: string | number }[] };
      };
      const rows = json.response?.data ?? [];

      const byState = new Map<string, { period: string; rateCents: number }[]>();
      for (const r of rows) {
        const price = typeof r.price === "string" ? Number.parseFloat(r.price) : r.price;
        if (!Number.isFinite(price)) continue;
        const list = byState.get(r.stateid) ?? [];
        list.push({ period: r.period, rateCents: price });
        byState.set(r.stateid, list);
      }

      const rates: StateRate[] = [];
      for (const s of states) {
        const list = (byState.get(s.code) ?? []).sort((a, b) => a.period.localeCompare(b.period));
        const latest = list[list.length - 1];
        if (!latest) continue;
        const prior = list[Math.max(0, list.length - 4)];
        const trendPct =
          prior && prior !== latest && prior.rateCents > 0
            ? (latest.rateCents - prior.rateCents) / prior.rateCents
            : undefined;
        rates.push({
          state: s.code,
          stateName: s.name,
          marketStatus: s.status === "partial" ? "partial" : "deregulated",
          rateCents: latest.rateCents,
          period: latest.period,
          trendPct,
          history: list.slice(-12),
        });
      }

      const dataMonth = rates.reduce((m, r) => (r.period > m ? r.period : m), "");
      return { rates, dataMonth, fetchedAt: new Date().toISOString() } satisfies RetailRateResult;
    } catch (e) {
      return {
        rates: [],
        dataMonth: "",
        fetchedAt: new Date().toISOString(),
        error: e instanceof Error ? e.message : "EIA request failed.",
      } satisfies RetailRateResult;
    }
  });
}

// ── Census County Business Patterns ───────────────────────────────────

export interface DensityRow {
  industryKey: string;
  state: string;
  establishments: number;
  employees?: number;
}

export interface DensityResult {
  rows: DensityRow[];
  vintage: string;
  fetchedAt: string;
  error?: string;
}

async function fetchIndustryDensity(industryKey: string, apiKey: string): Promise<DensityRow[]> {
  const naics = naicsForIndustry(industryKey);
  if (!naics) return [];
  // The CBP 2023 vintage still exposes the NAICS2017 predicate variable.
  const url =
    `https://api.census.gov/data/${CBP_VINTAGE.year}/cbp?get=ESTAB,EMP&for=state:*` +
    `&${CBP_VINTAGE.naicsVariable}=${encodeURIComponent(naics.naics)}&key=${apiKey}`;

  const res = await fetch(url);
  const text = await res.text();
  if (!res.ok || !text.trim().startsWith("[")) {
    throw new Error(`Census ${res.status}: ${text.trim().slice(0, 200) || "empty response"}`);
  }

  const table = JSON.parse(text) as string[][];
  const [header, ...body] = table;
  if (!header) return [];
  const iEstab = header.indexOf("ESTAB");
  const iEmp = header.indexOf("EMP");
  const iState = header.indexOf("state");

  const fipsToCode = new Map(Object.entries(STATE_FIPS).map(([c, f]) => [f, c]));
  const rows: DensityRow[] = [];
  for (const r of body) {
    const code = fipsToCode.get(r[iState] ?? "");
    if (!code) continue;
    const estab = Number.parseInt(r[iEstab] ?? "", 10);
    if (!Number.isFinite(estab)) continue;
    const emp = Number.parseInt(r[iEmp] ?? "", 10);
    rows.push({
      industryKey,
      state: code,
      establishments: estab,
      ...(Number.isFinite(emp) ? { employees: emp } : {}),
    });
  }
  return rows;
}

export async function fetchEstablishmentDensity(): Promise<DensityResult> {
  return cached("census:cbp-density", 7 * DAY, async () => {
    const apiKey = process.env["CENSUS_API_KEY"];
    if (!apiKey) {
      return {
        rows: [],
        vintage: CBP_VINTAGE.dataLabel,
        fetchedAt: new Date().toISOString(),
        error: "Census API key is not configured.",
      } satisfies DensityResult;
    }

    const results = await Promise.allSettled(
      NAICS_MAP.map((n) => fetchIndustryDensity(n.key, apiKey)),
    );
    const rows = results.flatMap((r) => (r.status === "fulfilled" ? r.value : []));
    const firstError = results.find((r) => r.status === "rejected") as
      | PromiseRejectedResult
      | undefined;

    return {
      rows,
      vintage: CBP_VINTAGE.dataLabel,
      fetchedAt: new Date().toISOString(),
      ...(rows.length === 0 && firstError
        ? {
            error:
              firstError.reason instanceof Error
                ? firstError.reason.message
                : "Census request failed.",
          }
        : {}),
    } satisfies DensityResult;
  });
}

// ── EIA-930 Hourly Electric Grid Monitor ──────────────────────────────

export interface GridDemandPoint {
  /** Period key: "YYYY-MM-DDTHH" (hourly), "YYYY-MM-DD" (daily), "YYYY-MM" (monthly). */
  period: string;
  /** Average demand (power) over the period, in megawatts. EIA-930 type "D". */
  mw: number;
}

export const GRID_RANGES = ["24H", "48H", "1W", "1M", "1Y"] as const;
export type GridRange = (typeof GRID_RANGES)[number];
export type GridGranularity = "hour" | "day" | "month";

export function isGridRange(v: unknown): v is GridRange {
  return typeof v === "string" && (GRID_RANGES as readonly string[]).includes(v);
}

export interface GridDemandResult {
  /** Most recent reading at the selected granularity. */
  latest?: GridDemandPoint;
  /** Series for the requested window, oldest first. */
  history: GridDemandPoint[];
  range: GridRange;
  granularity: GridGranularity;
  region: string;
  regionName: string;
  fetchedAt: string;
  error?: string;
}

/**
 * EIA-930 coverage (checked against the v2 API at build time):
 *  - hourly  region-data:       2019-01-01 → now
 *  - daily   daily-region-data: 2019-01-01 → yesterday (MWh summed per day)
 * There is no monthly RTO endpoint, so the 1Y window pulls ~366 daily rows and
 * averages them into calendar months — plotting 8,760 hourly points would be
 * unreadable noise.
 */
const RANGE_SPEC: Record<
  GridRange,
  { frequency: "hourly" | "daily"; length: number; granularity: GridGranularity }
> = {
  "24H": { frequency: "hourly", length: 24, granularity: "hour" },
  "48H": { frequency: "hourly", length: 48, granularity: "hour" },
  "1W": { frequency: "daily", length: 7, granularity: "day" },
  "1M": { frequency: "daily", length: 30, granularity: "day" },
  "1Y": { frequency: "daily", length: 366, granularity: "month" },
};

/** Average daily MWh totals into calendar-month average MW. */
function monthlyAverages(daily: GridDemandPoint[]): GridDemandPoint[] {
  const buckets = new Map<string, { sum: number; n: number }>();
  for (const p of daily) {
    const key = p.period.slice(0, 7);
    const b = buckets.get(key) ?? { sum: 0, n: 0 };
    b.sum += p.mw;
    b.n += 1;
    buckets.set(key, b);
  }
  return [...buckets.entries()]
    .map(([period, b]) => ({ period, mw: b.sum / b.n }))
    .sort((a, b) => a.period.localeCompare(b.period));
}

export async function fetchGridDemand(range: GridRange = "24H"): Promise<GridDemandResult> {
  const spec = RANGE_SPEC[range];
  return cached<GridDemandResult>(`eia:grid-demand:${range}`, HOUR, async () => {
    const apiKey = process.env["EIA_API_KEY"];
    const base = {
      history: [] as GridDemandPoint[],
      range,
      granularity: spec.granularity,
      region: "US48",
      regionName: "United States Lower 48",
      fetchedAt: new Date().toISOString(),
    };
    if (!apiKey)
      return { ...base, error: "EIA API key is not configured." } satisfies GridDemandResult;

    const hourly = spec.frequency === "hourly";
    const params = new URLSearchParams();
    params.set("api_key", apiKey);
    params.set("frequency", spec.frequency);
    params.append("data[0]", "value");
    params.append("facets[respondent][]", "US48");
    params.append("facets[type][]", "D");
    if (!hourly) params.append("facets[timezone][]", "Eastern");
    params.append("sort[0][column]", "period");
    params.append("sort[0][direction]", "desc");
    params.set("length", String(spec.length));

    const dataset = hourly ? "region-data" : "daily-region-data";

    try {
      const res = await fetch(
        `https://api.eia.gov/v2/electricity/rto/${dataset}/data/?${params.toString()}`,
      );
      if (!res.ok) throw new Error(`EIA responded ${res.status}`);
      const json = (await res.json()) as {
        response?: { data?: { period: string; value: string | number }[] };
      };
      const rows = (json.response?.data ?? [])
        .map((r) => {
          const raw = typeof r.value === "string" ? Number.parseFloat(r.value) : r.value;
          // Daily rows are MWh summed over the day → convert to average MW.
          return { period: r.period, mw: hourly ? raw : raw / 24 };
        })
        .filter((p) => Number.isFinite(p.mw))
        .sort((a, b) => a.period.localeCompare(b.period));

      const history = spec.granularity === "month" ? monthlyAverages(rows) : rows;
      const latest = history[history.length - 1];
      return {
        ...base,
        history,
        ...(latest ? { latest } : {}),
        fetchedAt: new Date().toISOString(),
      } satisfies GridDemandResult;
    } catch (e) {
      return {
        ...base,
        error: e instanceof Error ? e.message : "EIA grid monitor request failed.",
      } satisfies GridDemandResult;
    }
  });
}


// ── EIA STEO commercial price forecast (by Census division) ───────────

export interface SteoPoint {
  /** YYYY-MM */
  period: string;
  /** cents per kWh */
  rateCents: number;
}

export interface SteoRegionForecast {
  region: string;
  regionName: string;
  series: SteoPoint[];
}

export interface SteoForecastResult {
  /** Keyed by STEO region code (NEC, MAC, …). */
  regions: Record<string, SteoRegionForecast>;
  /** Approximate STEO release month, YYYY-MM. */
  vintage: string;
  fetchedAt: string;
  error?: string;
}

/** Add `n` months to a YYYY-MM period key. */
function shiftMonth(period: string, n: number): string {
  const [y, m] = period.split("-").map(Number);
  const d = new Date(Date.UTC(y ?? 2000, (m ?? 1) - 1 + n, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export async function fetchSteoForecast(): Promise<SteoForecastResult> {
  return cached<SteoForecastResult>("eia:steo-commercial-price", DAY, async () => {
    const apiKey = process.env["EIA_API_KEY"];
    const codes = Object.keys(STEO_REGIONS);
    const base = { regions: {} as Record<string, SteoRegionForecast>, vintage: "", fetchedAt: new Date().toISOString() };
    if (!apiKey) return { ...base, error: "EIA API key is not configured." } satisfies SteoForecastResult;

    const params = new URLSearchParams();
    params.set("api_key", apiKey);
    params.set("frequency", "monthly");
    params.append("data[0]", "value");
    for (const c of codes) params.append("facets[seriesId][]", `ESCMU_${c}`);
    params.append("sort[0][column]", "period");
    params.append("sort[0][direction]", "desc");
    // 30 months of history+forecast per region is plenty to stitch onto the chart.
    params.set("length", String(codes.length * 30));

    try {
      const res = await fetch(`https://api.eia.gov/v2/steo/data/?${params.toString()}`);
      if (!res.ok) throw new Error(`EIA STEO responded ${res.status}`);
      const json = (await res.json()) as {
        response?: { data?: { period: string; seriesId: string; value: string | number }[] };
      };

      const regions: Record<string, SteoRegionForecast> = {};
      let maxPeriod = "";
      for (const row of json.response?.data ?? []) {
        const code = row.seriesId.replace("ESCMU_", "");
        const meta = STEO_REGIONS[code];
        if (!meta) continue;
        const v = typeof row.value === "string" ? Number.parseFloat(row.value) : row.value;
        if (!Number.isFinite(v)) continue;
        const entry = (regions[code] ??= { region: code, regionName: meta.name, series: [] });
        entry.series.push({ period: row.period, rateCents: v });
        if (row.period > maxPeriod) maxPeriod = row.period;
      }
      for (const r of Object.values(regions)) {
        r.series.sort((a, b) => a.period.localeCompare(b.period));
      }

      // STEO covers the release month plus 17 forward months.
      const vintage = maxPeriod ? shiftMonth(maxPeriod, -17) : "";
      return { regions, vintage, fetchedAt: new Date().toISOString() } satisfies SteoForecastResult;
    } catch (e) {
      return {
        ...base,
        error: e instanceof Error ? e.message : "EIA STEO request failed.",
      } satisfies SteoForecastResult;
    }
  });
}
