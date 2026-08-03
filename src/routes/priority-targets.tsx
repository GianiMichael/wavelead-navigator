import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";

import { CBECS_SOURCE, intensityForIndustry, rankedIntensity } from "@/data/energy-intensity";
import { naicsForIndustry, CBP_VINTAGE } from "@/data/naics-map";
import { getMarketIntel } from "@/lib/market-intel.functions";
import { bandLabel, type PriorityBand } from "@/lib/priority-score";

const intelQuery = queryOptions({
  queryKey: ["market-intel"],
  queryFn: () => getMarketIntel(),
  staleTime: 60 * 60 * 1000,
});

export const Route = createFileRoute("/priority-targets")({
  loader: ({ context }) => context.queryClient.ensureQueryData(intelQuery),
  head: () => ({
    meta: [
      { title: "Priority Targets — WaveClimate Lead Engine" },
      {
        name: "description",
        content:
          "Rank industry + state opportunities by energy intensity, commercial electricity rates and market density using EIA and Census data.",
      },
      { property: "og:title", content: "Priority Targets — WaveClimate Lead Engine" },
      {
        property: "og:description",
        content:
          "Market intelligence leaderboard combining CBECS energy intensity, EIA retail rates and Census establishment density.",
      },
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

function bandTone(band: PriorityBand) {
  return band === "high"
    ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-200"
    : band === "medium"
      ? "border-amber-400/30 bg-amber-400/10 text-amber-200"
      : "border-rose-400/30 bg-rose-400/10 text-rose-200";
}

function Bar({
  label,
  value,
  max,
  suffix,
  highlight,
  sub,
}: {
  label: string;
  value: number;
  max: number;
  suffix?: string;
  highlight?: boolean;
  sub?: string;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-4">
        <span className={`text-sm ${highlight ? "font-semibold" : ""}`}>{label}</span>
        <span className="text-xs tabular-nums" style={{ color: "var(--cc-muted)" }}>
          {value.toLocaleString(undefined, { maximumFractionDigits: 1 })}
          {suffix ?? ""}
        </span>
      </div>
      <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-white/8">
        <div
          className={highlight ? "grad-fill h-full rounded-full" : "h-full rounded-full bg-white/25"}
          style={{ width: `${max > 0 ? (value / max) * 100 : 0}%` }}
        />
      </div>
      {sub && (
        <div className="mt-1.5 text-[11px]" style={{ color: "var(--cc-muted)" }}>
          {sub}
        </div>
      )}
    </div>
  );
}

function RateHistoryChart({
  history,
  stateName,
  trendPct,
}: {
  history: { period: string; rateCents: number }[];
  stateName: string;
  trendPct?: number;
}) {
  if (history.length < 2) return null;
  const w = 560;
  const h = 140;
  const values = history.map((p) => p.rateCents);
  const min = Math.min(...values) * 0.97;
  const max = Math.max(...values) * 1.03;
  const x = (i: number) => (i / (history.length - 1)) * w;
  const y = (v: number) => h - ((v - min) / (max - min || 1)) * h;
  const path = history.map((p, i) => `${i === 0 ? "M" : "L"}${x(i)},${y(p.rateCents)}`).join(" ");

  const dir =
    trendPct === undefined ? "flat" : trendPct > 0.005 ? "rising" : trendPct < -0.005 ? "falling" : "flat";

  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-sm font-medium">{stateName} commercial rate history</span>
        <span className="text-xs" style={{ color: "var(--cc-muted)" }}>
          Trend {dir}
          {trendPct !== undefined ? ` (${(trendPct * 100).toFixed(1)}% vs. 3 months prior)` : ""}
        </span>
      </div>
      <svg viewBox={`0 0 ${w} ${h}`} className="mt-4 h-36 w-full" preserveAspectRatio="none">
        <path d={path} fill="none" stroke="oklch(0.66 0.26 340)" strokeWidth={2.5} />
      </svg>
      <div className="flex justify-between text-[11px]" style={{ color: "var(--cc-muted)" }}>
        <span>{monthLabel(history[0]!.period)}</span>
        <span>{monthLabel(history[history.length - 1]!.period)}</span>
      </div>
    </div>
  );
}

function PriorityTargetsPage() {
  const { data } = useSuspenseQuery(intelQuery);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [industryFilter, setIndustryFilter] = useState("all");
  const [bandFilter, setBandFilter] = useState("all");

  const intensity = rankedIntensity();
  const maxIntensity = Math.max(...intensity.map((r) => r.score));

  const rates = [...data.rates.rates].sort((a, b) => b.rateCents - a.rateCents);
  const maxRate = rates.length ? rates[0]!.rateCents : 0;

  const rows = useMemo(
    () =>
      data.leaderboard.filter(
        (r) =>
          (industryFilter === "all" || r.industryKey === industryFilter) &&
          (bandFilter === "all" || r.band === bandFilter),
      ),
    [data.leaderboard, industryFilter, bandFilter],
  );

  const densityByIndustry = useMemo(() => {
    const map = new Map<string, { state: string; establishments: number }[]>();
    for (const r of data.density.rows) {
      const list = map.get(r.industryKey) ?? [];
      list.push({ state: r.state, establishments: r.establishments });
      map.set(r.industryKey, list);
    }
    return map;
  }, [data.density.rows]);

  const dataMonth = monthLabel(data.rates.dataMonth);

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
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-6">
            <div className="flex items-baseline gap-3">
              <span className="headline text-lg">WaveClimate</span>
              <span className="eyebrow" style={{ color: "var(--cc-muted)" }}>
                Priority Targets
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
                Priority Targets
              </Link>
            </nav>
          </div>
        </header>

        <section className="mx-auto max-w-6xl px-6 py-12">
          <h1 className="headline text-3xl">
            Where the <span className="grad-text">best opportunities</span> are
          </h1>
          <p className="mt-2 max-w-2xl text-sm" style={{ color: "var(--cc-muted)" }}>
            Every industry + deregulated state combination, scored on energy intensity, current
            commercial rate, rate trend and market density. Click any row to see the underlying
            data.
          </p>
          <p className="mt-3 text-xs" style={{ color: "var(--cc-muted)" }}>
            Sources: {CBECS_SOURCE.name} {CBECS_SOURCE.dataDate} · EIA retail sales, data month{" "}
            {dataMonth} · Census CBP {CBP_VINTAGE.dataLabel}. Government data with reporting lag —
            not real-time.
          </p>

          {(data.rates.error || data.density.error) && (
            <div className="glass-panel mt-6 rounded-2xl p-4 text-xs text-amber-200">
              {data.rates.error && <div>EIA retail rates unavailable: {data.rates.error}</div>}
              {data.density.error && (
                <div>Census density unavailable: {data.density.error} Scores fall back to the
                  signals that did load.</div>
              )}
            </div>
          )}

          {/* Leaderboard */}
          <div className="glass-panel mt-10 rounded-2xl p-6 sm:p-8">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="eyebrow" style={{ color: "var(--cc-muted)" }}>
                Ranked opportunities
              </div>
              <div className="flex flex-wrap gap-2 text-xs">
                <select
                  value={industryFilter}
                  onChange={(e) => setIndustryFilter(e.target.value)}
                  className="rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-white"
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
                >
                  <option value="all">All priorities</option>
                  <option value="high" className="text-black">High</option>
                  <option value="medium" className="text-black">Medium</option>
                  <option value="low" className="text-black">Low</option>
                </select>
              </div>
            </div>

            <div className="mt-6 divide-y divide-white/8">
              {rows.length === 0 && (
                <p className="py-6 text-sm" style={{ color: "var(--cc-muted)" }}>
                  No combinations match these filters.
                </p>
              )}
              {rows.slice(0, 60).map((row, i) => {
                const id = `${row.industryKey}|${row.state}`;
                const open = expanded === id;
                const rate = data.rates.rates.find((r) => r.state === row.state);
                const industryDensity = (densityByIndustry.get(row.industryKey) ?? [])
                  .slice()
                  .sort((a, b) => b.establishments - a.establishments)
                  .slice(0, 10);
                const maxDensity = industryDensity[0]?.establishments ?? 0;
                const naics = naicsForIndustry(row.industryKey);
                const ci = intensityForIndustry(row.industryKey);

                return (
                  <div key={id}>
                    <button
                      onClick={() => setExpanded(open ? null : id)}
                      className="flex w-full flex-wrap items-center gap-3 py-4 text-left transition-colors hover:bg-white/4"
                    >
                      <span
                        className="w-6 text-xs tabular-nums"
                        style={{ color: "var(--cc-muted)" }}
                      >
                        {i + 1}
                      </span>
                      <span className="min-w-40 text-sm font-medium">{row.industryLabel}</span>
                      <span className="min-w-28 text-sm" style={{ color: "var(--cc-muted)" }}>
                        {row.stateName}
                      </span>
                      <span
                        className={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${bandTone(row.band)}`}
                      >
                        {bandLabel(row.band)} · {row.score.toFixed(0)}
                      </span>
                      <span
                        className="flex-1 text-xs md:text-right"
                        style={{ color: "var(--cc-muted)" }}
                      >
                        {row.reason}
                      </span>
                      <span className="text-xs" style={{ color: "var(--cc-muted)" }}>
                        {open ? "−" : "+"}
                      </span>
                    </button>

                    {open && (
                      <div className="grid gap-8 pb-8 md:grid-cols-2">
                        {/* Chart 1 — CBECS intensity */}
                        <div className="glass-panel rounded-xl p-5">
                          <div className="eyebrow" style={{ color: "var(--cc-muted)" }}>
                            Energy intensity · CBECS {CBECS_SOURCE.dataDate}
                          </div>
                          <div className="mt-5 space-y-4">
                            {intensity.map((e) => (
                              <Bar
                                key={e.key}
                                label={e.label}
                                value={e.score}
                                max={maxIntensity}
                                highlight={e.key === row.industryKey}
                                {...(e.key === row.industryKey && ci?.siteEui
                                  ? { sub: `~${ci.siteEui} kBtu/sq ft · ${ci.cbecsActivity}` }
                                  : {})}
                              />
                            ))}
                          </div>
                        </div>

                        {/* Chart 2 — EIA rates */}
                        <div className="glass-panel rounded-xl p-5">
                          <div className="eyebrow" style={{ color: "var(--cc-muted)" }}>
                            Commercial rate by state · EIA, data month {dataMonth}
                          </div>
                          <div className="mt-5 space-y-4">
                            {rates.slice(0, 12).map((r) => (
                              <Bar
                                key={r.state}
                                label={r.stateName}
                                value={r.rateCents}
                                max={maxRate}
                                suffix="¢"
                                highlight={r.state === row.state}
                              />
                            ))}
                          </div>
                        </div>

                        {/* Chart 3 — rate trend */}
                        <div className="glass-panel rounded-xl p-5">
                          <div className="eyebrow" style={{ color: "var(--cc-muted)" }}>
                            Rate trend · EIA monthly history
                          </div>
                          <div className="mt-5">
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
                        </div>

                        {/* Chart 4 — Census density */}
                        <div className="glass-panel rounded-xl p-5">
                          <div className="eyebrow" style={{ color: "var(--cc-muted)" }}>
                            Market density · Census CBP {CBP_VINTAGE.year}
                            {naics ? ` · NAICS ${naics.naics}` : ""}
                          </div>
                          <div className="mt-5 space-y-4">
                            {industryDensity.length === 0 && (
                              <p className="text-sm" style={{ color: "var(--cc-muted)" }}>
                                No establishment data loaded.
                              </p>
                            )}
                            {industryDensity.map((d) => (
                              <Bar
                                key={d.state}
                                label={d.state}
                                value={d.establishments}
                                max={maxDensity}
                                highlight={d.state === row.state}
                              />
                            ))}
                          </div>
                        </div>

                        {row.missing.length > 0 && (
                          <p
                            className="text-xs md:col-span-2"
                            style={{ color: "var(--cc-muted)" }}
                          >
                            Scored without: {row.missing.join(", ")}.
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Standalone rate chart */}
          <div className="glass-panel mt-8 rounded-2xl p-6 sm:p-8">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <div className="eyebrow" style={{ color: "var(--cc-muted)" }}>
                Deregulated states by commercial rate
              </div>
              <div className="text-xs" style={{ color: "var(--cc-muted)" }}>
                EIA retail sales · data month {dataMonth}
              </div>
            </div>
            <div className="mt-6 space-y-4">
              {rates.length === 0 && (
                <p className="text-sm" style={{ color: "var(--cc-muted)" }}>
                  No rate data available.
                </p>
              )}
              {rates.map((r) => (
                <Bar
                  key={r.state}
                  label={`${r.stateName}${r.marketStatus === "partial" ? " (partial)" : ""}`}
                  value={r.rateCents}
                  max={maxRate}
                  suffix="¢/kWh"
                />
              ))}
            </div>
          </div>

          {/* Standalone intensity chart */}
          <div className="glass-panel mt-8 rounded-2xl p-6 sm:p-8">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <div className="eyebrow" style={{ color: "var(--cc-muted)" }}>
                Energy intensity by vertical
              </div>
              <div className="text-xs" style={{ color: "var(--cc-muted)" }}>
                {CBECS_SOURCE.name} · {CBECS_SOURCE.edition}
              </div>
            </div>
            <div className="mt-6 space-y-4">
              {intensity.map((e) => (
                <Bar
                  key={e.key}
                  label={e.label}
                  value={e.score}
                  max={maxIntensity}
                  highlight
                  sub={`CBECS activity: ${e.cbecsActivity}`}
                />
              ))}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
