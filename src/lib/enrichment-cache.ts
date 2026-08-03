import type { EnrichmentResult } from "@/lib/types";

/**
 * Domain-keyed enrichment cache. Hunter credits are finite, so any domain we
 * have already enriched is served from here instead of hitting the API again.
 */

export interface CachedEnrichment extends EnrichmentResult {
  domain: string;
  cachedAt: string;
}

const KEY = "waveclimate.enrichment.v1";

function isBrowser() {
  return typeof window !== "undefined";
}

function normalizeDomain(domain: string) {
  return domain.trim().toLowerCase().replace(/^www\./, "");
}

export function loadEnrichmentCache(): Record<string, CachedEnrichment> {
  if (!isBrowser()) return {};
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, CachedEnrichment>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

/** Alias used by the cloud sync layer. */
export const readEnrichmentCache = loadEnrichmentCache;

function writeCache(cache: Record<string, CachedEnrichment>) {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(cache));
  } catch {
    /* storage unavailable */
  }
}

/** Merge cloud rows into the local mirror (cloud wins on conflict). */
export function mergeEnrichmentCache(incoming: Record<string, CachedEnrichment>) {
  writeCache({ ...loadEnrichmentCache(), ...incoming });
}


export function getCachedEnrichment(domain: string): CachedEnrichment | null {
  if (!domain) return null;
  return loadEnrichmentCache()[normalizeDomain(domain)] ?? null;
}

export function saveEnrichment(domain: string, result: EnrichmentResult) {
  if (!isBrowser() || !domain) return;
  // Don't cache failed lookups — those should be retried.
  if (result.error) return;
  const cache = loadEnrichmentCache();
  cache[normalizeDomain(domain)] = {
    ...result,
    domain: normalizeDomain(domain),
    cachedAt: new Date().toISOString(),
  };
  try {
    window.localStorage.setItem(KEY, JSON.stringify(cache));
  } catch {
    /* storage unavailable — enrichment still works, just uncached */
  }
}

/** Set of normalized domains that already have saved enrichment data. */
export function cachedDomains(): Set<string> {
  return new Set(Object.keys(loadEnrichmentCache()));
}

export function isDomainCached(domain: string | undefined): boolean {
  if (!domain) return false;
  return normalizeDomain(domain) in loadEnrichmentCache();
}
