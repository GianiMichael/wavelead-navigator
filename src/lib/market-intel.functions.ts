import { createServerFn } from "@tanstack/react-start";

import { ENERGY_INTENSITY } from "@/data/energy-intensity";
import { fetchCommercialRates, fetchEstablishmentDensity } from "@/lib/market-intel.server";
import { scoreCombination, type ScoreResult } from "@/lib/priority-score";

export const getMarketIntel = createServerFn({ method: "GET" }).handler(async () => {
  const [ratesResult, densityResult] = await Promise.all([
    fetchCommercialRates(),
    fetchEstablishmentDensity(),
  ]);

  const rateByState = new Map(ratesResult.rates.map((r) => [r.state, r]));
  const densityKey = (i: string, s: string) => `${i}|${s}`;
  const densityMap = new Map(
    densityResult.rows.map((r) => [densityKey(r.industryKey, r.state), r]),
  );

  const leaderboard: ScoreResult[] = [];
  for (const industry of ENERGY_INTENSITY) {
    for (const rate of ratesResult.rates) {
      const density = densityMap.get(densityKey(industry.key, rate.state));
      leaderboard.push(
        scoreCombination({
          industryKey: industry.key,
          industryLabel: industry.label,
          state: rate.state,
          stateName: rate.stateName,
          intensity: industry.score,
          rateCents: rate.rateCents,
          ...(rate.trendPct !== undefined ? { rateTrendPct: rate.trendPct } : {}),
          ...(density ? { establishments: density.establishments } : {}),
          marketStatus: rate.marketStatus,
        }),
      );
    }
  }
  leaderboard.sort((a, b) => b.score - a.score);

  return {
    leaderboard,
    rates: ratesResult,
    density: densityResult,
    generatedAt: new Date().toISOString(),
  };
});
