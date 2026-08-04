import { createServerFn } from "@tanstack/react-start";

import { ENERGY_INTENSITY } from "@/data/energy-intensity";
import { isoForState } from "@/data/iso-regions";
import { steoRegionForState } from "@/data/steo-regions";
import { readIsoSignals } from "@/lib/iso-prices.server";
import {
  fetchCommercialRates,
  fetchEstablishmentDensity,
  fetchGridDemand,
  fetchSteoForecast,
  isGridRange,
} from "@/lib/market-intel.server";
import { scoreCombination, type ScoreResult } from "@/lib/priority-score";
import { currentTargetPeriod } from "@/lib/target-period";

function monthName(period: string) {
  if (!period) return undefined;
  const [y, m] = period.split("-");
  return new Date(Number(y), Number(m) - 1, 1).toLocaleString("en-US", {
    month: "long",
    year: "numeric",
  });
}

export const getMarketIntel = createServerFn({ method: "GET" }).handler(async () => {
  const [ratesResult, densityResult, gridResult, steoResult, isoSignals] = await Promise.all([
    fetchCommercialRates(),
    fetchEstablishmentDensity(),
    fetchGridDemand(),
    fetchSteoForecast(),
    readIsoSignals(),
  ]);

  const period = currentTargetPeriod();

  const densityKey = (i: string, s: string) => `${i}|${s}`;
  const densityMap = new Map(
    densityResult.rows.map((r) => [densityKey(r.industryKey, r.state), r]),
  );

  /** Layer 2 input: STEO forecast direction over the next ~6 months, per state. */
  const forecastForState = (state: string, lastHistPeriod: string) => {
    const region = steoRegionForState(state);
    if (!region) return {};
    const series = steoResult.regions[region.code]?.series ?? [];
    const base = series.filter((p) => p.period <= lastHistPeriod).at(-1) ?? series[0];
    const forward = series.filter((p) => p.period > lastHistPeriod).slice(0, 6);
    const end = forward.at(-1);
    if (!base || !end || base.rateCents <= 0) return {};
    return {
      forecastTrendPct: (end.rateCents - base.rateCents) / base.rateCents,
      forecastThrough: monthName(end.period),
    };
  };

  const leaderboard: ScoreResult[] = [];
  for (const industry of ENERGY_INTENSITY) {
    for (const rate of ratesResult.rates) {
      const density = densityMap.get(densityKey(industry.key, rate.state));
      const iso = isoForState(rate.state);
      const signal = iso ? isoSignals[iso.code] : undefined;
      const forecast = forecastForState(rate.state, rate.period);

      leaderboard.push(
        scoreCombination({
          industryKey: industry.key,
          industryLabel: industry.label,
          state: rate.state,
          stateName: rate.stateName,
          intensity: industry.score,
          ...(industry.siteEui !== undefined ? { siteEui: industry.siteEui } : {}),
          ...(industry.avgSqFt !== undefined ? { avgSqFt: industry.avgSqFt } : {}),
          ...(industry.electricShare !== undefined
            ? { electricShare: industry.electricShare }
            : {}),
          rateCents: rate.rateCents,
          ...(rate.trendPct !== undefined ? { rateTrendPct: rate.trendPct } : {}),
          ...(density ? { establishments: density.establishments } : {}),
          marketStatus: rate.marketStatus,
          ...(signal?.spreadPct !== null && signal?.spreadPct !== undefined
            ? { wholesaleSpreadPct: signal.spreadPct }
            : {}),
          ...(iso ? { isoName: iso.code } : {}),
          ...forecast,
        }),
      );
    }
  }
  leaderboard.sort((a, b) => b.score - a.score);

  return {
    leaderboard,
    period,
    rates: ratesResult,
    density: densityResult,
    grid: gridResult,
    steo: steoResult,

    generatedAt: new Date().toISOString(),
  };
});

export const getGridDemand = createServerFn({ method: "GET" })
  .inputValidator((input: { range?: string }) => ({
    range: isGridRange(input?.range) ? input.range : ("24H" as const),
  }))
  .handler(async ({ data }) => fetchGridDemand(data.range));
