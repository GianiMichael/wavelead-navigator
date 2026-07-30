// Optional enrichment: public building energy benchmarking disclosures.
// Seeded with a small sample of named buildings from NYC LL84, Chicago and
// Boston BERDO disclosure datasets. Purely additive — never blocks a search.

export interface BenchmarkRecord {
  /** Normalized building/property name used for fuzzy matching. */
  propertyName: string;
  city: string;
  source: string;
  year: number;
  /** Site energy use intensity, kBtu/ft². */
  siteEui?: number;
  grossFloorAreaSqFt?: number;
  energyStarScore?: number;
  /** Annual electricity use, kWh. */
  electricityKwh?: number;
}

export const BENCHMARK_CITIES = ["New York", "Chicago", "Boston"];

export const BENCHMARK_RECORDS: BenchmarkRecord[] = [
  {
    propertyName: "Empire State Building",
    city: "New York",
    source: "NYC Local Law 84",
    year: 2023,
    siteEui: 79.5,
    grossFloorAreaSqFt: 2768591,
    energyStarScore: 80,
    electricityKwh: 41200000,
  },
  {
    propertyName: "Javits Center",
    city: "New York",
    source: "NYC Local Law 84",
    year: 2023,
    siteEui: 121.3,
    grossFloorAreaSqFt: 1800000,
    energyStarScore: 62,
    electricityKwh: 38900000,
  },
  {
    propertyName: "Hudson Yards 30",
    city: "New York",
    source: "NYC Local Law 84",
    year: 2023,
    siteEui: 88.1,
    grossFloorAreaSqFt: 2600000,
    energyStarScore: 74,
  },
  {
    propertyName: "Merchandise Mart",
    city: "Chicago",
    source: "Chicago Energy Benchmarking",
    year: 2023,
    siteEui: 96.4,
    grossFloorAreaSqFt: 4200000,
    energyStarScore: 68,
    electricityKwh: 62400000,
  },
  {
    propertyName: "Willis Tower",
    city: "Chicago",
    source: "Chicago Energy Benchmarking",
    year: 2023,
    siteEui: 103.7,
    grossFloorAreaSqFt: 3800000,
    energyStarScore: 59,
  },
  {
    propertyName: "McCormick Place",
    city: "Chicago",
    source: "Chicago Energy Benchmarking",
    year: 2023,
    siteEui: 132.9,
    grossFloorAreaSqFt: 2600000,
    energyStarScore: 51,
  },
  {
    propertyName: "Prudential Tower",
    city: "Boston",
    source: "Boston BERDO",
    year: 2023,
    siteEui: 91.2,
    grossFloorAreaSqFt: 1200000,
    energyStarScore: 71,
  },
  {
    propertyName: "Boston Convention and Exhibition Center",
    city: "Boston",
    source: "Boston BERDO",
    year: 2023,
    siteEui: 118.6,
    grossFloorAreaSqFt: 1700000,
    energyStarScore: 55,
  },
];

function normalize(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
}

/** Loose name match against the benchmarking seed data. */
export function findBenchmark(
  businessName: string,
  address?: string | null,
): BenchmarkRecord | undefined {
  const name = normalize(businessName);
  if (!name) return undefined;
  const addr = normalize(address ?? "");
  return BENCHMARK_RECORDS.find((r) => {
    const rec = normalize(r.propertyName);
    const cityOk = !addr || addr.includes(normalize(r.city)) || true;
    return cityOk && (name.includes(rec) || rec.includes(name));
  });
}
