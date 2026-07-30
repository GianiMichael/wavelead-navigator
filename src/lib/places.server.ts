import { lookupMarket, stateFromAddress } from "@/data/deregulated-markets";
import { findBenchmark } from "@/data/energy-benchmarking";
import type { Prospect } from "@/lib/types";

interface PlacesPlace {
  id: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  primaryTypeDisplayName?: { text?: string };
  types?: string[];
  websiteUri?: string;
  nationalPhoneNumber?: string;
  rating?: number;
}

export function domainFromUrl(url?: string): string | undefined {
  if (!url) return undefined;
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return undefined;
  }
}

export async function searchPlaces(params: {
  query: string;
  location: string;
  maxResults: number;
}): Promise<Prospect[]> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) throw new Error("GOOGLE_PLACES_API_KEY is not configured.");

  const textQuery = `${params.query} in ${params.location}`;
  const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask":
        "places.id,places.displayName,places.formattedAddress,places.primaryTypeDisplayName,places.types,places.websiteUri,places.nationalPhoneNumber,places.rating",
    },
    body: JSON.stringify({
      textQuery,
      maxResultCount: Math.min(params.maxResults, 20),
      regionCode: "US",
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Google Places request failed [${res.status}]: ${body}`);
  }

  const json = (await res.json()) as { places?: PlacesPlace[] };
  const places = json.places ?? [];

  return places.map((p): Prospect => {
    const name = p.displayName?.text ?? "Unnamed business";
    const address = p.formattedAddress ?? "";
    const state = stateFromAddress(address);
    const market = lookupMarket(state);
    const bench = findBenchmark(name, address);
    return {
      id: p.id,
      name,
      address,
      category: p.primaryTypeDisplayName?.text ?? p.types?.[0]?.replace(/_/g, " ") ?? "Business",
      state,
      website: p.websiteUri,
      domain: domainFromUrl(p.websiteUri),
      phone: p.nationalPhoneNumber,
      rating: p.rating,
      marketStatus: market?.status ?? "unknown",
      marketNote: market?.note,
      benchmark: bench
        ? {
            source: bench.source,
            year: bench.year,
            siteEui: bench.siteEui,
            grossFloorAreaSqFt: bench.grossFloorAreaSqFt,
            energyStarScore: bench.energyStarScore,
            electricityKwh: bench.electricityKwh,
          }
        : undefined,
    };
  });
}
