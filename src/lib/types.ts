export interface Prospect {
  id: string;
  name: string;
  address: string;
  category: string;
  state?: string;
  website?: string;
  domain?: string;
  phone?: string;
  rating?: number;
  marketStatus: "deregulated" | "partial" | "regulated" | "unknown";
  marketNote?: string;
  benchmark?: {
    source: string;
    year: number;
    siteEui?: number;
    grossFloorAreaSqFt?: number;
    energyStarScore?: number;
    electricityKwh?: number;
  };
}

export interface EnrichedContact {
  name: string;
  title: string;
  email: string;
  confidence: number;
  provider: string;
}

export interface EnrichmentResult {
  domain: string;
  provider: string;
  contacts: EnrichedContact[];
  error?: string;
}

export interface InstantlyCampaign {
  id: string;
  name: string;
}
