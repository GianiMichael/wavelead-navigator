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

/**
 * Live status sync.
 *
 * Isolated on purpose: swapping this for a webhook-fed cache later only means
 * replacing the body of `fetchLeadStatuses` — callers stay unchanged.
 * Requires the `leads:read` scope on the Instantly API key.
 */
export type SyncedLeadStatus =
  | "Pending"
  | "Sent"
  | "Opened"
  | "Clicked"
  | "Replied"
  | "Interested"
  | "Not interested"
  | "Bounced";

interface InstantlyLead {
  id?: string;
  email_open_count?: number;
  email_click_count?: number;
  email_reply_count?: number;
  email_sent_count?: number;
  status?: number;
  lt_interest_status?: number | null;
  verification_status?: number | null;
  esp_code?: number | null;
}

function deriveStatus(lead: InstantlyLead): SyncedLeadStatus {
  if (lead.status === 3 || lead.esp_code === 550 || lead.esp_code === 551) return "Bounced";
  if (lead.lt_interest_status != null && lead.lt_interest_status < 0) return "Not interested";
  if (lead.lt_interest_status != null && lead.lt_interest_status > 0) return "Interested";
  if ((lead.email_reply_count ?? 0) > 0) return "Replied";
  if ((lead.email_click_count ?? 0) > 0) return "Clicked";
  if ((lead.email_open_count ?? 0) > 0) return "Opened";
  if ((lead.email_sent_count ?? 0) > 0) return "Sent";
  return "Pending";
}

/** Look up the current status of each lead id. Unknown ids are simply omitted. */
export async function fetchLeadStatuses(
  leadIds: string[],
): Promise<Record<string, SyncedLeadStatus>> {
  const out: Record<string, SyncedLeadStatus> = {};
  if (leadIds.length === 0) return out;

  const chunks: string[][] = [];
  for (let i = 0; i < leadIds.length; i += 100) chunks.push(leadIds.slice(i, i + 100));

  for (const chunk of chunks) {
    const res = await fetch(`${BASE}/leads/list`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key()}`, "Content-Type": "application/json" },
      body: JSON.stringify({ ids: chunk, limit: chunk.length }),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Instantly lead-status request failed [${res.status}]: ${body}`);
    }
    const json = (await res.json()) as { items?: InstantlyLead[] };
    for (const lead of json.items ?? []) {
      if (lead.id) out[lead.id] = deriveStatus(lead);
    }
  }

  return out;
}
