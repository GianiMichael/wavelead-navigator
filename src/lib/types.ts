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
  /** Provider that supplied the returned contacts. */
  provider: string;
  contacts: EnrichedContact[];
  /** Providers tried, in waterfall order. */
  attempted?: string[];
  error?: string;
}

export interface ProspectSearchResult {
  prospects: Prospect[];
  /** Places results dropped because they had no website (undomainable). */
  excludedNoWebsite: number;
  /** Token for the next Google Places page; absent when there are no more. */
  nextPageToken?: string;
}

export interface InstantlyCampaign {
  id: string;
  name: string;
}
