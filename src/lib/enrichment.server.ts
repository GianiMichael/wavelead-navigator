/**
 * Decision-maker enrichment module.
 *
 * Single entry point: `enrichDomain(domain)`.
 * Interface: input = company domain, output = list of contacts
 * (name / title / email / confidence) plus the provider that served them.
 *
 * Today only Hunter.io Domain Search is active. To add a waterfall later,
 * append another provider function to PROVIDERS — the rest of the app is
 * untouched because it only ever calls `enrichDomain`.
 */
import type { EnrichedContact, EnrichmentResult } from "@/lib/types";

type Provider = {
  name: string;
  run: (domain: string) => Promise<EnrichedContact[]>;
};

interface HunterEmail {
  value?: string;
  first_name?: string;
  last_name?: string;
  position?: string;
  confidence?: number;
}

async function hunterDomainSearch(domain: string): Promise<EnrichedContact[]> {
  const apiKey = process.env.HUNTER_API_KEY;
  if (!apiKey) throw new Error("HUNTER_API_KEY is not configured.");

  const url = new URL("https://api.hunter.io/v2/domain-search");
  url.searchParams.set("domain", domain);
  url.searchParams.set("limit", "50");
  url.searchParams.set("api_key", apiKey);

  const res = await fetch(url.toString());
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Hunter request failed [${res.status}]: ${body}`);
  }
  const json = (await res.json()) as { data?: { emails?: HunterEmail[] } };
  return (json.data?.emails ?? [])
    .filter((e) => e.value)
    .map((e) => ({
      name: [e.first_name, e.last_name].filter(Boolean).join(" ") || (e.value as string),
      title: e.position ?? "",
      email: e.value as string,
      confidence: e.confidence ?? 0,
      provider: "hunter",
    }));
}

// Ordered waterfall. Only Hunter is active today.
const PROVIDERS: Provider[] = [{ name: "hunter", run: hunterDomainSearch }];

export async function enrichDomain(domain: string): Promise<EnrichmentResult> {
  let lastError: string | undefined;
  for (const provider of PROVIDERS) {
    try {
      const contacts = await provider.run(domain);
      if (contacts.length > 0) {
        return { domain, provider: provider.name, contacts };
      }
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
    }
  }
  return { domain, provider: PROVIDERS[PROVIDERS.length - 1].name, contacts: [], error: lastError };
}
