import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";

import { DemoBadge } from "@/components/DemoBadge";
import { lookupMarket } from "@/data/deregulated-markets";
import { CBECS_SOURCE, intensityForIndustry, rankedIntensity } from "@/data/energy-intensity";
import { naicsForIndustry, CBP_VINTAGE } from "@/data/naics-map";
import { US_MAP_VIEWBOX, US_STATE_SHAPES } from "@/data/us-state-paths";

import { getMarketIntel } from "@/lib/market-intel.functions";
import { bandLabel, type PriorityBand, type ScoreResult } from "@/lib/priority-score";

export const intelQuery = queryOptions({
  queryKey: ["market-intel"],
  queryFn: () => getMarketIntel(),
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

/* ── 1. Hero: today's top pick ──────────────────────────────────── */

function HeroCard({ row, onOpen }: { row: ScoreResult; onOpen: () => void }) {
  const stats = [
    {
      label: "Commercial electricity rate",
      value: row.rateCents !== undefined ? `${row.rateCents.toFixed(2)}¢` : "n/a",
      unit: "per kWh",
    },
    {
      label: "Energy intensity",
      value: euiFor(row) ? `${euiFor(row)}` : "n/a",
      unit: "kBtu/sq ft/year",
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
    <button
      onClick={onOpen}
      className="glass-panel block w-full rounded-3xl p-6 text-left transition-colors hover:bg-white/6 sm:p-8"
    >
      <div className="flex flex-wrap items-center gap-3">
        <span className="eyebrow" style={{ color: "var(--cc-muted)" }}>
          Today's top pick
        </span>
        <span
          className={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${bandTone(row.band)}`}
        >
          {bandLabel(row.band)} priority · {row.score.toFixed(0)}
        </span>
      </div>

      <h2 className="headline mt-3 text-3xl sm:text-4xl">
        <span className="grad-text">{row.industryLabel}</span> in {row.stateName}
      </h2>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-2xl border border-white/10 bg-white/4 p-4">
            <div className="text-2xl font-semibold tabular-nums sm:text-3xl">{s.value}</div>
            <div className="mt-1 text-[11px]" style={{ color: "var(--cc-muted)" }}>
              {s.unit}
            </div>
            <div className="eyebrow mt-2 text-[10px]">{s.label}</div>
          </div>
        ))}
      </div>

      <p className="mt-5 text-sm" style={{ color: "var(--cc-muted)" }}>
        {electricReason(row)}
      </p>
    </button>
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

/* ── 3. Energy intensity by industry (reference) ────────────────── */

function IntensityPanel({ onSelect }: { onSelect: (industryKey: string) => void }) {
  const [showAll, setShowAll] = useState(false);
  const all = rankedIntensity().filter((e) => e.siteEui !== undefined);
  const shown = showAll ? all : all.slice(0, 5);
  const max = all[0]?.siteEui ?? 1;

  return (
    <div className="rounded-2xl border border-white/8 bg-white/3 p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="eyebrow" style={{ color: "var(--cc-muted)" }}>
          Total combined energy intensity (kBtu/sq ft/year)
        </div>
        <span
          className="rounded-full border border-white/12 px-2 py-0.5 text-[10px]"
          style={{ color: "var(--cc-muted)" }}
        >
          Reference data
        </span>
      </div>
      <p className="mt-1 text-[11px]" style={{ color: "var(--cc-muted)" }}>
        Electricity + natural gas · CBECS {CBECS_SOURCE.dataDate}
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
                    style={{ width: `${((e.siteEui ?? 0) / max) * 100}%` }}
                  />
                </span>
              </span>
              <span className="text-sm font-semibold tabular-nums">{e.siteEui}</span>
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

function hourLabel(period: string) {
  const m = period.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2})/);
  if (!m) return period;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4])));
  // Pinned to UTC so server-rendered and client-rendered labels always match.
  return d.toLocaleTimeString("en-US", { hour: "numeric", timeZone: "UTC" });
}

function hourStamp(period: string) {
  const m = period.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2})/);
  if (!m) return period;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4])));
  return `${d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    timeZone: "UTC",
  })} UTC`;
}


function GridDemandWidget({
  grid,
}: {
  grid: {
    latest?: { period: string; mw: number };
    history: { period: string; mw: number }[];
    regionName: string;
    error?: string;
  };
}) {
  const [age, setAge] = useState<number | null>(null);
  const [hover, setHover] = useState<number | null>(null);
  useEffect(() => {
    if (grid.latest) setAge(hoursAgo(grid.latest.period));
  }, [grid.latest]);

  const pts = grid.history;
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
  const path = pts.length > 1 ? pts.map((p, i) => `${i === 0 ? "M" : "L"}${x(i)},${y(p.mw)}`).join(" ") : "";
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

      {grid.error || !grid.latest ? (
        <p className="mt-4 text-xs text-amber-200">
          Grid demand unavailable{grid.error ? `: ${grid.error}` : "."}
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
            {grid.regionName} · last 24 hours
          </div>

          {path && (
            <div className="relative mt-3">
              <svg viewBox={`0 0 ${w} ${h}`} className="w-full" role="img" aria-label="24-hour grid demand">
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
                        {hourLabel(p.period)}
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
                  {hourStamp(pts[hover]!.period)}: {Math.round(pts[hover]!.mw).toLocaleString()} MW
                </div>
              )}
            </div>
          )}

          <p className="mt-3 text-[11px]" style={{ color: "var(--cc-muted)" }}>
            Total grid load (power), updated hourly — not a customer demand charge. Source: EIA-930
            Hourly Electric Grid Monitor.
          </p>
        </>
      )}
    </div>
  );
}


/* ── Rate trend line chart with axes + tooltips ─────────────────── */

function RateHistoryChart({
  history,
  stateName,
  trendPct,
}: {
  history: { period: string; rateCents: number }[];
  stateName: string;
  trendPct?: number;
}) {
  const [hover, setHover] = useState<number | null>(null);
  if (history.length < 2) return null;

  const w = 520;
  const h = 220;
  const pad = { l: 46, r: 14, t: 14, b: 38 };
  const plotW = w - pad.l - pad.r;
  const plotH = h - pad.t - pad.b;

  const values = history.map((p) => p.rateCents);
  const min = Math.min(...values) * 0.97;
  const max = Math.max(...values) * 1.03;
  const x = (i: number) => pad.l + (i / (history.length - 1)) * plotW;
  const y = (v: number) => pad.t + plotH - ((v - min) / (max - min || 1)) * plotH;
  const path = history.map((p, i) => `${i === 0 ? "M" : "L"}${x(i)},${y(p.rateCents)}`).join(" ");

  const dir =
    trendPct === undefined ? "flat" : trendPct > 0.005 ? "rising" : trendPct < -0.005 ? "falling" : "flat";

  const ticks = 4;
  const xLabelEvery = Math.max(1, Math.ceil(history.length / 6));

  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-sm font-medium">{stateName} commercial electricity rate history</span>
        <span className="text-xs" style={{ color: "var(--cc-muted)" }}>
          Trend {dir}
          {trendPct !== undefined ? ` (${(trendPct * 100).toFixed(1)}% vs. 3 months prior)` : ""}
        </span>
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

          <path d={path} fill="none" stroke="oklch(0.66 0.26 340)" strokeWidth={2.5} />

          {history.map((p, i) => (
            <g key={p.period}>
              <circle cx={x(i)} cy={y(p.rateCents)} r={hover === i ? 5 : 3} fill="oklch(0.66 0.26 340)" />
              <rect
                x={x(i) - plotW / (history.length * 2)}
                y={pad.t}
                width={plotW / history.length}
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

        {hover !== null && history[hover] && (
          <div
            className="pointer-events-none absolute -top-1 rounded-lg border border-white/15 bg-black/85 px-2.5 py-1.5 text-[11px] backdrop-blur"
            style={{ left: `${(x(hover) / w) * 100}%`, transform: "translateX(-50%)" }}
          >
            {monthLabel(history[hover]!.period)}: {history[hover]!.rateCents.toFixed(2)}¢/kWh
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Detail side panel ──────────────────────────────────────────── */

function DetailPanel({
  row,
  rate,
  onClose,
}: {
  row: ScoreResult;
  rate?: { stateName: string; trendPct?: number; history: { period: string; rateCents: number }[] };
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const ci = intensityForIndustry(row.industryKey);
  const naics = naicsForIndustry(row.industryKey);

  const stats: { label: string; value: string }[] = [
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
    { label: "Priority score", value: `${row.score.toFixed(0)} / 100` },
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

        <div className="mt-6">
          {rate ? (
            <RateHistoryChart
              history={rate.history}
              stateName={rate.stateName}
              {...(rate.trendPct !== undefined ? { trendPct: rate.trendPct } : {})}
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

function RunnersUp({ rows, onOpen }: { rows: ScoreResult[]; onOpen: (r: ScoreResult) => void }) {
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
            <li key={`${r.industryKey}-${r.state}`}>
              <button
                onClick={() => onOpen(r)}
                className="grid w-full grid-cols-[1.4rem_minmax(0,1fr)_auto_auto] items-center gap-3 rounded-xl border border-white/8 bg-white/3 px-3 py-2.5 text-left transition-colors hover:bg-white/8"
              >
                <span className="text-[11px] tabular-nums" style={{ color: "var(--cc-muted)" }}>
                  {i + 2}
                </span>
                <span className="min-w-0 truncate text-sm">
                  {r.industryLabel} <span style={{ color: "var(--cc-muted)" }}>· {r.stateName}</span>
                </span>
                <span className="text-xs tabular-nums" style={{ color: "var(--cc-muted)" }}>
                  {r.rateCents !== undefined ? `${r.rateCents.toFixed(1)}¢` : "—"} ·{" "}
                  {euiFor(r) ? `${euiFor(r)} kBtu/sq ft/year` : "—"}
                </span>
                <span
                  className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${bandTone(r.band)}`}
                >
                  {r.score.toFixed(0)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ── U.S. rate choropleth ───────────────────────────────────────── */

interface MapRate {
  state: string;
  stateName: string;
  rateCents: number;
  marketStatus: "deregulated" | "partial";
}

function UsRateMap({ rates, onSelect }: { rates: MapRate[]; onSelect: (state: string) => void }) {
  const [hover, setHover] = useState<{ name: string; x: number; y: number } | null>(null);

  const byName = useMemo(() => new Map(rates.map((r) => [r.stateName.toLowerCase(), r])), [rates]);
  const values = rates.map((r) => r.rateCents);
  const lo = Math.min(...values, Infinity);
  const hi = Math.max(...values, -Infinity);

  const fill = (r?: MapRate) => {
    if (!r) return "rgba(255,255,255,0.05)";
    const t = hi > lo ? (r.rateCents - lo) / (hi - lo) : 0.5;
    const l = 0.82 - t * 0.28;
    const c = 0.06 + t * 0.2;
    const hue = 55 - t * 100;
    return `oklch(${l.toFixed(3)} ${c.toFixed(3)} ${hue.toFixed(0)})`;
  };

  const hovered = hover ? byName.get(hover.name.toLowerCase()) : undefined;
  const hoveredMarket = hover ? lookupMarket(hover.name) : undefined;

  return (
    <section className="glass-panel mt-6 rounded-3xl p-6 sm:p-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="eyebrow" style={{ color: "var(--cc-muted)" }}>
            Map — commercial electricity rate by state
          </div>
          <h2 className="headline mt-1 text-xl">
            Where power costs the most in <span className="grad-text">open markets</span>
          </h2>
        </div>
        <div className="flex items-center gap-3 text-[11px]" style={{ color: "var(--cc-muted)" }}>
          <span>{lo === Infinity ? "" : `${lo.toFixed(1)}¢`}</span>
          <span
            className="h-2 w-32 rounded-full"
            style={{
              background:
                "linear-gradient(90deg, oklch(0.82 0.06 55), oklch(0.68 0.16 5), oklch(0.54 0.26 315))",
            }}
          />
          <span>{hi === -Infinity ? "" : `${hi.toFixed(1)}¢`}</span>
          <span className="ml-2 flex items-center gap-1.5">
            <span className="inline-block h-2 w-4 rounded-sm bg-white/8" /> not deregulated
          </span>
        </div>
      </div>

      <div className="relative mt-5">
        <svg
          viewBox={`0 0 ${US_MAP_VIEWBOX.width} ${US_MAP_VIEWBOX.height}`}
          className="w-full"
          role="img"
          aria-label="U.S. commercial electricity rates by state"
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
        </svg>

        {hover && (
          <div
            className="pointer-events-none absolute z-10 rounded-xl border border-white/15 bg-black/85 px-3 py-2 text-xs whitespace-nowrap backdrop-blur"
            style={{ left: hover.x, top: hover.y - 12, transform: "translate(-50%, -100%)" }}
          >
            <div className="font-medium">{hover.name}</div>
            <div style={{ color: "var(--cc-muted)" }}>
              {hovered
                ? `${hovered.rateCents.toFixed(2)}¢/kWh · ${
                    hovered.marketStatus === "partial" ? "Partially deregulated" : "Deregulated"
                  }`
                : hoveredMarket?.status === "partial"
                  ? "Partially deregulated · no rate data"
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

  const rows = useMemo(
    () =>
      data.leaderboard.filter(
        (r) =>
          (industryFilter === "all" || r.industryKey === industryFilter) &&
          (bandFilter === "all" || r.band === bandFilter),
      ),
    [data.leaderboard, industryFilter, bandFilter],
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
                CBECS {CBECS_SOURCE.dataDate} intensity · EIA retail rates, data month {dataMonth} ·
                Census CBP {CBP_VINTAGE.dataLabel}. Government data with reporting lag.
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
              <HeroCard row={topPick} onOpen={() => setSelected(topPick)} />
            ) : (
              <div className="glass-panel rounded-3xl p-8 text-sm" style={{ color: "var(--cc-muted)" }}>
                No industry + state combination matches these filters.
              </div>
            )}
            <RunnersUp rows={rows.slice(1, 11)} onOpen={(r) => setSelected(r)} />
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

          <UsRateMap
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
          onClose={() => setSelected(null)}
        />
      )}
    </main>
  );
}
