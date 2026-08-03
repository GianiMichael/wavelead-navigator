import type { EnrichedContact, EnrichmentResult, Prospect } from "@/lib/types";
import type { PipelineRecord } from "@/lib/pipeline-store";
import { INDUSTRY_OPTIONS, tiersForIndustry } from "@/lib/tier-matching";

/**
 * Demo Mode data set.
 *
 * Every company, address, person, phone number, and email produced here is
 * entirely fabricated and matches no real business or individual. Domains use
 * the reserved `.example.com` suffix (RFC 2606) so nothing can resolve to a
 * live company. No external API is ever called for this data.
 *
 * Results are generated deterministically from the search inputs so a visitor
 * always gets a full, realistic page of prospects for any industry or area,
 * and every prospect always enriches into tier-matched contacts.
 */

export const DEMO_PAGE_SIZE = 20;

/** Deterministic 32-bit hash — keeps a given search reproducible. */
function hash(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

function pick<T>(arr: T[], seed: number): T {
  return arr[seed % arr.length] as T;
}

const PREFIXES = [
  "Bayou Crest", "Ironvale", "SunRail", "Northgate", "Copperline", "Willow Bend",
  "Redstone", "Harbor Point", "Silverbrook", "Marlow", "Cedar Fork", "Kestrel",
  "Beacon Hollow", "Arrowhead", "Lakeshore", "Granite Row", "Ambervale", "Foxglove",
  "Pinnacle Ridge", "Quarry Lane", "Verdant Hill", "Halcyon", "Brightwater", "Stonefield",
];

const SUFFIX_BY_INDUSTRY: Record<string, string[]> = {
  grocery: ["Market", "Fresh Market", "Grocers", "Food Hall", "Provisions"],
  healthcare: ["Regional Medical Center", "Health Campus", "Community Hospital", "Medical Pavilion"],
  manufacturing: ["Precision Works", "Manufacturing Co.", "Industries", "Fabrication Group"],
  hospitality: ["Hotel & Conference Center", "Grand Hotel", "Resort & Spa", "Suites"],
  restaurants: ["Kitchen Group", "Grill House", "Eatery Collective", "Table & Tap"],
  education: ["Preparatory Academy", "Community College", "School District Campus", "Learning Institute"],
  car_wash: ["Express Wash", "Auto Spa", "Car Wash Co.", "Shine Wash"],
  cold_storage: ["Cold Storage", "Refrigerated Logistics", "Freezer Terminal", "Chill Warehouse"],
  multi_site_retail: ["Retail Group", "Home Store", "Outfitters", "Supply Co."],
  data_center: ["Data Center", "Colocation Campus", "Digital Exchange", "Compute Vault"],
  default: ["Commercial Group", "Facilities Co.", "Enterprises", "Services Group"],
};

const CATEGORY_BY_INDUSTRY: Record<string, string> = {
  grocery: "Grocery store",
  healthcare: "Hospital",
  manufacturing: "Manufacturer",
  hospitality: "Hotel",
  restaurants: "Restaurant",
  education: "School",
  car_wash: "Car wash",
  cold_storage: "Cold storage warehouse",
  multi_site_retail: "Retail chain",
  data_center: "Data center",
  default: "Commercial facility",
};

/** Annual site energy use intensity by vertical (kBtu/sq ft/year), CBECS-like. */
const EUI_BY_INDUSTRY: Record<string, number> = {
  grocery: 199.7, healthcare: 196.4, manufacturing: 88.2, hospitality: 106.4,
  restaurants: 288.5, education: 62.1, car_wash: 118.3, cold_storage: 141.6,
  multi_site_retail: 74.9, data_center: 302.4, default: 80.5,
};

const STREETS = [
  "Larkspur Way", "Cottonmill Rd", "Harlow Ave", "Pemberton Dr", "Kettleman St",
  "Sablewood Blvd", "Foundry Row", "Aspen Field Rd", "Thornbury Ln", "Old Mill Pkwy",
];

const FIRST_NAMES = [
  "Marcus", "Dana", "Priya", "Ryan", "Tasha", "Gary", "Sandra", "Elena", "Devon",
  "Nadia", "Curtis", "Imani", "Victor", "Rosalind", "Theo", "Lena", "Omar", "Britt",
];
const LAST_NAMES = [
  "Whitfield", "Alvarez", "Raman", "Castillo", "Boone", "Lindqvist", "Okafor",
  "Marchetti", "Delgado", "Fairbanks", "Nakamura", "Bergstrom", "Ellery", "Sowande",
];

/** Titles that intentionally miss the tier list, so the demo shows filtering too. */
const OFF_TIER_TITLES = ["Marketing Coordinator", "Accounts Payable Clerk", "Guest Relations Lead"];

function slug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

/** Parses a "City, ST" style input; falls back to a deregulated Texas market. */
function parseLocation(location: string): { city: string; state: string } {
  const raw = (location || "").trim();
  const parts = raw.split(",").map((p) => p.trim()).filter(Boolean);
  const maybeState = parts[1] ?? "";
  const state = /^[A-Za-z]{2}$/.test(maybeState) ? maybeState.toUpperCase() : "TX";
  const city = parts[0] || "Houston";
  return { city, state };
}

function personFor(seed: number): { first: string; last: string } {
  return {
    first: pick(FIRST_NAMES, seed),
    last: pick(LAST_NAMES, Math.floor(seed / 3) + 1),
  };
}

export function buildDemoProspects(
  industry: string,
  location: string,
  count = DEMO_PAGE_SIZE,
): Prospect[] {
  const key = SUFFIX_BY_INDUSTRY[industry] ? industry : "default";
  const { city, state } = parseLocation(location);
  const base = hash(`${key}|${city}|${state}`);
  const suffixes = SUFFIX_BY_INDUSTRY[key]!;
  const eui = EUI_BY_INDUSTRY[key] ?? EUI_BY_INDUSTRY.default!;

  const out: Prospect[] = [];
  const used = new Set<string>();
  for (let i = 0; i < count; i++) {
    const seed = base + i * 7919;
    let name = `${pick(PREFIXES, seed)} ${pick(suffixes, base + i * 3 + (i % 2))}`;
    let n = 2;
    while (used.has(name)) name = `${pick(PREFIXES, seed + n)} ${pick(suffixes, base + i + n++)}`;
    used.add(name);

    const domain = `${slug(name)}.example.com`;
    out.push({
      id: `demo-${key}-${i}-${slug(name).slice(0, 18)}`,
      name,
      address: `${1000 + (seed % 8000)} ${pick(STREETS, seed + 3)}, ${city}, ${state}`,
      category: CATEGORY_BY_INDUSTRY[key] ?? CATEGORY_BY_INDUSTRY.default!,
      state,
      website: `https://www.${domain}`,
      domain,
      phone: `(${200 + (seed % 700)}) 555-0${100 + (seed % 899)}`,
      rating: Number((3.8 + ((seed % 12) / 10)).toFixed(1)),
      marketStatus: "deregulated",
      marketNote: "Retail choice market — competitive supply available.",
      benchmark: {
        source: "CBECS",
        year: 2018,
        siteEui: Number((eui * (0.85 + ((seed % 30) / 100))).toFixed(1)),
        grossFloorAreaSqFt: 40_000 + (seed % 40) * 12_500,
        energyStarScore: 45 + (seed % 45),
        electricityKwh: 900_000 + (seed % 60) * 320_000,
      },
    });
  }
  return out;
}

/**
 * Always returns tier-matched contacts: the first three names use the
 * industry's own Tier 1-3 titles, so enrichment can never dead-end.
 */
export function buildDemoEnrichment(prospect: Prospect, industry: string): EnrichmentResult {
  const domain = prospect.domain ?? `${slug(prospect.name)}.example.com`;
  const tiers = tiersForIndustry(industry);
  const seed = hash(domain);
  const providers = ["hunter", "prospeo", "snov"] as const;
  const provider = providers[seed % 3]!;
  const attempted = providers.slice(0, providers.indexOf(provider) + 1) as unknown as string[];

  const titles = [
    tiers[0],
    tiers[1] ?? tiers[0],
    tiers[2] ?? tiers[0],
    pick(OFF_TIER_TITLES, seed + 1),
  ].filter(Boolean) as string[];

  const contacts: EnrichedContact[] = titles.map((title, i) => {
    const { first, last } = personFor(seed + i * 5);
    return {
      name: `${first} ${last}`,
      title,
      email: `${first[0]!.toLowerCase()}.${last.toLowerCase()}@${domain}`,
      confidence: 95 - i * 8,
      provider,
    };
  });

  return { domain, provider, attempted, contacts };
}

/** Default set shown before the visitor runs their first search. */
export const DEMO_PROSPECTS: Prospect[] = buildDemoProspects("manufacturing", "Houston, TX");

export const DEMO_CAMPAIGNS = [
  { id: "demo-campaign-tx", name: "TX Commercial — Q3 Outreach" },
  { id: "demo-campaign-il", name: "IL Manufacturing — Energy Audit" },
  { id: "demo-campaign-hosp", name: "Hospitality & Healthcare — Summer Peak" },
];

const SEED_INDUSTRIES: Array<{ key: string; location: string; campaign: number; priority: "High" | "Medium" | "Low" }> = [
  { key: "healthcare", location: "Houston, TX", campaign: 2, priority: "High" },
  { key: "manufacturing", location: "Chicago, IL", campaign: 1, priority: "High" },
  { key: "car_wash", location: "Midland, TX", campaign: 0, priority: "Medium" },
  { key: "hospitality", location: "Philadelphia, PA", campaign: 2, priority: "High" },
  { key: "cold_storage", location: "Columbus, OH", campaign: 1, priority: "High" },
  { key: "grocery", location: "Dallas, TX", campaign: 0, priority: "Medium" },
];

const SEED_STATUSES = [
  "Replied", "Sent", "Opened", "Pending", "Interested", "Sent", "Opened", "Sent",
  "Pending", "Replied", "Sent", "Opened", "Sent", "Interested", "Pending", "Sent",
] as const;

/** 16 pre-populated outreach records so the command center is never empty. */
export const DEMO_PIPELINE: PipelineRecord[] = (() => {
  const rows: PipelineRecord[] = [];
  let i = 0;
  for (const seed of SEED_INDUSTRIES) {
    const label = INDUSTRY_OPTIONS.find((o) => o.key === seed.key)?.label ?? seed.key;
    const companies = buildDemoProspects(seed.key, seed.location, 3);
    for (const company of companies) {
      if (i >= 16) break;
      const enrichment = buildDemoEnrichment(company, seed.key);
      const contactIndex = i % 2;
      const contact = enrichment.contacts[contactIndex] ?? enrichment.contacts[0]!;
      const campaign = DEMO_CAMPAIGNS[seed.campaign]!;
      const day = 6 + i;
      rows.push({
        leadId: `demo-lead-${i + 1}`,
        businessName: company.name,
        contactName: contact.name ?? "Unknown",
        title: contact.title ?? "",
        email: contact.email,
        domain: company.domain,
        tier: `Tier ${contactIndex + 1}`,
        industry: seed.key,
        industryLabel: label,
        deregulated: "Deregulated",
        energyPriority: seed.priority,
        campaignId: campaign.id,
        campaignName: campaign.name,
        dateAdded: `2026-07-${String(day).padStart(2, "0")}T15:20:00.000Z`,
        status: SEED_STATUSES[i % SEED_STATUSES.length]!,
        lastSynced: "2026-07-28T09:00:00.000Z",
      });
      i++;
    }
  }
  return rows;
})();
