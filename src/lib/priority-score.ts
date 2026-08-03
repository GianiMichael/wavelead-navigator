/**
 * Priority scoring module.
 *
 * Deliberately standalone: new signals (e.g. ECL) can be registered as an
 * extra weighted input without touching the page or the data fetchers.
 */

export interface ScoreInputs {
  industryKey: string;
  industryLabel: string;
  state: string;
  stateName: string;
  /** CBECS 1-10 energy intensity (internal scoring only — never displayed). */
  intensity: number;
  /** Real CBECS site EUI in kBtu/sq ft — the number shown to users. */
  siteEui?: number;
  /** Commercial retail rate, cents per kWh. Undefined when EIA is unavailable. */
  rateCents?: number;
  /** Month-over-month direction of the retail rate, as a fraction (0.08 = +8%). */
  rateTrendPct?: number;
  /** Census CBP establishment count for this industry + state. */
  establishments?: number;
  /** Fully deregulated markets score higher than partially open ones. */
  marketStatus: "deregulated" | "partial" | "regulated" | "unknown";
}

export interface ScoreWeights {
  intensity: number;
  rate: number;
  trend: number;
  market: number;
}

/** Energy intensity and rate/trend dominate; density is a gate, not a weight. */
export const DEFAULT_WEIGHTS: ScoreWeights = {
  intensity: 0.38,
  rate: 0.3,
  trend: 0.2,
  market: 0.12,
};

/** Rate range used to normalize ¢/kWh into 0-1. */
const RATE_FLOOR = 7;
const RATE_CEIL = 25;

/** Below this establishment count the market is too thin to work. */
const DENSITY_FLOOR = 50;
const DENSITY_FULL = 800;

function clamp01(n: number) {
  return Math.max(0, Math.min(1, n));
}

/**
 * Density acts as a multiplier in [0.45, 1.05]: thin markets are pushed down,
 * deep markets get a small lift. Unknown density is treated as neutral (1).
 */
export function densityMultiplier(establishments?: number): number {
  if (establishments === undefined) return 1;
  if (establishments <= 0) return 0.3;
  if (establishments < DENSITY_FLOOR) return 0.45 + (establishments / DENSITY_FLOOR) * 0.2;
  const t = clamp01((establishments - DENSITY_FLOOR) / (DENSITY_FULL - DENSITY_FLOOR));
  return 0.65 + t * 0.4;
}

export type PriorityBand = "high" | "medium" | "low";

export interface ScoreResult extends ScoreInputs {
  /** 0-100 composite. */
  score: number;
  band: PriorityBand;
  densityFactor: number;
  reason: string;
  /** Signals that were missing when the score was computed. */
  missing: string[];
}

export function scoreCombination(
  input: ScoreInputs,
  weights: ScoreWeights = DEFAULT_WEIGHTS,
): ScoreResult {
  const missing: string[] = [];

  const intensityN = clamp01(input.intensity / 10);

  let rateN = 0.5;
  if (input.rateCents === undefined) missing.push("retail rate");
  else rateN = clamp01((input.rateCents - RATE_FLOOR) / (RATE_CEIL - RATE_FLOOR));

  let trendN = 0.5;
  if (input.rateTrendPct === undefined) missing.push("rate trend");
  else trendN = clamp01(0.5 + input.rateTrendPct * 5); // +10% => 1.0

  const marketN =
    input.marketStatus === "deregulated" ? 1 : input.marketStatus === "partial" ? 0.55 : 0.1;

  if (input.establishments === undefined) missing.push("establishment density");

  const base =
    weights.intensity * intensityN +
    weights.rate * rateN +
    weights.trend * trendN +
    weights.market * marketN;

  const densityFactor = densityMultiplier(input.establishments);
  const score = Math.round(clamp01(base * densityFactor) * 1000) / 10;

  const band: PriorityBand = score >= 62 ? "high" : score >= 45 ? "medium" : "low";

  return { ...input, score, band, densityFactor, reason: buildReason(input, densityFactor), missing };
}

function buildReason(input: ScoreInputs, densityFactor: number): string {
  const parts: string[] = [];

  const eui = input.siteEui !== undefined ? ` (${input.siteEui} kBtu/sq ft)` : "";
  if (input.intensity >= 8) parts.push(`High energy intensity${eui}`);
  else if (input.intensity >= 5.5) parts.push(`Moderate energy intensity${eui}`);
  else parts.push(`Lower energy intensity${eui}`);

  if (input.rateCents !== undefined) {
    parts.push(`${input.rateCents.toFixed(1)}¢/kWh commercial rate`);
  }

  if (input.rateTrendPct !== undefined) {
    const pct = Math.abs(input.rateTrendPct * 100).toFixed(1);
    parts.push(
      input.rateTrendPct > 0.005
        ? `rates up ${pct}%`
        : input.rateTrendPct < -0.005
          ? `rates down ${pct}%`
          : "rates flat",
    );
  }

  if (input.establishments !== undefined) {
    parts.push(
      densityFactor < 0.7
        ? `only ${input.establishments.toLocaleString()} establishments`
        : `${input.establishments.toLocaleString()} establishments found`,
    );
  }

  if (input.marketStatus === "partial") parts.push("partially deregulated");

  return parts.join(" + ");
}

export function bandLabel(band: PriorityBand) {
  return band === "high" ? "High" : band === "medium" ? "Medium" : "Low";
}
