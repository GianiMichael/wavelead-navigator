import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { queryOptions, useQuery, useSuspenseQuery } from "@tanstack/react-query";

import { DemoBadge } from "@/components/DemoBadge";
import { lookupMarket } from "@/data/deregulated-markets";
import { CBECS_SOURCE, intensityForIndustry, rankedIntensity } from "@/data/energy-intensity";
import { naicsForIndustry, CBP_VINTAGE, STATE_FIPS } from "@/data/naics-map";
import { ISO_FOOTPRINTS } from "@/data/iso-regions";
import { steoRegionForState } from "@/data/steo-regions";
import { US_MAP_VIEWBOX, US_STATE_SHAPES } from "@/data/us-state-paths";

import { getIsoPrices, type IsoPrice, type IsoPriceResult } from "@/lib/iso-prices.functions";
import { getGridDemand, getMarketIntel } from "@/lib/market-intel.functions";
import {
  bandLabel,
  formatUsd,
  formatUsdCompact,
  monthlySpend,
  type PriorityBand,
  type ScoreResult,
} from "@/lib/priority-score";
import { periodDateLabel, type TargetPeriod } from "@/lib/target-period";

export const intelQuery = queryOptions({
  queryKey: ["market-intel"],
  queryFn: () => getMarketIntel(),
  staleTime: 60 * 60 * 1000,
});

const isoPricesQuery = queryOptions({
  queryKey: ["iso-wholesale-prices"],
  queryFn: () => getIsoPrices(),
  staleTime: 60 * 60 * 1000,
});


function monthLabel(period: string) {
  if (!period) return "unknown";
  const [y, m] = period.split("-");
  const d = new Date(Number(y), Number(m) - 1, 1);
  return d.toLocaleString("en-US", { month: "long", year: "numeric" });
}

function shortMonth(period: string) {
  if (!period) return "";
  const [y, m] = period.split("-");
  const d = new Date(Number(y), Number(m) - 1, 1);
  return d.toLocaleString("en-US", { month: "short", year: "2-digit" });
}

function bandTone(band: PriorityBand) {
  return band === "high"
    ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-200"
    : band === "medium"
      ? "border-amber-400/30 bg-amber-400/10 text-amber-200"
      : "border-rose-400/30 bg-rose-400/10 text-rose-200";
}

function euiFor(r: ScoreResult) {
  return r.siteEui ?? intensityForIndustry(r.industryKey)?.siteEui ?? 0;
}

/** Reasoning line, with the rate explicitly named as electricity. */
function electricReason(r: ScoreResult) {
  return r.reason.replace("¢/kWh commercial rate", "¢/kWh commercial electricity rate");
}

/* ── 1. Hero: this period's #1 target ───────────────────────────── */

/** Deep-links into Prospect Search with the industry + area pre-filled. */
function ProspectLink({
  row,
  demo,
  className,
  label = "Start Prospecting",
}: {
  row: ScoreResult;
  demo: boolean;
  className?: string;
  label?: string;
}) {
  return (
    <a
      href={`${demo ? "/demo/app" : "/app"}?industry=${encodeURIComponent(row.industryKey)}&location=${encodeURIComponent(row.stateName)}`}
      onClick={(e) => e.stopPropagation()}
      className={
        className ??
        "inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
      }
    >
      {label} →
    </a>
  );
}

function HeroCard({
  row,
  period,
  demo,
  onOpen,
}: {
  row: ScoreResult;
  period: TargetPeriod;
  demo: boolean;
  onOpen: () => void;
}) {
  const stats: { label: string; value: string; unit: string; sub?: string }[] = [
    {
      label: "Est. monthly electricity spend",
      value:
        row.annualSpendUsd !== undefined
          ? formatUsd(monthlySpend(row.annualSpendUsd))
          : "n/a",
      unit: "per typical facility",
      ...(row.annualSpendUsd !== undefined
        ? { sub: `~${formatUsdCompact(row.annualSpendUsd)}/year` }
        : {}),
    },
    {
      label: "Commercial electricity rate",
      value: row.rateCents !== undefined ? `${row.rateCents.toFixed(2)}¢` : "n/a",
      unit: "per kWh",
    },
    {
      label: "Rate trend",
      value:
        row.rateTrendPct !== undefined
          ? `${row.rateTrendPct > 0 ? "+" : ""}${(row.rateTrendPct * 100).toFixed(1)}%`
          : "n/a",
      unit: "vs. 3 mo. prior",
    },
    {
      label: "Establishments",
      value: row.establishments !== undefined ? row.establishments.toLocaleString() : "n/a",
      unit: "Census CBP",
    },
  ];

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onOpen()}
      className="glass-panel block w-full cursor-pointer rounded-3xl p-6 text-left transition-colors hover:bg-white/6 sm:p-8"
    >
      <div className="flex flex-wrap items-center gap-3">
        <span className="eyebrow" style={{ color: "var(--cc-muted)" }}>
          This period&apos;s target list · #1
        </span>
        <span
          className={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${bandTone(row.band)}`}
        >
          {bandLabel(row.band)} priority · {row.score.toFixed(0)}
        </span>
        <span className="text-[11px]" style={{ color: "var(--cc-muted)" }}>
          Generated {periodDateLabel(period.generatedAt)} · next refresh{" "}
          {periodDateLabel(period.nextRefreshAt)}
        </span>
      </div>

      <h2 className="headline mt-3 text-3xl sm:text-4xl">
        <span className="grad-text">{row.industryLabel}</span> in {row.stateName}
      </h2>

      {row.annualSpendUsd !== undefined && (
        <p className="mt-2 text-sm" style={{ color: "var(--cc-muted)" }}>
          A typical {row.industryLabel.replace(/ \/.*$/, "")} site in {row.stateName} spends an
          estimated{" "}
          <span className="font-semibold text-white">
            {formatUsd(monthlySpend(row.annualSpendUsd))}/month
          </span>{" "}
          on electricity (~{formatUsdCompact(row.annualSpendUsd)}/year).
        </p>
      )}

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-2xl border border-white/10 bg-white/4 p-4">
            <div className="text-2xl font-semibold tabular-nums sm:text-3xl">{s.value}</div>
            {s.sub && (
              <div className="mt-0.5 text-[11px] tabular-nums" style={{ color: "var(--cc-muted)" }}>
                {s.sub}
              </div>
            )}
            <div className="mt-1 text-[11px]" style={{ color: "var(--cc-muted)" }}>
              {s.unit}
            </div>
            <div className="eyebrow mt-2 text-[10px]">{s.label}</div>
          </div>
        ))}
      </div>


      <div className="mt-5 rounded-2xl border border-white/10 bg-white/4 p-4">
        <div className="eyebrow text-[10px]">Why now</div>
        <p className="mt-1.5 text-sm">{row.talkingPoint}</p>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <ProspectLink row={row} demo={demo} />
        <span className="text-[11px]" style={{ color: "var(--cc-muted)" }}>
          Layer 1 fit {(row.baselineFit * 100).toFixed(0)} · Layer 2 urgency{" "}
          {(row.urgency * 100).toFixed(0)}
          {row.gated ? " · gated (one layer weak)" : ""}
        </span>
      </div>
    </div>
  );
}

/* ── 2. State electricity rates ─────────────────────────────────── */

interface RateRow {
  state: string;
  stateName: string;
  rateCents: number;
}

function StateRatesPanel({
  rates,
  onSelect,
}: {
  rates: RateRow[];
  onSelect: (state: string) => void;
}) {
  const [showAll, setShowAll] = useState(false);
  const sorted = [...rates].sort((a, b) => b.rateCents - a.rateCents);
  const shown = showAll ? sorted : sorted.slice(0, 5);
  const max = sorted[0]?.rateCents ?? 1;

  return (
    <div className="glass-panel rounded-2xl p-5">
      <div className="eyebrow" style={{ color: "var(--cc-muted)" }}>
        Electricity — commercial rate (¢/kWh)
      </div>

      <ul className={`mt-4 space-y-1 ${showAll ? "max-h-[300px] overflow-y-auto pr-1" : ""}`}>
        {shown.map((r, i) => (
          <li key={r.state}>
            <button
              onClick={() => onSelect(r.state)}
              className="grid w-full grid-cols-[1rem_minmax(0,1fr)_auto] items-center gap-3 rounded-lg px-1 py-2 text-left transition-colors hover:bg-white/6"
            >
              <span className="text-[11px] tabular-nums" style={{ color: "var(--cc-muted)" }}>
                {i + 1}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm">{r.stateName}</span>
                <span className="mt-1 block h-1.5 rounded-full bg-white/8">
                  <span
                    className="block h-1.5 rounded-full"
                    style={{
                      width: `${(r.rateCents / max) * 100}%`,
                      background: "linear-gradient(90deg, oklch(0.62 0.24 300), oklch(0.82 0.15 55))",
                    }}
                  />
                </span>
              </span>
              <span className="text-sm font-semibold tabular-nums">{r.rateCents.toFixed(1)}¢</span>
            </button>
          </li>
        ))}
      </ul>

      {sorted.length > 5 && (
        <button
          onClick={() => setShowAll((v) => !v)}
          className="mt-3 text-[11px] underline underline-offset-4"
          style={{ color: "var(--cc-muted)" }}
        >
          {showAll ? "Show top 5" : `Show all ${sorted.length} states`}
        </button>
      )}
    </div>
  );
}

/* ── 3. Annual energy use per facility (reference) ──────────────── */

/** kBtu/year → readable MMBtu/Bn Btu string. */
function formatAnnualKbtu(kbtu: number): string {
  const mmbtu = kbtu / 1000;
  if (mmbtu >= 1000) return `${(mmbtu / 1000).toFixed(1)}B Btu`;
  return `${Math.round(mmbtu).toLocaleString()} MMBtu`;
}

function IntensityPanel({ onSelect }: { onSelect: (industryKey: string) => void }) {
  const [showAll, setShowAll] = useState(false);
  /** Ranked by real per-deal size: intensity × typical building footprint. */
  const all = rankedIntensity()
    .filter((e) => e.siteEui !== undefined && e.avgSqFt !== undefined)
    .map((e) => ({ ...e, annualKbtu: (e.siteEui ?? 0) * (e.avgSqFt ?? 0) }))
    .sort((a, b) => b.annualKbtu - a.annualKbtu);
  const shown = showAll ? all : all.slice(0, 5);
  const max = all[0]?.annualKbtu ?? 1;

  return (
    <div className="rounded-2xl border border-white/8 bg-white/3 p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="eyebrow" style={{ color: "var(--cc-muted)" }}>
          Annual energy use per facility
        </div>
        <span
          className="rounded-full border border-white/12 px-2 py-0.5 text-[10px]"
          style={{ color: "var(--cc-muted)" }}
        >
          Reference data
        </span>
      </div>
      <p className="mt-1 text-[11px]" style={{ color: "var(--cc-muted)" }}>
        Intensity × typical building size · electricity + natural gas · CBECS{" "}
        {CBECS_SOURCE.dataDate}
      </p>

      <ul className={`mt-4 space-y-1 ${showAll ? "max-h-[300px] overflow-y-auto pr-1" : ""}`}>
        {shown.map((e, i) => (
          <li key={e.key}>
            <button
              onClick={() => onSelect(e.key)}
              className="grid w-full grid-cols-[1rem_minmax(0,1fr)_auto] items-center gap-3 rounded-lg px-1 py-2 text-left transition-colors hover:bg-white/6"
            >
              <span className="text-[11px] tabular-nums" style={{ color: "var(--cc-muted)" }}>
                {i + 1}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm">{e.label}</span>
                <span className="mt-1 block h-1.5 rounded-full bg-white/8">
                  <span
                    className="block h-1.5 rounded-full bg-white/35"
                    style={{ width: `${(e.annualKbtu / max) * 100}%` }}
                  />
                </span>
              </span>
              <span className="text-right">
                <span className="block text-sm font-semibold tabular-nums">
                  {formatAnnualKbtu(e.annualKbtu)}
                </span>
                <span
                  className="mt-0.5 block text-[10px] tabular-nums"
                  style={{ color: "var(--cc-muted)" }}
                >
                  {e.siteEui} kBtu/sq ft/year · {(e.avgSqFt ?? 0).toLocaleString()} sq ft
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>

      {all.length > 5 && (
        <button
          onClick={() => setShowAll((v) => !v)}
          className="mt-3 text-[11px] underline underline-offset-4"
          style={{ color: "var(--cc-muted)" }}
        >
          {showAll ? "Show top 5" : `Show all ${all.length} industries`}
        </button>
      )}
    </div>
  );
}


/* ── 4. Live grid demand ────────────────────────────────────────── */

function hoursAgo(period: string): number | null {
  const m = period.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2})/);
  if (!m) return null;
  const t = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]));
  return Math.max(0, Math.round((Date.now() - t) / 3_600_000));
}

const GRID_RANGES = ["24H", "48H", "1W", "1M", "1Y"] as const;
type GridRange = (typeof GRID_RANGES)[number];

const RANGE_BLURB: Record<GridRange, string> = {
  "24H": "last 24 hours · hourly",
  "48H": "last 48 hours · hourly",
  "1W": "last 7 days · daily average",
  "1M": "last 30 days · daily average",
  "1Y": "last 12 months · monthly average",
};

function parsePeriod(period: string) {
  const hm = period.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2})/);
  if (hm)
    return new Date(Date.UTC(Number(hm[1]), Number(hm[2]) - 1, Number(hm[3]), Number(hm[4])));
  const dm = period.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (dm) return new Date(Date.UTC(Number(dm[1]), Number(dm[2]) - 1, Number(dm[3])));
  const mm = period.match(/^(\d{4})-(\d{2})$/);
  if (mm) return new Date(Date.UTC(Number(mm[1]), Number(mm[2]) - 1, 1));
  return null;
}

/** Axis tick label, granularity-aware. Pinned to UTC to avoid hydration drift. */
function gridTickLabel(period: string, granularity: string) {
  const d = parsePeriod(period);
  if (!d) return period;
  if (granularity === "hour")
    return d.toLocaleTimeString("en-US", { hour: "numeric", timeZone: "UTC" });
  if (granularity === "day")
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
  return d.toLocaleDateString("en-US", { month: "short", timeZone: "UTC" });
}

/** Tooltip stamp, granularity-aware. */
function gridStamp(period: string, granularity: string) {
  const d = parsePeriod(period);
  if (!d) return period;
  if (granularity === "hour")
    return `${d.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      timeZone: "UTC",
    })} UTC`;
  if (granularity === "day")
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      timeZone: "UTC",
    });
  return d.toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
}

type GridData = {
  latest?: { period: string; mw: number };
  history: { period: string; mw: number }[];
  granularity?: string;
  regionName: string;
  error?: string;
};

function GridDemandWidget({ grid }: { grid: GridData }) {
  const [range, setRange] = useState<GridRange>("24H");
  const [age, setAge] = useState<number | null>(null);
  const [hover, setHover] = useState<number | null>(null);

  const { data: ranged, isFetching } = useQuery({
    queryKey: ["grid-demand", range],
    queryFn: () => getGridDemand({ data: { range } }),
    staleTime: 60 * 60 * 1000,
    enabled: range !== "24H",
  });

  const active: GridData = range === "24H" || !ranged ? grid : ranged;
  const granularity = active.granularity ?? "hour";

  useEffect(() => {
    if (grid.latest) setAge(hoursAgo(grid.latest.period));
  }, [grid.latest]);

  const pts = active.history;
  const w = 300;
  const h = 130;
  const pad = { l: 44, r: 8, t: 10, b: 24 };
  const plotW = w - pad.l - pad.r;
  const plotH = h - pad.t - pad.b;
  const values = pts.map((p) => p.mw);
  const lo = Math.min(...values, Infinity) * 0.98;
  const hi = Math.max(...values, -Infinity) * 1.02;
  const x = (i: number) => pad.l + (pts.length > 1 ? (i / (pts.length - 1)) * plotW : plotW / 2);
  const y = (v: number) => pad.t + plotH - ((v - lo) / (hi - lo || 1)) * plotH;
  const path =
    pts.length > 1 ? pts.map((p, i) => `${i === 0 ? "M" : "L"}${x(i)},${y(p.mw)}`).join(" ") : "";
  const xLabelEvery = Math.max(1, Math.ceil(pts.length / 4));

  return (
    <div className="glass-panel rounded-2xl p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="eyebrow" style={{ color: "var(--cc-muted)" }}>
          Electricity — grid demand (MW)
        </div>
        <span className="flex items-center gap-1.5 text-[10px]" style={{ color: "var(--cc-muted)" }}>
          <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
          {age === null ? "live" : age === 0 ? "updated just now" : `updated ${age}h ago`}
        </span>
      </div>

      <div className="mt-3 flex gap-1 rounded-lg border border-white/10 bg-white/5 p-1">
        {GRID_RANGES.map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => {
              setRange(r);
              setHover(null);
            }}
            aria-pressed={range === r}
            className={`flex-1 rounded-md px-2 py-1 text-[11px] font-medium transition ${
              range === r ? "bg-white/15 text-white" : "text-white/55 hover:text-white/85"
            }`}
          >
            {r}
          </button>
        ))}
      </div>

      {grid.error || !grid.latest ? (
        <p className="mt-4 text-xs text-amber-200">
          {isFetching
            ? "Loading grid demand…"
            : `Grid demand unavailable${grid.error ? `: ${grid.error}` : "."}`}
        </p>
      ) : (
        <>
          <div className="mt-3 text-3xl font-semibold tabular-nums">
            {Math.round(grid.latest.mw).toLocaleString()}
            <span className="ml-1.5 text-sm font-normal" style={{ color: "var(--cc-muted)" }}>
              MW
            </span>
          </div>
          <div className="text-[11px]" style={{ color: "var(--cc-muted)" }}>
            {grid.regionName} · Current reading
            {isFetching ? " · updating…" : ""}
          </div>

          {path && (
            <div className="relative mt-3">
              <svg
                viewBox={`0 0 ${w} ${h}`}
                className="w-full"
                role="img"
                aria-label={`Grid demand, ${RANGE_BLURB[range]}`}
              >
                {[0, 1, 2].map((i) => {
                  const v = lo + ((hi - lo) / 2) * i;
                  return (
                    <g key={i}>
                      <line x1={pad.l} x2={w - pad.r} y1={y(v)} y2={y(v)} stroke="rgba(255,255,255,0.10)" />
                      <text x={pad.l - 6} y={y(v) + 3.5} textAnchor="end" fontSize={8} fill="rgba(255,255,255,0.5)">
                        {Math.round(v / 1000)}k
                      </text>
                    </g>
                  );
                })}
                <text
                  transform={`translate(9 ${pad.t + plotH / 2}) rotate(-90)`}
                  textAnchor="middle"
                  fontSize={8}
                  fill="rgba(255,255,255,0.6)"
                >
                  MW
                </text>

                <path d={path} fill="none" stroke="oklch(0.66 0.26 340)" strokeWidth={2} />

                {pts.map((p, i) => (
                  <g key={p.period}>
                    {hover === i && <circle cx={x(i)} cy={y(p.mw)} r={3.5} fill="oklch(0.66 0.26 340)" />}
                    <rect
                      x={x(i) - plotW / (pts.length * 2)}
                      y={pad.t}
                      width={plotW / pts.length}
                      height={plotH}
                      fill="transparent"
                      onMouseEnter={() => setHover(i)}
                      onMouseLeave={() => setHover(null)}
                    />
                    {i % xLabelEvery === 0 && (
                      <text x={x(i)} y={h - 8} textAnchor="middle" fontSize={8} fill="rgba(255,255,255,0.5)">
                        {gridTickLabel(p.period, granularity)}
                      </text>
                    )}
                  </g>
                ))}
              </svg>

              {hover !== null && pts[hover] && (
                <div
                  className="pointer-events-none absolute -top-2 rounded-lg border border-white/15 bg-black/85 px-2 py-1 text-[10px] whitespace-nowrap backdrop-blur"
                  style={{ left: `${(x(hover) / w) * 100}%`, transform: "translateX(-50%)" }}
                >
                  {gridStamp(pts[hover]!.period, granularity)}:{" "}
                  {Math.round(pts[hover]!.mw).toLocaleString()} MW
                </div>
              )}
            </div>
          )}

          <p className="mt-3 text-[11px]" style={{ color: "var(--cc-muted)" }}>
            Total grid load (power), updated hourly.{" "}
            {granularity === "hour"
              ? "Each point is one hour."
              : granularity === "day"
                ? "Each point averages one day."
                : "Each point averages one calendar month."}{" "}
            Source: EIA-930 Hourly Electric Grid Monitor — live U.S. power grid data since 2019.
          </p>
        </>
      )}
    </div>
  );
}



/* ── Wholesale ISO/RTO prices (GridStatus.io, cached) ───────────── */

function freshness(iso: string | null) {
  if (!iso) return "no data yet";
  const diff = Date.now() - new Date(iso).getTime();
  const h = Math.floor(diff / 3_600_000);
  if (h < 1) return "updated just now";
  if (h < 24) return `updated ${h}h ago`;
  return `updated ${Math.floor(h / 24)}d ago`;
}

function stamp(iso: string | null) {
  if (!iso) return "—";
  return `${new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
  })} UTC`;
}

function IsoWholesalePanel() {
  const { data, isPending } = useQuery(isoPricesQuery);
  const [open, setOpen] = useState<string | null>(null);

  const regions = data?.regions ?? [];
  const active = regions.find((r) => r.iso === open);

  return (
    <div className="glass-panel mt-5 rounded-2xl p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="eyebrow" style={{ color: "var(--cc-muted)" }}>
          Electricity — wholesale price (ISO/RTO)
        </div>
        <span className="flex items-center gap-1.5 text-[10px]" style={{ color: "var(--cc-muted)" }}>
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-sky-400" />
          {isPending ? "loading…" : freshness(data?.lastUpdated ?? null)}
        </span>
      </div>

      <p className="mt-2 text-[11px]" style={{ color: "var(--cc-muted)" }}>
        Day-ahead hourly prices averaged over the last 24 hours — what suppliers pay to acquire
        power, not what your prospects pay on their bills. Day-ahead avoids the transient congestion
        spikes seen in real-time prices. Compare against the commercial retail rate panel above.
      </p>


      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {regions.map((r) => {
          const selected = open === r.iso;
          return (
            <button
              key={r.iso}
              type="button"
              onClick={() => setOpen(selected ? null : r.iso)}
              aria-pressed={selected}
              className={`rounded-xl border p-4 text-left transition ${
                selected
                  ? "border-white/25 bg-white/10"
                  : "border-white/10 bg-white/5 hover:border-white/20"
              }`}
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-sm font-semibold">{r.iso}</span>
                <span className="text-[10px]" style={{ color: "var(--cc-muted)" }}>
                  {r.hub}
                </span>
              </div>
              <div className="mt-2 text-2xl font-semibold tabular-nums">
                {r.priceMwh === null ? (
                  <span className="text-base font-normal text-amber-200">n/a</span>
                ) : (
                  <>
                    ${r.priceMwh.toFixed(2)}
                    <span
                      className="ml-1 text-xs font-normal"
                      style={{ color: "var(--cc-muted)" }}
                    >
                      /MWh day-ahead
                    </span>
                  </>
                )}
              </div>
              <div className="text-[11px]" style={{ color: "var(--cc-muted)" }}>
                {r.priceCentsKwh !== null ? `${r.priceCentsKwh.toFixed(2)}¢/kWh · ` : ""}
                {r.states.join(", ")}
              </div>
              {(r.rtPriceMwh !== null || r.loadMw !== null) && (
                <div
                  className="mt-2 space-y-1 border-t border-white/10 pt-2 text-[11px]"
                  style={{ color: "var(--cc-muted)" }}
                >
                  {r.rtPriceMwh !== null && (
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span>Real-time: ${r.rtPriceMwh.toFixed(2)}</span>
                      {r.spreadPct !== null && (
                        <span
                          className={`rounded px-1.5 py-0.5 tabular-nums ${
                            Math.abs(r.spreadPct) >= 20
                              ? "bg-amber-400/15 text-amber-200"
                              : "bg-white/10 text-white/70"
                          }`}
                          title={
                            Math.abs(r.spreadPct) >= 20
                              ? "Wide spread — this market is currently less predictable than usual"
                              : "Real-time vs day-ahead spread"
                          }
                        >
                          {Math.abs(r.spreadPct) >= 20 ? "⚠ " : ""}
                          {r.spreadPct > 0 ? "+" : ""}
                          {r.spreadPct.toFixed(0)}% spread
                        </span>
                      )}
                    </div>
                  )}
                  {r.loadMw !== null && (
                    <div>Load: {r.loadMw.toLocaleString("en-US")} MW</div>
                  )}
                </div>
              )}
            </button>

          );
        })}
        {!isPending && regions.length === 0 && (
          <p className="text-xs text-amber-200">Wholesale prices unavailable.</p>
        )}
      </div>

      {active && (
        <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-4 text-[11px]">
          <div className="text-sm font-semibold text-white">{active.isoName}</div>
          <dl className="mt-2 grid gap-x-6 gap-y-1 sm:grid-cols-2" style={{ color: "var(--cc-muted)" }}>
            <div className="flex justify-between gap-3">
              <dt>Hub</dt>
              <dd className="text-white/85">{active.hub}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt>Market</dt>
              <dd className="text-white/85">{active.market || "—"}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt>Window start</dt>
              <dd className="text-white/85">{stamp(active.intervalStart)}</dd>
            </div>

            <div className="flex justify-between gap-3">
              <dt>Real-time avg (same window)</dt>
              <dd className="text-white/85">
                {active.rtPriceMwh === null ? "—" : `$${active.rtPriceMwh.toFixed(2)}/MWh`}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt>DA vs RT spread</dt>
              <dd className="text-white/85">
                {active.spreadPct === null
                  ? "—"
                  : `${active.spreadPct > 0 ? "+" : ""}${active.spreadPct.toFixed(1)}%`}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt>Regional load</dt>
              <dd className="text-white/85">
                {active.loadMw === null
                  ? "—"
                  : `${active.loadMw.toLocaleString("en-US")} MW · ${stamp(active.loadAt)}`}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt>Cached at</dt>
              <dd className="text-white/85">{stamp(active.fetchedAt)}</dd>
            </div>
            <div className="flex justify-between gap-3 sm:col-span-2">
              <dt>Deregulated states served</dt>
              <dd className="text-white/85">{active.states.join(", ")}</dd>
            </div>
          </dl>
          {active.error && <p className="mt-2 text-amber-200">Last fetch error: {active.error}</p>}
        </div>
      )}

      <p className="mt-3 text-[11px]" style={{ color: "var(--cc-muted)" }}>
        Source: GridStatus.io — day-ahead hourly hub prices, real-time comparison, and ISO load ·
        cached on a shared schedule for all visitors · last refresh{" "}
        {stamp(data?.lastUpdated ?? null)}.
      </p>

    </div>
  );
}



function RateHistoryChart({
  history,
  stateName,
  trendPct,
  forecast,
  forecastRegion,
  forecastVintage,
}: {
  history: { period: string; rateCents: number }[];
  stateName: string;
  trendPct?: number;
  forecast?: { period: string; rateCents: number }[];
  forecastRegion?: string;
  forecastVintage?: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  if (history.length < 2) return null;

  const fc = forecast ?? [];
  const points = [...history.map((p) => ({ ...p, kind: "hist" as const })), ...fc.map((p) => ({ ...p, kind: "fc" as const }))];

  const w = 520;
  const h = 220;
  const pad = { l: 46, r: 14, t: 14, b: 38 };
  const plotW = w - pad.l - pad.r;
  const plotH = h - pad.t - pad.b;

  const values = points.map((p) => p.rateCents);
  const min = Math.min(...values) * 0.97;
  const max = Math.max(...values) * 1.03;
  const x = (i: number) => pad.l + (i / (points.length - 1)) * plotW;
  const y = (v: number) => pad.t + plotH - ((v - min) / (max - min || 1)) * plotH;

  const histPath = history.map((p, i) => `${i === 0 ? "M" : "L"}${x(i)},${y(p.rateCents)}`).join(" ");
  const lastHist = history[history.length - 1]!;
  const fcPath =
    fc.length > 0
      ? [`M${x(history.length - 1)},${y(lastHist.rateCents)}`]
          .concat(fc.map((p, i) => `L${x(history.length + i)},${y(p.rateCents)}`))
          .join(" ")
      : "";

  const dir =
    trendPct === undefined ? "flat" : trendPct > 0.005 ? "rising" : trendPct < -0.005 ? "falling" : "flat";

  const lastFc = fc[fc.length - 1];
  const fcDelta = lastFc ? (lastFc.rateCents - lastHist.rateCents) / (lastHist.rateCents || 1) : 0;
  const fcSummary = lastFc
    ? fcDelta > 0.015
      ? `Forecast: rates expected to continue rising through ${monthLabel(lastFc.period)} (${(fcDelta * 100).toFixed(1)}%).`
      : fcDelta < -0.015
        ? `Forecast: rates expected to ease through ${monthLabel(lastFc.period)} (${(fcDelta * 100).toFixed(1)}%).`
        : `Forecast: rates expected to stabilize through ${monthLabel(lastFc.period)}.`
    : null;

  const ticks = 4;
  const xLabelEvery = Math.max(1, Math.ceil(points.length / 6));
  const HIST_COLOR = "oklch(0.66 0.26 340)";
  const FC_COLOR = "oklch(0.82 0.14 55)";

  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-sm font-medium">{stateName} commercial electricity rate history</span>
        <span className="text-xs" style={{ color: "var(--cc-muted)" }}>
          Historical trend {dir}
          {trendPct !== undefined ? ` (${(trendPct * 100).toFixed(1)}% vs. 3 months prior)` : ""}
        </span>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-4 text-[11px]" style={{ color: "var(--cc-muted)" }}>
        <span className="inline-flex items-center gap-1.5">
          <svg width="20" height="6" aria-hidden>
            <line x1="0" y1="3" x2="20" y2="3" stroke={HIST_COLOR} strokeWidth={2.5} />
          </svg>
          Historical
        </span>
        {fc.length > 0 && (
          <span className="inline-flex items-center gap-1.5">
            <svg width="20" height="6" aria-hidden>
              <line x1="0" y1="3" x2="20" y2="3" stroke={FC_COLOR} strokeWidth={2.5} strokeDasharray="5 4" />
            </svg>
            Forecast (EIA STEO)
          </span>
        )}
      </div>

      <div className="relative mt-3">
        <svg viewBox={`0 0 ${w} ${h}`} className="w-full">
          {Array.from({ length: ticks + 1 }, (_, i) => {
            const v = min + ((max - min) / ticks) * i;
            return (
              <g key={i}>
                <line x1={pad.l} x2={w - pad.r} y1={y(v)} y2={y(v)} stroke="rgba(255,255,255,0.10)" />
                <text x={pad.l - 8} y={y(v) + 4} textAnchor="end" fontSize={10} fill="rgba(255,255,255,0.5)">
                  {v.toFixed(1)}
                </text>
              </g>
            );
          })}
          <text
            transform={`translate(12 ${pad.t + plotH / 2}) rotate(-90)`}
            textAnchor="middle"
            fontSize={11}
            fill="rgba(255,255,255,0.65)"
          >
            ¢/kWh
          </text>

          {fc.length > 0 && (
            <rect
              x={x(history.length - 1)}
              y={pad.t}
              width={plotW - (x(history.length - 1) - pad.l)}
              height={plotH}
              fill="rgba(255,255,255,0.035)"
            />
          )}

          <path d={histPath} fill="none" stroke={HIST_COLOR} strokeWidth={2.5} />
          {fcPath && (
            <path
              d={fcPath}
              fill="none"
              stroke={FC_COLOR}
              strokeWidth={2.5}
              strokeDasharray="6 5"
              opacity={0.9}
            />
          )}

          {points.map((p, i) => (
            <g key={`${p.kind}-${p.period}`}>
              <circle
                cx={x(i)}
                cy={y(p.rateCents)}
                r={hover === i ? 5 : 3}
                fill={p.kind === "hist" ? HIST_COLOR : FC_COLOR}
                opacity={p.kind === "hist" ? 1 : 0.9}
              />
              <rect
                x={x(i) - plotW / (points.length * 2)}
                y={pad.t}
                width={plotW / points.length}
                height={plotH}
                fill="transparent"
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
              />
              {i % xLabelEvery === 0 && (
                <text
                  x={x(i)}
                  y={h - pad.b + 18}
                  textAnchor="middle"
                  fontSize={10}
                  fill="rgba(255,255,255,0.5)"
                >
                  {shortMonth(p.period)}
                </text>
              )}
            </g>
          ))}
          <text
            x={pad.l + plotW / 2}
            y={h - 6}
            textAnchor="middle"
            fontSize={11}
            fill="rgba(255,255,255,0.65)"
          >
            Month
          </text>
        </svg>

        {hover !== null && points[hover] && (
          <div
            className="pointer-events-none absolute -top-1 rounded-lg border border-white/15 bg-black/85 px-2.5 py-1.5 text-[11px] backdrop-blur"
            style={{ left: `${(x(hover) / w) * 100}%`, transform: "translateX(-50%)" }}
          >
            {monthLabel(points[hover]!.period)}: {points[hover]!.rateCents.toFixed(2)}¢/kWh
            {points[hover]!.kind === "fc" ? " (forecast)" : ""}
          </div>
        )}
      </div>

      {fcSummary && (
        <p className="mt-3 text-xs" style={{ color: "var(--cc-muted)" }}>
          {fcSummary}
          <br />
          STEO forecast as of {forecastVintage ? monthLabel(forecastVintage) : "latest release"}
          {forecastRegion ? ` · ${forecastRegion} region` : ""}.
        </p>
      )}
    </div>
  );
}


/* ── Detail side panel ──────────────────────────────────────────── */

function DetailPanel({
  row,
  rate,
  steo,
  onClose,
}: {
  row: ScoreResult;
  rate?: { stateName: string; trendPct?: number; history: { period: string; rateCents: number }[] };
  steo?: {
    regions: Record<string, { region: string; regionName: string; series: { period: string; rateCents: number }[] }>;
    vintage: string;
  };
  onClose: () => void;
}) {
  const region = steoRegionForState(row.state);
  const forecast = useMemo(() => {
    if (!rate || !region || !steo) return [];
    const series = steo.regions[region.code]?.series ?? [];
    const lastHist = rate.history[rate.history.length - 1]?.period ?? "";
    return series.filter((p) => p.period > lastHist).slice(0, 6);
  }, [rate, region, steo]);


  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const ci = intensityForIndustry(row.industryKey);
  const naics = naicsForIndustry(row.industryKey);

  const stats: { label: string; value: string }[] = [
    {
      label: "Est. monthly spend / facility",
      value:
        row.annualSpendUsd !== undefined
          ? `${formatUsd(monthlySpend(row.annualSpendUsd))}/month · ~${formatUsdCompact(row.annualSpendUsd)}/year`
          : "n/a",
    },
    {
      label: "Commercial electricity rate",
      value: row.rateCents !== undefined ? `${row.rateCents.toFixed(2)}¢/kWh` : "n/a",
    },
    { label: "Energy intensity", value: euiFor(row) ? `${euiFor(row)} kBtu/sq ft/year` : "n/a" },
    {
      label: "Rate trend",
      value: row.rateTrendPct !== undefined ? `${(row.rateTrendPct * 100).toFixed(1)}%` : "n/a",
    },
    {
      label: "Establishments",
      value: row.establishments !== undefined ? row.establishments.toLocaleString() : "n/a",
    },
    { label: "Layer 1 — baseline fit", value: `${(row.baselineFit * 100).toFixed(0)} / 100` },
    { label: "Layer 2 — live urgency", value: `${(row.urgency * 100).toFixed(0)} / 100` },
    { label: "Combined (gated)", value: `${row.score.toFixed(0)} / 100` },
    { label: "Market", value: row.marketStatus === "partial" ? "Partially deregulated" : "Deregulated" },
  ];

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button aria-label="Close detail" onClick={onClose} className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <aside className="glass-panel relative h-full w-full max-w-md overflow-y-auto border-l border-white/10 p-6">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
          <div className="min-w-0">
            <div className="eyebrow" style={{ color: "var(--cc-muted)" }}>
              {row.stateName}
            </div>
            <h2 className="headline mt-1 truncate text-xl">{row.industryLabel}</h2>
          </div>
          <button
            onClick={onClose}
            className="shrink-0 rounded-full border border-white/15 px-3 py-1 text-xs text-white/70 hover:text-white"
          >
            Close
          </button>
        </div>

        <span className={`mt-3 inline-block rounded-full border px-2.5 py-1 text-[11px] font-medium ${bandTone(row.band)}`}>
          {bandLabel(row.band)} priority · {row.score.toFixed(0)}
        </span>

        <dl className="mt-5 grid grid-cols-2 gap-3">
          {stats.map((s) => (
            <div key={s.label} className="rounded-xl border border-white/10 bg-white/4 p-3">
              <dt className="text-[11px]" style={{ color: "var(--cc-muted)" }}>
                {s.label}
              </dt>
              <dd className="mt-1 text-base font-semibold tabular-nums">{s.value}</dd>
            </div>
          ))}
        </dl>

        <p className="mt-4 text-xs" style={{ color: "var(--cc-muted)" }}>
          {ci ? `CBECS activity: ${ci.cbecsActivity}. ` : ""}
          {naics ? `NAICS ${naics.naics}. ` : ""}
          {electricReason(row)}
        </p>

        <div className="mt-4 rounded-xl border border-white/10 bg-white/4 p-3">
          <div className="eyebrow text-[10px]">Why now</div>
          <p className="mt-1.5 text-xs">{row.talkingPoint}</p>
        </div>

        <div className="mt-6">
          {rate ? (
            <RateHistoryChart
              history={rate.history}
              stateName={rate.stateName}
              {...(rate.trendPct !== undefined ? { trendPct: rate.trendPct } : {})}
              {...(forecast.length > 0
                ? {
                    forecast,
                    ...(region ? { forecastRegion: region.name } : {}),
                    ...(steo?.vintage ? { forecastVintage: steo.vintage } : {}),
                  }
                : {})}
            />

          ) : (
            <p className="text-sm" style={{ color: "var(--cc-muted)" }}>
              No rate history available for {row.stateName}.
            </p>
          )}
        </div>

        {row.missing.length > 0 && (
          <p className="mt-4 text-xs" style={{ color: "var(--cc-muted)" }}>
            Scored without: {row.missing.join(", ")}.
          </p>
        )}
      </aside>
    </div>
  );
}

/* ── Runners-up (ranks 2-11) ────────────────────────────────────── */

function RunnersUp({
  rows,
  demo,
  onOpen,
}: {
  rows: ScoreResult[];
  demo: boolean;
  onOpen: (r: ScoreResult) => void;
}) {
  const [open, setOpen] = useState(false);
  if (rows.length === 0) return null;

  return (
    <div className="mt-3">
      <button
        onClick={() => setOpen((v) => !v)}
        className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-xs text-white/80 transition-colors hover:bg-white/10 hover:text-white"
        aria-expanded={open}
      >
        {open ? "Hide next matches" : `See next ${rows.length} matches`}
      </button>

      {open && (
        <ul className="mt-3 space-y-1">
          {rows.map((r, i) => (
            <li
              key={`${r.industryKey}-${r.state}`}
              className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-xl border border-white/8 bg-white/3 pr-3 transition-colors hover:bg-white/8"
            >
              <button
                onClick={() => onOpen(r)}
                className="grid w-full grid-cols-[1.4rem_minmax(0,1fr)_auto_auto] items-center gap-3 px-3 py-2.5 text-left"
              >
                <span className="text-[11px] tabular-nums" style={{ color: "var(--cc-muted)" }}>
                  {i + 2}
                </span>
                <span className="min-w-0 truncate text-sm">
                  {r.industryLabel} <span style={{ color: "var(--cc-muted)" }}>· {r.stateName}</span>
                </span>
                <span className="text-xs tabular-nums" style={{ color: "var(--cc-muted)" }}>
                  {r.annualSpendUsd !== undefined
                    ? `${formatUsd(monthlySpend(r.annualSpendUsd))}/mo per site`
                    : "—"}{" "}
                  ·{" "}
                  {r.rateCents !== undefined ? `${r.rateCents.toFixed(1)}¢` : "—"}
                </span>
                <span
                  className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${bandTone(r.band)}`}
                >
                  {r.score.toFixed(0)}
                </span>
              </button>
              <ProspectLink
                row={r}
                demo={demo}
                label="Prospect"
                className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[11px] text-white/80 hover:bg-white/10 hover:text-white"
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}


/* ── U.S. multi-metric choropleth + ISO overlay ─────────────────── */

interface MapRate {
  state: string;
  stateName: string;
  rateCents: number;
  marketStatus: "deregulated" | "partial";
}

type MapMetric = "rate" | "wholesale" | "volatility" | "opportunity";

const MAP_METRICS: { key: MapMetric; label: string; unit: string }[] = [
  { key: "rate", label: "Retail rate", unit: "¢/kWh" },
  { key: "wholesale", label: "Wholesale price", unit: "$/MWh" },
  { key: "volatility", label: "Volatility", unit: "% DA vs RT" },
  { key: "opportunity", label: "Opportunity size", unit: "$/facility/yr" },
];

/** FIPS → state code, so map shapes can be joined to rate/ISO/score data. */
const FIPS_TO_CODE = new Map(Object.entries(STATE_FIPS).map(([code, fips]) => [fips, code]));
const CODE_TO_SHAPE = new Map(
  US_STATE_SHAPES.flatMap((s) => {
    const code = FIPS_TO_CODE.get(s.fips);
    return code ? [[code, s] as const] : [];
  }),
);

function formatMetric(metric: MapMetric, v: number): string {
  if (metric === "rate") return `${v.toFixed(2)}¢/kWh`;
  if (metric === "wholesale") return `$${v.toFixed(2)}/MWh`;
  if (metric === "volatility") return `${v.toFixed(0)}% spread`;
  return `${formatUsd(v)}/yr`;
}

function UsRateMap({
  rates,
  iso,
  leaderboard,
  onSelect,
}: {
  rates: MapRate[];
  iso?: IsoPriceResult | undefined;
  leaderboard: ScoreResult[];
  onSelect: (state: string) => void;
}) {
  const [metric, setMetric] = useState<MapMetric>("rate");
  const [hover, setHover] = useState<{ name: string; x: number; y: number } | null>(null);
  const [isoHover, setIsoHover] = useState<{ code: string; x: number; y: number } | null>(null);

  const byName = useMemo(() => new Map(rates.map((r) => [r.stateName.toLowerCase(), r])), [rates]);

  /** ISO price row per deregulated state (reuses the wholesale panel cache). */
  const isoByState = useMemo(() => {
    const m = new Map<string, IsoPrice>();
    for (const r of iso?.regions ?? []) for (const s of r.states) m.set(s, r);
    return m;
  }, [iso]);

  /** Largest per-facility annual spend found in each state. */
  const spendByState = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of leaderboard) {
      if (r.annualSpendUsd === undefined) continue;
      const cur = m.get(r.state);
      if (cur === undefined || r.annualSpendUsd > cur) m.set(r.state, r.annualSpendUsd);
    }
    return m;
  }, [leaderboard]);

  const valueFor = useMemo(() => {
    return (r?: MapRate): number | undefined => {
      if (!r) return undefined;
      if (metric === "rate") return r.rateCents;
      if (metric === "wholesale") return isoByState.get(r.state)?.priceMwh ?? undefined;
      if (metric === "volatility") {
        const s = isoByState.get(r.state)?.spreadPct;
        return s === null || s === undefined ? undefined : Math.abs(s);
      }
      return spendByState.get(r.state);
    };
  }, [metric, isoByState, spendByState]);

  const values = rates.map((r) => valueFor(r)).filter((v): v is number => v !== undefined);
  const lo = values.length ? Math.min(...values) : 0;
  const hi = values.length ? Math.max(...values) : 0;

  const fill = (r?: MapRate) => {
    const v = valueFor(r);
    if (v === undefined) return "rgba(255,255,255,0.05)";
    const t = hi > lo ? (v - lo) / (hi - lo) : 0.5;
    const l = 0.82 - t * 0.28;
    const c = 0.06 + t * 0.2;
    const hue = 55 - t * 100;
    return `oklch(${l.toFixed(3)} ${c.toFixed(3)} ${hue.toFixed(0)})`;
  };

  const hovered = hover ? byName.get(hover.name.toLowerCase()) : undefined;
  const hoveredMarket = hover ? lookupMarket(hover.name) : undefined;
  const hoveredValue = valueFor(hovered);

  const activeMetric = MAP_METRICS.find((m) => m.key === metric)!;
  const legendLabel = (v: number) =>
    values.length === 0 ? "" : metric === "opportunity" ? formatUsd(v) : formatMetric(metric, v);

  const isoRow = (code: string) => iso?.regions.find((r) => r.iso === code);
  const hoveredIso = isoHover ? ISO_FOOTPRINTS.find((f) => f.code === isoHover.code) : undefined;
  const hoveredIsoRow = isoHover ? isoRow(isoHover.code) : undefined;

  const isoCentroid = (codes: string[]) => {
    const pts = codes.flatMap((c) => {
      const s = CODE_TO_SHAPE.get(c);
      return s ? [[s.cx, s.cy] as const] : [];
    });
    if (pts.length === 0) return null;
    return {
      x: pts.reduce((a, p) => a + p[0], 0) / pts.length,
      y: pts.reduce((a, p) => a + p[1], 0) / pts.length,
    };
  };

  return (
    <section className="glass-panel mt-6 rounded-3xl p-6 sm:p-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="eyebrow" style={{ color: "var(--cc-muted)" }}>
            Map — {activeMetric.label.toLowerCase()} by state
          </div>
          <h2 className="headline mt-1 text-xl">
            Where power costs the most in <span className="grad-text">open markets</span>
          </h2>
        </div>
        <div className="flex items-center gap-3 text-[11px]" style={{ color: "var(--cc-muted)" }}>
          <span>{legendLabel(lo)}</span>
          <span
            className="h-2 w-32 rounded-full"
            style={{
              background:
                "linear-gradient(90deg, oklch(0.82 0.06 55), oklch(0.68 0.16 5), oklch(0.54 0.26 315))",
            }}
          />
          <span>{legendLabel(hi)}</span>
          <span className="ml-2 flex items-center gap-1.5">
            <span className="inline-block h-2 w-4 rounded-sm bg-white/8" /> no data / not
            deregulated
          </span>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-full border border-white/12 bg-white/5 p-1">
          {MAP_METRICS.map((m) => (
            <button
              key={m.key}
              onClick={() => setMetric(m.key)}
              className={`rounded-full px-3 py-1 text-[11px] transition-colors ${
                metric === m.key ? "bg-white/15 text-white" : "text-white/60 hover:text-white"
              }`}
              aria-pressed={metric === m.key}
            >
              {m.label}
            </button>
          ))}
        </div>
        <span className="text-[11px]" style={{ color: "var(--cc-muted)" }}>
          Shading scale: {activeMetric.unit}
        </span>
      </div>

      <div className="relative mt-5">
        <svg
          viewBox={`0 0 ${US_MAP_VIEWBOX.width} ${US_MAP_VIEWBOX.height}`}
          className="w-full"
          role="img"
          aria-label={`U.S. ${activeMetric.label} by state with ISO/RTO region overlay`}
        >
          {US_STATE_SHAPES.map((s) => {
            const r = byName.get(s.name.toLowerCase());
            const active = Boolean(r);
            return (
              <path
                key={s.fips}
                d={s.d}
                fill={fill(r)}
                fillOpacity={active ? (hover?.name === s.name ? 1 : 0.92) : 1}
                stroke={active ? "rgba(255,255,255,0.35)" : "rgba(255,255,255,0.10)"}
                strokeWidth={hover?.name === s.name ? 2 : 0.8}
                style={{ cursor: active ? "pointer" : "default" }}
                onMouseMove={(e) => {
                  const box = e.currentTarget.ownerSVGElement?.getBoundingClientRect();
                  if (!box) return;
                  setHover({ name: s.name, x: e.clientX - box.left, y: e.clientY - box.top });
                }}
                onMouseLeave={() => setHover((h) => (h?.name === s.name ? null : h))}
                onClick={() => r && onSelect(r.state)}
              />
            );
          })}

          {/* ISO/RTO boundary overlay — outlines only, split states dashed. */}
          {ISO_FOOTPRINTS.map((f) => {
            const on = isoHover?.code === f.code;
            return (
              <g key={f.code} pointerEvents="none">
                {[...f.full, ...f.partial].map((code) => {
                  const shape = CODE_TO_SHAPE.get(code);
                  if (!shape) return null;
                  const split = f.partial.includes(code);
                  return (
                    <path
                      key={`${f.code}-${code}`}
                      d={shape.d}
                      fill={on ? f.color : "transparent"}
                      fillOpacity={on ? (split ? 0.1 : 0.18) : 0}
                      stroke={f.color}
                      strokeOpacity={on ? 0.95 : 0.4}
                      strokeWidth={on ? 2 : 1}
                      strokeDasharray={split ? "4 3" : undefined}
                    />
                  );
                })}
              </g>
            );
          })}

          {/* Interactive ISO labels — hover/click to inspect that market. */}
          {ISO_FOOTPRINTS.map((f) => {
            const c = isoCentroid(f.full);
            if (!c) return null;
            const on = isoHover?.code === f.code;
            const w = f.code.length * 7 + 14;
            return (
              <g
                key={`label-${f.code}`}
                style={{ cursor: "pointer" }}
                onMouseMove={(e) => {
                  const box = e.currentTarget.ownerSVGElement?.getBoundingClientRect();
                  if (!box) return;
                  setIsoHover({ code: f.code, x: e.clientX - box.left, y: e.clientY - box.top });
                }}
                onMouseLeave={() => setIsoHover((h) => (h?.code === f.code ? null : h))}
                onClick={() => setIsoHover({ code: f.code, x: c.x, y: c.y })}
              >
                <rect
                  x={c.x - w / 2}
                  y={c.y - 9}
                  width={w}
                  height={18}
                  rx={9}
                  fill="rgba(0,0,0,0.6)"
                  stroke={f.color}
                  strokeOpacity={on ? 1 : 0.6}
                  strokeWidth={1}
                />
                <text
                  x={c.x}
                  y={c.y + 4}
                  textAnchor="middle"
                  fontSize={10}
                  fill={f.color}
                  style={{ pointerEvents: "none", letterSpacing: "0.04em" }}
                >
                  {f.code}
                </text>
              </g>
            );
          })}
        </svg>

        {isoHover && hoveredIso && (
          <div
            className="pointer-events-none absolute z-20 rounded-xl border border-white/15 bg-black/90 px-3 py-2 text-xs whitespace-nowrap backdrop-blur"
            style={{ left: isoHover.x, top: isoHover.y - 14, transform: "translate(-50%, -100%)" }}
          >
            <div className="font-medium" style={{ color: hoveredIso.color }}>
              {hoveredIsoRow?.isoName ?? hoveredIso.code}
            </div>
            <div style={{ color: "var(--cc-muted)" }}>
              {hoveredIsoRow?.priceMwh != null
                ? `$${hoveredIsoRow.priceMwh.toFixed(2)}/MWh day-ahead`
                : "no cached price"}
              {hoveredIsoRow?.spreadPct != null &&
                ` · ${hoveredIsoRow.spreadPct > 0 ? "+" : ""}${hoveredIsoRow.spreadPct.toFixed(0)}% spread`}
              {hoveredIsoRow?.loadMw != null &&
                ` · ${Math.round(hoveredIsoRow.loadMw).toLocaleString()} MW load`}
            </div>
            {hoveredIso.partial.length > 0 && (
              <div className="mt-0.5 text-[10px]" style={{ color: "var(--cc-muted)" }}>
                Split states (dashed): {hoveredIso.partial.join(", ")}
              </div>
            )}
          </div>
        )}

        {hover && !isoHover && (
          <div
            className="pointer-events-none absolute z-10 rounded-xl border border-white/15 bg-black/85 px-3 py-2 text-xs whitespace-nowrap backdrop-blur"
            style={{ left: hover.x, top: hover.y - 12, transform: "translate(-50%, -100%)" }}
          >
            <div className="font-medium">{hover.name}</div>
            <div style={{ color: "var(--cc-muted)" }}>
              {hovered
                ? `${hoveredValue !== undefined ? formatMetric(metric, hoveredValue) : "no data"} · ${
                    hovered.marketStatus === "partial" ? "Partially deregulated" : "Deregulated"
                  }`
                : hoveredMarket?.status === "partial"
                  ? "Partially deregulated · no data"
                  : "Regulated market — not actionable"}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}


/* ── Page ───────────────────────────────────────────────────────── */


export function PriorityTargetsPage({ demo = false }: { demo?: boolean }) {
  const { data } = useSuspenseQuery(intelQuery);
  const [selected, setSelected] = useState<ScoreResult | null>(null);
  const [industryFilter, setIndustryFilter] = useState("all");
  const [bandFilter, setBandFilter] = useState("all");

  const industries = rankedIntensity();
  /** Shared cache — the wholesale panel already primed this query. */
  const { data: isoData } = useQuery(isoPricesQuery);

  const unfiltered = industryFilter === "all" && bandFilter === "all";

  /**
   * Unfiltered view shows the frozen biweekly target list; filtering falls
   * back to the live leaderboard so drill-down still works.
   */
  const rows = useMemo(
    () =>
      (unfiltered ? data.targetList : data.leaderboard).filter(
        (r) =>
          (industryFilter === "all" || r.industryKey === industryFilter) &&
          (bandFilter === "all" || r.band === bandFilter),
      ),
    [data.leaderboard, data.targetList, unfiltered, industryFilter, bandFilter],
  );

  const topPick = rows[0];

  /** Rates restricted to whatever the filters leave visible. */
  const visibleRates = useMemo(() => {
    const states = new Set(rows.map((r) => r.state));
    return data.rates.rates
      .filter((r) => states.has(r.state))
      .map((r) => ({ state: r.state, stateName: r.stateName, rateCents: r.rateCents }));
  }, [data.rates.rates, rows]);

  const bestForState = (state: string) =>
    rows.find((r) => r.state === state) ?? data.leaderboard.find((r) => r.state === state) ?? null;
  const bestForIndustry = (key: string) =>
    rows.find((r) => r.industryKey === key) ??
    data.leaderboard.find((r) => r.industryKey === key) ??
    null;

  const dataMonth = monthLabel(data.rates.dataMonth);
  const selectedRate = selected ? data.rates.rates.find((r) => r.state === selected.state) : undefined;

  return (
    <main className="pipeline-scope min-h-screen">
      <div
        className="min-h-screen"
        style={{
          backgroundImage:
            "radial-gradient(900px 500px at 12% -8%, oklch(0.62 0.24 300 / 0.22), transparent 60%), radial-gradient(760px 420px at 92% 0%, oklch(0.82 0.15 55 / 0.16), transparent 62%)",
        }}
      >
        <header className="border-b border-white/10">
          <div className="mx-auto grid max-w-7xl grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-6 py-5 sm:flex sm:justify-between">
            <div className="flex min-w-0 items-baseline gap-3">
              <span className="headline text-lg">WaveClimate</span>
              <span className="eyebrow truncate" style={{ color: "var(--cc-muted)" }}>
                Market Intelligence
              </span>
            </div>
            <nav className="flex items-center gap-5 text-sm">
              {demo && <DemoBadge />}
              <Link
                to={demo ? "/demo/app" : "/app"}
                className="text-white/60 transition-colors hover:text-white"
              >
                Lead Engine
              </Link>
              <Link
                to={demo ? "/demo/pipeline" : "/pipeline"}
                className="text-white/60 transition-colors hover:text-white"
              >
                Pipeline
              </Link>
              <Link
                to={demo ? "/demo/priority-targets" : "/priority-targets"}
                className="font-medium text-white"
              >
                Market Intel
              </Link>
            </nav>
          </div>
        </header>

        <section className="mx-auto max-w-7xl px-6 py-8">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-4 sm:flex sm:justify-between">
            <div className="min-w-0">
              <h1 className="headline text-2xl">
                Where the <span className="grad-text">best opportunities</span> are
              </h1>
              <p className="mt-1 text-[11px]" style={{ color: "var(--cc-muted)" }}>
                Target list refreshes every 2 weeks · generated{" "}
                {periodDateLabel(data.period.generatedAt)}, next{" "}
                {periodDateLabel(data.period.nextRefreshAt)}. CBECS {CBECS_SOURCE.dataDate}{" "}
                intensity · EIA retail rates, data month {dataMonth} · Census CBP{" "}
                {CBP_VINTAGE.dataLabel}. Government data with reporting lag.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 text-xs">
              <select
                value={industryFilter}
                onChange={(e) => setIndustryFilter(e.target.value)}
                className="rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-white"
                aria-label="Filter by industry"
              >
                <option value="all">All industries</option>
                {industries.map((i) => (
                  <option key={i.key} value={i.key} className="text-black">
                    {i.label}
                  </option>
                ))}
              </select>
              <select
                value={bandFilter}
                onChange={(e) => setBandFilter(e.target.value)}
                className="rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-white"
                aria-label="Filter by priority"
              >
                <option value="all">All priorities</option>
                <option value="high" className="text-black">High</option>
                <option value="medium" className="text-black">Medium</option>
                <option value="low" className="text-black">Low</option>
              </select>
            </div>
          </div>

          {(data.rates.error || data.density.error) && (
            <div className="glass-panel mt-5 rounded-2xl p-4 text-xs text-amber-200">
              {data.rates.error && <div>EIA retail rates unavailable: {data.rates.error}</div>}
              {data.density.error && <div>Census density unavailable: {data.density.error}</div>}
            </div>
          )}

          <div className="mt-6">
            {topPick ? (
              <HeroCard row={topPick} period={data.period} demo={demo} onOpen={() => setSelected(topPick)} />
            ) : (
              <div className="glass-panel rounded-3xl p-8 text-sm" style={{ color: "var(--cc-muted)" }}>
                No industry + state combination matches these filters.
              </div>
            )}
            <RunnersUp rows={rows.slice(1, 11)} demo={demo} onOpen={(r) => setSelected(r)} />
          </div>

          <div className="mt-5 grid gap-5 lg:grid-cols-3">
            <StateRatesPanel
              rates={visibleRates}
              onSelect={(state) => {
                const row = bestForState(state);
                if (row) setSelected(row);
              }}
            />
            <IntensityPanel
              onSelect={(key) => {
                const row = bestForIndustry(key);
                if (row) setSelected(row);
              }}
            />
            <GridDemandWidget grid={data.grid} />
          </div>

          <IsoWholesalePanel />


          <UsRateMap
            {...(isoData ? { iso: isoData } : {})}
            leaderboard={data.leaderboard}
            rates={data.rates.rates.map((r) => ({
              state: r.state,
              stateName: r.stateName,
              rateCents: r.rateCents,
              marketStatus: r.marketStatus,
            }))}
            onSelect={(state) => {
              const row = bestForState(state);
              if (row) setSelected(row);
            }}
          />
        </section>

      </div>

      {selected && (
        <DetailPanel
          row={selected}
          {...(selectedRate ? { rate: selectedRate } : {})}
          {...(data.steo ? { steo: data.steo } : {})}

          onClose={() => setSelected(null)}
        />
      )}
    </main>
  );
}
