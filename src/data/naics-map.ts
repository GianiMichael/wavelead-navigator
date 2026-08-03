/**
 * NAICS mapping for the app's 10 industry verticals, used against the Census
 * County Business Patterns (CBP) API. Codes follow the NAICS2022 vocabulary
 * used by the 2023 CBP vintage. Editable by hand.
 */

export interface NaicsEntry {
  key: string;
  label: string;
  /** CBP NAICS code (sector ranges use the hyphenated form, e.g. "31-33"). */
  naics: string;
  naicsLabel: string;
}

export const NAICS_MAP: NaicsEntry[] = [
  { key: "manufacturing", label: "Manufacturing", naics: "31-33", naicsLabel: "Manufacturing" },
  { key: "healthcare", label: "Healthcare", naics: "62", naicsLabel: "Health care & social assistance" },
  { key: "grocery", label: "Grocery / Food Sales", naics: "445", naicsLabel: "Food & beverage retailers" },
  { key: "hospitality", label: "Hospitality / Lodging", naics: "721", naicsLabel: "Accommodation" },
  { key: "restaurants", label: "Restaurants / Food Service", naics: "722", naicsLabel: "Food services & drinking places" },
  { key: "education", label: "Education", naics: "61", naicsLabel: "Educational services" },
  { key: "car_wash", label: "Car Wash", naics: "8111", naicsLabel: "Automotive repair & maintenance" },
  { key: "cold_storage", label: "Cold Storage", naics: "4931", naicsLabel: "Warehousing & storage" },
  { key: "multi_site_retail", label: "Multi-Site Retail", naics: "44-45", naicsLabel: "Retail trade" },
  { key: "data_center", label: "Data Centers", naics: "518", naicsLabel: "Computing infrastructure & data processing" },
];

export function naicsForIndustry(key: string): NaicsEntry | undefined {
  return NAICS_MAP.find((n) => n.key === key);
}

/** Census FIPS state codes for the markets we target. */
export const STATE_FIPS: Record<string, string> = {
  AL: "01", AK: "02", AZ: "04", AR: "05", CA: "06", CO: "08", CT: "09", DE: "10",
  DC: "11", FL: "12", GA: "13", HI: "15", ID: "16", IL: "17", IN: "18", IA: "19",
  KS: "20", KY: "21", LA: "22", ME: "23", MD: "24", MA: "25", MI: "26", MN: "27",
  MS: "28", MO: "29", MT: "30", NE: "31", NV: "32", NH: "33", NJ: "34", NM: "35",
  NY: "36", NC: "37", ND: "38", OH: "39", OK: "40", OR: "41", PA: "42", RI: "44",
  SC: "45", SD: "46", TN: "47", TX: "48", UT: "49", VT: "50", VA: "51", WA: "53",
  WV: "54", WI: "55", WY: "56",
};

export const FIPS_TO_STATE: Record<string, string> = Object.fromEntries(
  Object.entries(STATE_FIPS).map(([code, fips]) => [fips, code]),
);

export const CBP_VINTAGE = { year: 2023, dataLabel: "2023 reference year (released 2025)" };
