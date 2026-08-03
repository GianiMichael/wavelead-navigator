// EIA STEO publishes commercial electricity price forecasts by Census division,
// not by state. This maps each state we track to its STEO region series.

export interface SteoRegion {
  /** STEO seriesId suffix, e.g. "NEC" → ESCMU_NEC */
  code: string;
  name: string;
}

export const STEO_REGIONS: Record<string, SteoRegion> = {
  NEC: { code: "NEC", name: "New England" },
  MAC: { code: "MAC", name: "Middle Atlantic" },
  ENC: { code: "ENC", name: "East North Central" },
  WNC: { code: "WNC", name: "West North Central" },
  SAC: { code: "SAC", name: "South Atlantic" },
  ESC: { code: "ESC", name: "East South Central" },
  WSC: { code: "WSC", name: "West South Central" },
  MTN: { code: "MTN", name: "Mountain" },
  PAC: { code: "PAC", name: "Pacific Contiguous" },
  HAK: { code: "HAK", name: "Alaska and Hawaii" },
};

const STATE_TO_REGION: Record<string, string> = {
  CT: "NEC", ME: "NEC", MA: "NEC", NH: "NEC", RI: "NEC", VT: "NEC",
  NJ: "MAC", NY: "MAC", PA: "MAC",
  IL: "ENC", IN: "ENC", MI: "ENC", OH: "ENC", WI: "ENC",
  IA: "WNC", KS: "WNC", MN: "WNC", MO: "WNC", NE: "WNC", ND: "WNC", SD: "WNC",
  DE: "SAC", DC: "SAC", FL: "SAC", GA: "SAC", MD: "SAC", NC: "SAC", SC: "SAC", VA: "SAC", WV: "SAC",
  AL: "ESC", KY: "ESC", MS: "ESC", TN: "ESC",
  AR: "WSC", LA: "WSC", OK: "WSC", TX: "WSC",
  AZ: "MTN", CO: "MTN", ID: "MTN", MT: "MTN", NV: "MTN", NM: "MTN", UT: "MTN", WY: "MTN",
  CA: "PAC", OR: "PAC", WA: "PAC",
  AK: "HAK", HI: "HAK",
};

export function steoRegionForState(state?: string | null): SteoRegion | undefined {
  if (!state) return undefined;
  const code = STATE_TO_REGION[state.toUpperCase()];
  return code ? STEO_REGIONS[code] : undefined;
}

export const STEO_SOURCE =
  "EIA Short-Term Energy Outlook (STEO) — 18-month forward commercial price projections by Census division.";
