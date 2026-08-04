/**
 * CBECS-based energy intensity ranking for the app's 10 industry verticals.
 *
 * Source: U.S. EIA Commercial Buildings Energy Consumption Survey (CBECS),
 * 2018 release (published 2022) — the most recent completed survey. Scores are
 * a 1-10 normalization of major-fuel energy intensity (site EUI, kBtu/sq ft)
 * for the closest CBECS principal building activity. Editable by hand.
 */

export interface EnergyIntensityEntry {
  /** Matches the industry keys used by tier matching / business-type defaults. */
  key: string;
  label: string;
  /** 1-10, higher = more energy intense. */
  score: number;
  /** CBECS principal building activity (or nearest analogue) used. */
  cbecsActivity: string;
  /** Approximate site EUI in kBtu/sq ft from the survey. */
  siteEui?: number;
  /** Typical (mean) floor area of one facility, sq ft. CBECS building size. */
  avgSqFt?: number;
  /** Share of site energy delivered as electricity (rest is mostly gas). */
  electricShare?: number;
}

export const CBECS_SOURCE = {
  name: "EIA CBECS",
  edition: "2018 survey (published 2022)",
  dataDate: "2018",
  url: "https://www.eia.gov/consumption/commercial/",
};

export const ENERGY_INTENSITY: EnergyIntensityEntry[] = [
  {
    key: "restaurants",
    label: "Restaurants / Food Service",
    score: 10,
    cbecsActivity: "Food service",
    siteEui: 262,
    avgSqFt: 5600,
    electricShare: 0.4,
  },
  {
    key: "grocery",
    label: "Grocery / Food Sales",
    score: 9.4,
    cbecsActivity: "Food sales",
    siteEui: 197,
    avgSqFt: 6500,
    electricShare: 0.65,
  },
  {
    key: "healthcare",
    label: "Healthcare",
    score: 8.8,
    cbecsActivity: "Inpatient health care",
    siteEui: 170,
    avgSqFt: 120000,
    electricShare: 0.45,
  },
  {
    key: "data_center",
    label: "Data Centers",
    score: 8.2,
    cbecsActivity: "Other — data center",
    siteEui: 155,
    avgSqFt: 25000,
    electricShare: 0.9,
  },
  {
    key: "cold_storage",
    label: "Cold Storage",
    score: 7.1,
    cbecsActivity: "Refrigerated warehouse",
    siteEui: 96,
    avgSqFt: 40000,
    electricShare: 0.75,
  },
  {
    key: "manufacturing",
    label: "Manufacturing",
    score: 6.5,
    cbecsActivity: "Industrial / non-office manufacturing support",
    siteEui: 88,
    avgSqFt: 30000,
    electricShare: 0.55,
  },
  {
    key: "hospitality",
    label: "Hospitality / Lodging",
    score: 5.6,
    cbecsActivity: "Lodging",
    siteEui: 74,
    avgSqFt: 40000,
    electricShare: 0.5,
  },
  {
    key: "car_wash",
    label: "Car Wash",
    score: 4.4,
    cbecsActivity: "Service (vehicle repair / service)",
    siteEui: 58,
    avgSqFt: 6000,
    electricShare: 0.6,
  },
  {
    key: "multi_site_retail",
    label: "Multi-Site Retail",
    score: 3.6,
    cbecsActivity: "Retail (other than mall)",
    siteEui: 49,
    avgSqFt: 12000,
    electricShare: 0.7,
  },
  {
    key: "education",
    label: "Education",
    score: 3.0,
    cbecsActivity: "Education",
    siteEui: 42,
    avgSqFt: 30000,
    electricShare: 0.5,
  },
];

/** Sorted highest intensity first. */
export function rankedIntensity(): EnergyIntensityEntry[] {
  return [...ENERGY_INTENSITY].sort((a, b) => b.score - a.score);
}

export function intensityForIndustry(key: string): EnergyIntensityEntry | undefined {
  return ENERGY_INTENSITY.find((e) => e.key === key);
}
