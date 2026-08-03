import type { EnrichmentResult, Prospect } from "@/lib/types";
import type { PipelineRecord } from "@/lib/pipeline-store";

/**
 * Frozen sample data used by Demo Mode.
 *
 * Every company, address, person, and email below is entirely fabricated and
 * does not correspond to any real business or individual. Domains use the
 * reserved `.example.com` suffix (RFC 2606) so nothing here can ever resolve
 * to, or be confused with, a live company. No API is called for this data.
 */
export const DEMO_PROSPECTS: Prospect[] = [
  {
    id: "demo-bayou-crest",
    name: "Bayou Crest Regional Medical Center",
    address: "1420 Larkspur Way, Houston, TX 77099",
    category: "Hospital",
    state: "TX",
    website: "https://www.bayoucrestmedical.example.com",
    domain: "bayoucrestmedical.example.com",
    phone: "(713) 555-0142",
    rating: 4.3,
    marketStatus: "deregulated",
    marketNote: "ERCOT retail choice — competitive supply available.",
    benchmark: {
      source: "CBECS",
      year: 2018,
      siteEui: 196.4,
      grossFloorAreaSqFt: 1_850_000,
      energyStarScore: 61,
      electricityKwh: 84_500_000,
    },
  },
  {
    id: "demo-sunrail-wash",
    name: "SunRail Express Wash",
    address: "3410 Cottonmill Rd, Midland, TX 79707",
    category: "Car wash",
    state: "TX",
    website: "https://www.sunrailexpresswash.example.com",
    domain: "sunrailexpresswash.example.com",
    phone: "(432) 555-0188",
    rating: 4.7,
    marketStatus: "deregulated",
    marketNote: "ERCOT retail choice — competitive supply available.",
  },
  {
    id: "demo-ironvale-works",
    name: "Ironvale Precision Works",
    address: "8800 Harlow Ave, Chicago, IL 60632",
    category: "Manufacturer",
    state: "IL",
    website: "https://www.ironvaleworks.example.com",
    domain: "ironvaleworks.example.com",
    phone: "(773) 555-0119",
    rating: 4.1,
    marketStatus: "deregulated",
    marketNote: "Illinois retail choice for commercial accounts.",
    benchmark: {
      source: "Chicago Energy Benchmarking",
      year: 2022,
      siteEui: 88.2,
      grossFloorAreaSqFt: 640_000,
      electricityKwh: 12_900_000,
    },
  },
];

export const DEMO_ENRICHMENTS: Record<string, EnrichmentResult> = {
  "bayoucrestmedical.example.com": {
    domain: "bayoucrestmedical.example.com",
    provider: "hunter",
    attempted: ["hunter"],
    contacts: [
      {
        name: "Marcus Whitfield",
        title: "Director of Facilities Operations",
        email: "m.whitfield@bayoucrestmedical.example.com",
        confidence: 94,
        provider: "hunter",
      },
      {
        name: "Dana Alvarez",
        title: "Energy Manager",
        email: "d.alvarez@bayoucrestmedical.example.com",
        confidence: 88,
        provider: "hunter",
      },
      {
        name: "Priya Raman",
        title: "VP Procurement",
        email: "p.raman@bayoucrestmedical.example.com",
        confidence: 76,
        provider: "hunter",
      },
      {
        name: "Kevin Doss",
        title: "Marketing Coordinator",
        email: "k.doss@bayoucrestmedical.example.com",
        confidence: 62,
        provider: "hunter",
      },
    ],
  },
  "sunrailexpresswash.example.com": {
    domain: "sunrailexpresswash.example.com",
    provider: "prospeo",
    attempted: ["hunter", "prospeo"],
    contacts: [
      {
        name: "Ryan Castillo",
        title: "Owner / Operator",
        email: "ryan@sunrailexpresswash.example.com",
        confidence: 91,
        provider: "prospeo",
      },
      {
        name: "Tasha Boone",
        title: "Site Manager",
        email: "tasha@sunrailexpresswash.example.com",
        confidence: 79,
        provider: "prospeo",
      },
    ],
  },
  "ironvaleworks.example.com": {
    domain: "ironvaleworks.example.com",
    provider: "snov",
    attempted: ["hunter", "prospeo", "snov"],
    contacts: [
      {
        name: "Gary Lindqvist",
        title: "Plant Manager",
        email: "g.lindqvist@ironvaleworks.example.com",
        confidence: 90,
        provider: "snov",
      },
      {
        name: "Sandra Okafor",
        title: "Director of Operations",
        email: "s.okafor@ironvaleworks.example.com",
        confidence: 84,
        provider: "snov",
      },
      {
        name: "Bill Trainor",
        title: "Maintenance Supervisor",
        email: "b.trainor@ironvaleworks.example.com",
        confidence: 71,
        provider: "snov",
      },
    ],
  },
};

export const DEMO_CAMPAIGNS = [
  { id: "demo-campaign-tx", name: "TX Commercial — Q3 Outreach" },
  { id: "demo-campaign-il", name: "IL Manufacturing — Energy Audit" },
];

export const DEMO_PIPELINE: PipelineRecord[] = [
  {
    leadId: "demo-lead-1",
    businessName: "Bayou Crest Regional Medical Center",
    contactName: "Marcus Whitfield",
    title: "Director of Facilities Operations",
    email: "m.whitfield@bayoucrestmedical.example.com",
    domain: "bayoucrestmedical.example.com",
    tier: "Tier 1",
    industry: "healthcare",
    industryLabel: "Healthcare",
    deregulated: "Deregulated",
    energyPriority: "High",
    campaignId: "demo-campaign-tx",
    campaignName: "TX Commercial — Q3 Outreach",
    dateAdded: "2026-07-14T15:20:00.000Z",
    status: "Replied",
    lastSynced: "2026-07-28T09:00:00.000Z",
  },
  {
    leadId: "demo-lead-2",
    businessName: "SunRail Express Wash",
    contactName: "Ryan Castillo",
    title: "Owner / Operator",
    email: "ryan@sunrailexpresswash.example.com",
    domain: "sunrailexpresswash.example.com",
    tier: "Tier 1",
    industry: "retail",
    industryLabel: "Retail",
    deregulated: "Deregulated",
    energyPriority: "Medium",
    campaignId: "demo-campaign-tx",
    campaignName: "TX Commercial — Q3 Outreach",
    dateAdded: "2026-07-19T17:05:00.000Z",
    status: "Opened",
    lastSynced: "2026-07-28T09:00:00.000Z",
  },
  {
    leadId: "demo-lead-3",
    businessName: "Ironvale Precision Works",
    contactName: "Gary Lindqvist",
    title: "Plant Manager",
    email: "g.lindqvist@ironvaleworks.example.com",
    domain: "ironvaleworks.example.com",
    tier: "Tier 1",
    industry: "manufacturing",
    industryLabel: "Manufacturing",
    deregulated: "Deregulated",
    energyPriority: "High",
    campaignId: "demo-campaign-il",
    campaignName: "IL Manufacturing — Energy Audit",
    dateAdded: "2026-07-22T13:41:00.000Z",
    status: "Interested",
    lastSynced: "2026-07-28T09:00:00.000Z",
  },
  {
    leadId: "demo-lead-4",
    businessName: "Ironvale Precision Works",
    contactName: "Sandra Okafor",
    title: "Director of Operations",
    email: "s.okafor@ironvaleworks.example.com",
    domain: "ironvaleworks.example.com",
    tier: "Tier 2",
    industry: "manufacturing",
    industryLabel: "Manufacturing",
    deregulated: "Deregulated",
    energyPriority: "High",
    campaignId: "demo-campaign-il",
    campaignName: "IL Manufacturing — Energy Audit",
    dateAdded: "2026-07-25T11:12:00.000Z",
    status: "Sent",
    lastSynced: "2026-07-28T09:00:00.000Z",
  },
];
