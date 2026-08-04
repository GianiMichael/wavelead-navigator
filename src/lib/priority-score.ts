/**
 * Two-layer opportunity scoring.
 *
 * Layer 1 — Baseline Fit: structural, changes rarely. Concrete dollar estimate
 *   of what one typical facility in this industry + state spends on
 *   electricity per year, with establishment density as supporting context.
 *
 * Layer 2 — Live Urgency Multiplier: recalculated every refresh. Rate trend,
 *   wholesale day-ahead/real-time spread, and STEO forecast direction.
 *
 * The two layers are combined through an explicit gate (`gateLayers`) — a
 * combination must score well on BOTH to reach the top of the list. They are
 * deliberately never folded into a single blended number upstream.
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
  /** Typical facility floor area, sq ft (CBECS). */
  avgSqFt?: number;
  /** Share of site energy delivered as electricity. */
  electricShare?: number;
  /** Commercial retail rate, cents per kWh. Undefined when EIA is unavailable. */
  rateCents?: number;
  /** Month-over-month direction of the retail rate, as a fraction (0.08 = +8%). */
  rateTrendPct?: number;
  /** Census CBP establishment count for this industry + state. */
  establishments?: number;
  /** Fully deregulated markets score higher than partially open ones. */
  marketStatus: "deregulated" | "partial" | "regulated" | "unknown";
  /** ISO day-ahead vs real-time spread for this state's grid, in percent. */
  wholesaleSpreadPct?: number;
  /** ISO region label, for the talking point. */
  isoName?: string;
  /** STEO forecast direction over the next months, as a fraction. */
  forecastTrendPct?: number;
  /** Human label of the STEO forecast horizon end, e.g. "March 2027". */
  forecastThrough?: string;
}

/** Rate range used to normalize ¢/kWh into 0-1. */
const RATE_FLOOR = 7;
const RATE_CEIL = 25;

/** Below this establishment count the market is too thin to work. */
const DENSITY_FLOOR = 50;
const DENSITY_FULL = 800;

/** Spend normalization window, USD/year per facility (log scale). */
const SPEND_FLOOR = 3_000;
const SPEND_CEIL = 400_000;

const KBTU_PER_KWH = 3.412;

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

/* ── Layer 1 — Baseline Fit ─────────────────────────────────────── */

export interface BaselineFit {
  /** Estimated electricity use of one typical facility, kWh/year. */
  annualKwh?: number;
  /** Estimated annual electricity spend of one typical facility, USD. */
  annualSpendUsd?: number;
  /** 0-1 normalized opportunity size. */
  fit: number;
  densityFactor: number;
  missing: string[];
}

export function estimateFacilitySpend(input: ScoreInputs): {
  annualKwh?: number;
  annualSpendUsd?: number;
} {
  const { siteEui, avgSqFt, electricShare, rateCents } = input;
  if (!siteEui || !avgSqFt || !electricShare || rateCents === undefined) return {};
  const siteKbtu = siteEui * avgSqFt;
  const annualKwh = (siteKbtu * electricShare) / KBTU_PER_KWH;
  const annualSpendUsd = (annualKwh * rateCents) / 100;
  return { annualKwh: Math.round(annualKwh), annualSpendUsd: Math.round(annualSpendUsd) };
}

export function computeBaselineFit(input: ScoreInputs): BaselineFit {
  const missing: string[] = [];
  const { annualKwh, annualSpendUsd } = estimateFacilitySpend(input);

  if (input.rateCents === undefined) missing.push("retail rate");
  if (input.establishments === undefined) missing.push("establishment density");

  // Log-scaled spend: a $200k facility is not 60x more attractive than a $3k one.
  const spendN =
    annualSpendUsd === undefined
      ? clamp01(input.intensity / 10) * 0.6 // fall back to raw intensity
      : clamp01(
          Math.log(Math.max(annualSpendUsd, SPEND_FLOOR) / SPEND_FLOOR) /
            Math.log(SPEND_CEIL / SPEND_FLOOR),
        );

  const marketN =
    input.marketStatus === "deregulated" ? 1 : input.marketStatus === "partial" ? 0.7 : 0.15;

  const densityFactor = densityMultiplier(input.establishments);
  const fit = clamp01(spendN * densityFactor * marketN);

  return {
    ...(annualKwh !== undefined ? { annualKwh } : {}),
    ...(annualSpendUsd !== undefined ? { annualSpendUsd } : {}),
    fit,
    densityFactor,
    missing,
  };
}

/* ── Layer 2 — Live Urgency Multiplier ──────────────────────────── */

export interface UrgencySignals {
  rateTrend: number;
  spread: number;
  forecast: number;
}

export interface UrgencyResult {
  /** 0-1 urgency. 0.5 means "nothing notable happening right now". */
  urgency: number;
  signals: UrgencySignals;
  missing: string[];
  /** Short human phrases describing the live signals. */
  notes: string[];
}

const URGENCY_WEIGHTS = { rateTrend: 0.4, spread: 0.3, forecast: 0.3 };

export function computeUrgency(input: ScoreInputs): UrgencyResult {
  const missing: string[] = [];
  const notes: string[] = [];

  let rateTrend = 0.5;
  if (input.rateTrendPct === undefined) missing.push("rate trend");
  else {
    rateTrend = clamp01(0.5 + input.rateTrendPct * 5); // +10% => 1.0
    const pct = Math.abs(input.rateTrendPct * 100).toFixed(1);
    if (input.rateTrendPct > 0.005) notes.push(`rates up ${pct}% this quarter`);
    else if (input.rateTrendPct < -0.005) notes.push(`rates down ${pct}% this quarter`);
    else notes.push("rates flat this quarter");
  }

  let spread = 0.5;
  if (input.wholesaleSpreadPct === undefined) missing.push("wholesale spread");
  else {
    // Wide spread either way = volatile market = a reason to talk now.
    spread = clamp01(0.35 + Math.abs(input.wholesaleSpreadPct) / 40);
    const iso = input.isoName ? `${input.isoName} ` : "";
    notes.push(
      `${iso}wholesale running ${input.wholesaleSpreadPct > 0 ? "+" : ""}${input.wholesaleSpreadPct.toFixed(0)}% vs day-ahead`,
    );
  }

  let forecast = 0.5;
  if (input.forecastTrendPct === undefined) missing.push("STEO forecast");
  else {
    forecast = clamp01(0.5 + input.forecastTrendPct * 6);
    const pct = Math.abs(input.forecastTrendPct * 100).toFixed(1);
    const through = input.forecastThrough ? ` through ${input.forecastThrough}` : "";
    notes.push(
      input.forecastTrendPct > 0.005
        ? `EIA forecasts a further ${pct}% rise${through}`
        : input.forecastTrendPct < -0.005
          ? `EIA forecasts a ${pct}% easing${through}`
          : `EIA forecasts flat rates${through}`,
    );
  }

  const urgency = clamp01(
    URGENCY_WEIGHTS.rateTrend * rateTrend +
      URGENCY_WEIGHTS.spread * spread +
      URGENCY_WEIGHTS.forecast * forecast,
  );

  return { urgency, signals: { rateTrend, spread, forecast }, missing, notes };
}

/* ── The gate ───────────────────────────────────────────────────── */

/**
 * Both layers must be strong. The geometric mean punishes a weak layer far
 * harder than an average would, and anything below the floor on either layer
 * is capped out of the top band entirely.
 */
export const GATE_FLOOR = 0.35;

export function gateLayers(fit: number, urgency: number): { score: number; gated: boolean } {
  const gated = fit < GATE_FLOOR || urgency < GATE_FLOOR;
  const combined = Math.sqrt(fit * urgency);
  const score = Math.round((gated ? combined * 0.6 : combined) * 1000) / 10;
  return { score, gated };
}

export type PriorityBand = "high" | "medium" | "low";

export interface ScoreResult extends ScoreInputs {
  /** 0-100 gated composite of Layer 1 × Layer 2. */
  score: number;
  band: PriorityBand;
  /** Layer 1 */
  baselineFit: number;
  annualKwh?: number;
  annualSpendUsd?: number;
  densityFactor: number;
  /** Layer 2 */
  urgency: number;
  urgencySignals: UrgencySignals;
  urgencyNotes: string[];
  gated: boolean;
  reason: string;
  /** Pitch-ready line combining Layer 1 size with Layer 2 urgency. */
  talkingPoint: string;
  /** Signals that were missing when the score was computed. */
  missing: string[];
}

export function formatUsd(n: number): string {
  return `$${Math.round(n).toLocaleString("en-US")}`;
}

/** Annual figure → monthly. Monthly is the primary figure shown everywhere. */
export function monthlySpend(annual: number): number {
  return annual / 12;
}

/** Compact dollars for secondary lines, e.g. "$8.2M". */
export function formatUsdCompact(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `$${(n / 1_000_000).toFixed(abs >= 10_000_000 ? 0 : 1)}M`;
  if (abs >= 10_000) return `$${(n / 1_000).toFixed(0)}K`;
  return formatUsd(n);
}

export function scoreCombination(input: ScoreInputs): ScoreResult {
  const layer1 = computeBaselineFit(input);
  const layer2 = computeUrgency(input);
  const { score, gated } = gateLayers(layer1.fit, layer2.urgency);

  const band: PriorityBand = gated
    ? score >= 45
      ? "medium"
      : "low"
    : score >= 60
      ? "high"
      : score >= 44
        ? "medium"
        : "low";

  return {
    ...input,
    score,
    band,
    baselineFit: layer1.fit,
    ...(layer1.annualKwh !== undefined ? { annualKwh: layer1.annualKwh } : {}),
    ...(layer1.annualSpendUsd !== undefined ? { annualSpendUsd: layer1.annualSpendUsd } : {}),
    densityFactor: layer1.densityFactor,
    urgency: layer2.urgency,
    urgencySignals: layer2.signals,
    urgencyNotes: layer2.notes,
    gated,
    reason: buildReason(input, layer1),
    talkingPoint: buildTalkingPoint(input, layer1, layer2),
    missing: [...layer1.missing, ...layer2.missing],
  };
}

/** Layer 1 narrative: what the opportunity is worth structurally. */
function buildReason(input: ScoreInputs, layer1: BaselineFit): string {
  const parts: string[] = [];

  if (layer1.annualSpendUsd !== undefined) {
    parts.push(
      `A typical ${input.industryLabel.replace(/ \/.*$/, "")} site in ${input.stateName} spends an estimated ${formatUsd(monthlySpend(layer1.annualSpendUsd))}/month on electricity (~${formatUsdCompact(layer1.annualSpendUsd)}/year)`,
    );
  } else {
    parts.push(`${input.industryLabel} in ${input.stateName}`);
  }

  if (input.siteEui !== undefined && input.avgSqFt !== undefined) {
    parts.push(
      `${input.siteEui} kBtu/sq ft across ~${input.avgSqFt.toLocaleString("en-US")} sq ft`,
    );
  }
  if (input.rateCents !== undefined) parts.push(`${input.rateCents.toFixed(1)}¢/kWh commercial rate`);
  if (input.establishments !== undefined) {
    parts.push(
      layer1.densityFactor < 0.7
        ? `only ${input.establishments.toLocaleString()} establishments statewide`
        : `${input.establishments.toLocaleString()} establishments statewide`,
    );
  }
  if (input.marketStatus === "partial") parts.push("partially deregulated");

  return parts.join(" · ");
}

/** Layer 1 + Layer 2 in one pasteable sentence. */
function buildTalkingPoint(
  input: ScoreInputs,
  layer1: BaselineFit,
  layer2: UrgencyResult,
): string {
  const size =
    layer1.annualSpendUsd !== undefined
      ? `Typical spend ~${formatUsd(monthlySpend(layer1.annualSpendUsd))}/month per site (~${formatUsdCompact(layer1.annualSpendUsd)}/year)`
      : `${input.industryLabel} sites in ${input.stateName}`;
  const urgency = layer2.notes.length ? layer2.notes.join(", ") : "no live price movement right now";
  return `${size}, ${urgency}.`;
}

export function bandLabel(band: PriorityBand) {
  return band === "high" ? "High" : band === "medium" ? "Medium" : "Low";
}
