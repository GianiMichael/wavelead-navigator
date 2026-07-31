/**
 * Industry-based energy spend priority estimate.
 * Mirrors the qualification heuristic used across the Lead Engine:
 * energy-intensive, always-on operations rank highest.
 */
export type EnergyPriority = "High" | "Medium" | "Low";

const HIGH = [
  "manufacturing",
  "cold_storage",
  "coldstorage",
  "data_center",
  "datacenter",
  "grocery",
  "healthcare",
  "hospitality",
];

const MEDIUM = [
  "warehouse",
  "logistics",
  "education",
  "multifamily",
  "retail",
  "senior_living",
  "fitness",
  "restaurant",
];

export function energyPriorityForIndustry(industryKey: string | undefined): EnergyPriority {
  const key = (industryKey ?? "").toLowerCase();
  if (HIGH.some((k) => key.includes(k))) return "High";
  if (MEDIUM.some((k) => key.includes(k))) return "Medium";
  return "Low";
}
