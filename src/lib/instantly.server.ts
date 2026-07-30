import type { InstantlyCampaign } from "@/lib/types";

const BASE = "https://api.instantly.ai/api/v2";

function key(): string {
  const apiKey = process.env.INSTANTLY_API_KEY;
  if (!apiKey) throw new Error("INSTANTLY_API_KEY is not configured.");
  return apiKey;
}

export async function listCampaigns(): Promise<InstantlyCampaign[]> {
  const res = await fetch(`${BASE}/campaigns?limit=100`, {
    headers: { Authorization: `Bearer ${key()}` },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Instantly campaigns request failed [${res.status}]: ${body}`);
  }
  const json = (await res.json()) as { items?: Array<{ id: string; name: string }> };
  return (json.items ?? []).map((c) => ({ id: c.id, name: c.name }));
}

export async function addLead(input: {
  campaignId: string;
  email: string;
  firstName?: string;
  lastName?: string;
  companyName?: string;
  title?: string;
  website?: string;
}): Promise<{ id?: string }> {
  const res = await fetch(`${BASE}/leads`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key()}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      campaign: input.campaignId,
      email: input.email,
      first_name: input.firstName,
      last_name: input.lastName,
      company_name: input.companyName,
      website: input.website,
      personalization: input.title,
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Instantly add-lead failed [${res.status}]: ${body}`);
  }
  return (await res.json()) as { id?: string };
}
