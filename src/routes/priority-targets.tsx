import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";

import { CBECS_SOURCE, intensityForIndustry, rankedIntensity } from "@/data/energy-intensity";
import { naicsForIndustry, CBP_VINTAGE } from "@/data/naics-map";
import { getMarketIntel } from "@/lib/market-intel.functions";
import { bandLabel, type PriorityBand, type ScoreResult } from "@/lib/priority-score";

const intelQuery = queryOptions({
  queryKey: ["market-intel"],
  queryFn: () => getMarketIntel(),
  staleTime: 60 * 60 * 1000,
});

export const Route = createFileRoute("/priority-targets")({
  loader: ({ context }) => context.queryClient.ensureQueryData(intelQuery),
  head: () => ({
    meta: [
      { title: "Market Intelligence — WaveClimate Lead Engine" },
      {
        name: "description",
        content:
          "Single-view market intelligence dashboard: energy intensity in kBtu/sq ft, commercial electricity rates and establishment density across deregulated states.",
      },
      { property: "og:title", content: "Market Intelligence — WaveClimate Lead Engine" },
      {
        property: "og:description",
        content:
          "Scatter map of industry + state opportunities scored on CBECS intensity, EIA retail rates and Census density.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PriorityTargetsPage,
  errorComponent: ({ error }) => (
    <main className="pipeline-scope flex min-h-screen items-center justify-center px-6">
      <p role="alert" className="text-sm text-white/70">
        Market intelligence didn't load: {error.message}
      </p>
    </main>
  ),
  notFoundComponent: () => (
    <main className="pipeline-scope flex min-h-screen items-center justify-center">
      <p className="text-sm text-white/70">Nothing here.</p>
    </main>
  ),
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

const BAND_COLOR: Record<PriorityBand, string> = {
  high: "oklch(0.78 0.17 155)",
  medium: "oklch(0.83 0.15 85)",
  low: "oklch(0.68 0.20 20)",
};

function bandTone(band: PriorityBand) {
  return band === "high"
    ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-200"
    : band === "medium"
      ? "border-amber-400/30 bg-amber-400/10 text-amber-200"
      : "border-rose-400/30 bg-rose-400/10 text-rose-200";
}

function rowId(r: { industryKey: string; state: string }) {
  return `${r.industryKey}|${r.state}`;
}

function euiFor(r: ScoreResult) {
  return r.siteEui ?? intensityForIndustry(r.industryKey)?.siteEui ?? 0;
}

/* ── Scatter / bubble chart ─────────────────────────────────────── */

function ScatterChart({
  rows,
  selectedId,
  onSelect,
}: {
  rows: ScoreResult[];
  selectedId: string | null;
  onSelect: (r: ScoreResult) => void;
}) {
  const [hover, setHover] = useState<{ r: ScoreResult; x: number; y: number } | null>(null);

  const w = 720;
  const h = 460;
  const pad = { l: 62, r: 22, t: 18, b: 52 };
  const plotW = w - pad.l - pad.r;
  const plotH = h - pad.t - pad.b;

  const pts = rows.filter((r) => r.rateCents !== undefined && euiFor(r) > 0);

  const rateVals = pts.map((r) => r.rateCents!);
  const euiVals = pts.map((r) => euiFor(r));
  const minRate = Math.min(...rateVals, 8) * 0.94;
  const maxRate = Math.max(...rateVals, 12) * 1.06;
  const maxEui = Math.max(...euiVals, 10) * 1.08;
  const maxEstab = Math.max(...pts.map((r) => r.establishments ?? 0), 1);

  const x = (v: number) => pad.l + ((v - minRate) / (maxRate - minRate || 1)) * plotW;
  const y = (v: number) => pad.t + plotH - (v / (maxEui || 1)) * plotH;
  const radius = (n?: number) => (n === undefined ? 5 : 5 + Math.sqrt(n / maxEstab) * 18);

  const yTicks = 5;
  const xTicks = 5;

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full" role="img" aria-label="Rate vs energy intensity scatter">
        {Array.from({ length: yTicks + 1 }, (_, i) => {
          const v = (maxEui / yTicks) * i;
          return (
            <g key={`y${i}`}>
              <line
                x1={pad.l}
                x2={w - pad.r}
                y1={y(v)}
                y2={y(v)}
                stroke="rgba(255,255,255,0.10)"
                strokeWidth={1}
              />
              <text x={pad.l - 10} y={y(v) + 4} textAnchor="end" fontSize={11} fill="rgba(255,255,255,0.5)">
                {Math.round(v)}
              </text>
            </g>
          );
        })}
        {Array.from({ length: xTicks + 1 }, (_, i) => {
          const v = minRate + ((maxRate - minRate) / xTicks) * i;
          return (
            <text
              key={`x${i}`}
              x={x(v)}
              y={h - pad.b + 20}
              textAnchor="middle"
              fontSize={11}
              fill="rgba(255,255,255,0.5)"
            >
              {v.toFixed(1)}
            </text>
          );
        })}
        <text
          transform={`translate(16 ${pad.t + plotH / 2}) rotate(-90)`}
          textAnchor="middle"
          fontSize={12}
          fill="rgba(255,255,255,0.65)"
        >
          Energy intensity (kBtu/sq ft)
        </text>
        <text
          x={pad.l + plotW / 2}
          y={h - 8}
          textAnchor="middle"
          fontSize={12}
          fill="rgba(255,255,255,0.65)"
        >
          Commercial rate (¢/kWh)
        </text>

        {pts.map((r) => {
          const id = rowId(r);
          const sel = id === selectedId;
          return (
            <circle
              key={id}
              cx={x(r.rateCents!)}
              cy={y(euiFor(r))}
              r={radius(r.establishments)}
              fill={BAND_COLOR[r.band]}
              fillOpacity={sel ? 0.6 : 0.28}
              stroke={BAND_COLOR[r.band]}
              strokeWidth={sel ? 2.5 : 1.2}
              className="cursor-pointer transition-[fill-opacity]"
              onMouseEnter={(e) =>
                setHover({ r, x: e.nativeEvent.offsetX, y: e.nativeEvent.offsetY })
              }
              onMouseLeave={() => setHover(null)}
              onClick={() => onSelect(r)}
            />
          );
        })}
      </svg>

      {hover && (
        <div
          className="pointer-events-none absolute z-20 w-56 rounded-xl border border-white/15 bg-black/85 p-3 text-[11px] leading-relaxed backdrop-blur"
          style={{
            left: Math.min(hover.x + 12, 420),
            top: Math.max(hover.y - 10, 0),
          }}
        >
          <div className="text-sm font-medium">{hover.r.industryLabel}</div>
          <div style={{ color: "var(--cc-muted)" }}>{hover.r.stateName}</div>
          <div className="mt-1.5 space-y-0.5">
            <div>Rate: {hover.r.rateCents?.toFixed(2)}¢/kWh</div>
            <div>Intensity: {euiFor(hover.r)} kBtu/sq ft</div>
            <div>
              Establishments:{" "}
              {hover.r.establishments !== undefined
                ? hover.r.establishments.toLocaleString()
                : "n/a"}
            </div>
            <div>
              Priority: {bandLabel(hover.r.band)} · {hover.r.score.toFixed(0)}
            </div>
          </div>
        </div>
      )}

      <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-2 text-[11px]" style={{ color: "var(--cc-muted)" }}>
        {(["high", "medium", "low"] as PriorityBand[]).map((b) => (
          <span key={b} className="flex items-center gap-1.5">
            <span
              className="inline-block h-2.5 w-2.5 rounded-full"
              style={{ background: BAND_COLOR[b] }}
            />
            {bandLabel(b)} priority
          </span>
        ))}
        <span>Bubble size = establishments found (Census CBP)</span>
      </div>
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
        <span className="text-sm font-medium">{stateName} commercial rate history</span>
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
                <line
                  x1={pad.l}
                  x2={w - pad.r}
                  y1={y(v)}
                  y2={y(v)}
                  stroke="rgba(255,255,255,0.10)"
                />
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
              <circle
                cx={x(i)}
                cy={y(p.rateCents)}
                r={hover === i ? 5 : 3}
                fill="oklch(0.66 0.26 340)"
              />
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
    { label: "Commercial rate", value: row.rateCents !== undefined ? `${row.rateCents.toFixed(2)}¢/kWh` : "n/a" },
    { label: "Energy intensity", value: euiFor(row) ? `${euiFor(row)} kBtu/sq ft` : "n/a" },
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
      <button
        aria-label="Close detail"
        onClick={onClose}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
      />
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

        <span
          className={`mt-3 inline-block rounded-full border px-2.5 py-1 text-[11px] font-medium ${bandTone(row.band)}`}
        >
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
          {row.reason}
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

/* ── Page ───────────────────────────────────────────────────────── */

function PriorityTargetsPage() {
  const { data } = useSuspenseQuery(intelQuery);
  const [selected, setSelected] = useState<ScoreResult | null>(null);
  const [industryFilter, setIndustryFilter] = useState("all");
  const [bandFilter, setBandFilter] = useState("all");

  const intensity = rankedIntensity();

  const rows = useMemo(
    () =>
      data.leaderboard.filter(
        (r) =>
          (industryFilter === "all" || r.industryKey === industryFilter) &&
          (bandFilter === "all" || r.band === bandFilter),
      ),
    [data.leaderboard, industryFilter, bandFilter],
  );

  const dataMonth = monthLabel(data.rates.dataMonth);
  const selectedRate = selected
    ? data.rates.rates.find((r) => r.state === selected.state)
    : undefined;

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
              <Link to="/" className="text-white/60 transition-colors hover:text-white">
                Lead Engine
              </Link>
              <Link to="/pipeline" className="text-white/60 transition-colors hover:text-white">
                Pipeline
              </Link>
              <Link to="/priority-targets" className="font-medium text-white">
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
                {intensity.map((i) => (
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
              {data.density.error && (
                <div>Census density unavailable: {data.density.error}</div>
              )}
            </div>
          )}

          <div className="mt-6 grid gap-5 lg:grid-cols-[3fr_2fr]">
            {/* Scatter */}
            <div className="glass-panel rounded-2xl p-5">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <div className="eyebrow" style={{ color: "var(--cc-muted)" }}>
                  Rate vs. energy intensity
                </div>
                <div className="text-[11px]" style={{ color: "var(--cc-muted)" }}>
                  {rows.length} combinations
                </div>
              </div>
              <div className="mt-3">
                <ScatterChart
                  rows={rows}
                  selectedId={selected ? rowId(selected) : null}
                  onSelect={setSelected}
                />
              </div>
            </div>

            {/* Leaderboard */}
            <div className="glass-panel rounded-2xl p-5">
              <div className="eyebrow" style={{ color: "var(--cc-muted)" }}>
                Ranked opportunities
              </div>
              <div className="mt-3 max-h-[520px] divide-y divide-white/8 overflow-y-auto pr-1">
                {rows.length === 0 && (
                  <p className="py-6 text-sm" style={{ color: "var(--cc-muted)" }}>
                    No combinations match these filters.
                  </p>
                )}
                {rows.map((row, i) => {
                  const id = rowId(row);
                  const active = selected && rowId(selected) === id;
                  return (
                    <button
                      key={id}
                      onClick={() => setSelected(row)}
                      className={`grid w-full grid-cols-[1.25rem_minmax(0,1fr)_auto] items-center gap-3 py-2.5 text-left transition-colors hover:bg-white/6 ${
                        active ? "bg-white/8" : ""
                      }`}
                    >
                      <span className="text-[11px] tabular-nums" style={{ color: "var(--cc-muted)" }}>
                        {i + 1}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium">
                          {row.industryLabel}
                        </span>
                        <span
                          className="block truncate text-[11px]"
                          style={{ color: "var(--cc-muted)" }}
                        >
                          {row.stateName} · {euiFor(row)} kBtu/sq ft ·{" "}
                          {row.rateCents !== undefined ? `${row.rateCents.toFixed(1)}¢` : "n/a"}
                        </span>
                      </span>
                      <span
                        className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-medium tabular-nums ${bandTone(row.band)}`}
                      >
                        {row.score.toFixed(0)}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
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
