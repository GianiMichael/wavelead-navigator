/**
 * Decision-maker enrichment waterfall.
 *
 * Single entry point: `enrichDomain(domain, industryKey)`.
 * Interface: input = company domain, output = list of contacts
 * (name / title / email / confidence) plus the provider that served them.
 *
 * Providers run in order. A provider "succeeds" when it returns at least one
 * contact that matches a tier for the requested industry (Step 3 logic). If a
 * provider returns contacts but none are tier-matched, we keep them as a
 * fallback and continue down the waterfall. Adding a 4th provider means
 * writing one function and appending it to PROVIDERS — nothing else changes.
 */
import type { EnrichedContact, EnrichmentResult } from "@/lib/types";
import { matchDecisionMaker } from "@/lib/tier-matching";

type Provider = {
  name: string;
  run: (domain: string) => Promise<EnrichedContact[]>;
};

/* ------------------------------- Hunter.io ------------------------------- */

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
  url.searchParams.set("limit", "10");
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

/* -------------------------------- Prospeo -------------------------------- */

interface ProspeoEmail {
  email?: string;
  first_name?: string;
  last_name?: string;
  job_title?: string;
  position?: string;
  verification?: { result?: string };
}

async function prospeoDomainSearch(domain: string): Promise<EnrichedContact[]> {
  const apiKey = process.env.PROSPEO_API_KEY;
  if (!apiKey) throw new Error("PROSPEO_API_KEY is not configured.");

  const res = await fetch("https://api.prospeo.io/domain-search", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-KEY": apiKey },
    body: JSON.stringify({ company: domain, limit: 10 }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Prospeo request failed [${res.status}]: ${body}`);
  }
  const json = (await res.json()) as {
    error?: boolean;
    message?: string;
    response?: { email_list?: ProspeoEmail[] };
  };
  if (json.error) throw new Error(`Prospeo error: ${json.message ?? "unknown"}`);

  return (json.response?.email_list ?? [])
    .filter((e) => e.email)
    .map((e) => ({
      name: [e.first_name, e.last_name].filter(Boolean).join(" ") || (e.email as string),
      title: e.job_title ?? e.position ?? "",
      email: e.email as string,
      confidence: e.verification?.result === "deliverable" ? 95 : 70,
      provider: "prospeo",
    }));
}

/* -------------------------------- Snov.io -------------------------------- */

interface SnovEmail {
  email?: string;
  firstName?: string;
  lastName?: string;
  position?: string;
  smtpStatus?: string;
}

async function snovAccessToken(): Promise<string> {
  const clientId = process.env.SNOV_CLIENT_ID;
  const clientSecret = process.env.SNOV_CLIENT_SECRET;
  if (!clientId || !clientSecret)
    throw new Error("SNOV_CLIENT_ID / SNOV_CLIENT_SECRET are not configured.");

  const res = await fetch("https://api.snov.io/v1/oauth/access_token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type: "client_credentials",
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Snov.io auth failed [${res.status}]: ${body}`);
  }
  const json = (await res.json()) as { access_token?: string };
  if (!json.access_token) throw new Error("Snov.io auth returned no access token.");
  return json.access_token;
}

async function snovDomainSearch(domain: string): Promise<EnrichedContact[]> {
  const token = await snovAccessToken();
  const url = new URL("https://api.snov.io/v2/domain-emails-with-info");
  url.searchParams.set("domain", domain);
  url.searchParams.set("type", "all");
  url.searchParams.set("limit", "10");

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Snov.io request failed [${res.status}]: ${body}`);
  }
  const json = (await res.json()) as { emails?: SnovEmail[] };
  return (json.emails ?? [])
    .filter((e) => e.email)
    .map((e) => ({
      name: [e.firstName, e.lastName].filter(Boolean).join(" ") || (e.email as string),
      title: e.position ?? "",
      email: e.email as string,
      confidence: e.smtpStatus === "valid" ? 90 : 60,
      provider: "snov",
    }));
}

/* ------------------------------- Waterfall ------------------------------- */

// Ordered waterfall. Append a provider here to extend it.
const PROVIDERS: Provider[] = [
  { name: "hunter", run: hunterDomainSearch },
  { name: "prospeo", run: prospeoDomainSearch },
  { name: "snov", run: snovDomainSearch },
];

export async function enrichDomain(
  domain: string,
  industryKey = "default",
): Promise<EnrichmentResult> {
  const errors: string[] = [];
  const attempted: string[] = [];
  let fallback: EnrichmentResult | null = null;

  for (const provider of PROVIDERS) {
    attempted.push(provider.name);
    try {
      const contacts = await provider.run(domain);
      if (contacts.length === 0) continue;

      if (matchDecisionMaker(contacts, industryKey)) {
        // First provider with a real tier match wins — stop here.
        return { domain, provider: provider.name, contacts, attempted };
      }
      // Contacts, but no tier match: keep as fallback and keep going.
      if (!fallback) fallback = { domain, provider: provider.name, contacts, attempted: [] };
    } catch (err) {
      errors.push(`${provider.name}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  if (fallback) return { ...fallback, attempted };

  return {
    domain,
    provider: PROVIDERS[PROVIDERS.length - 1].name,
    contacts: [],
    attempted,
    error: errors.length ? errors.join(" · ") : undefined,
  };
}
