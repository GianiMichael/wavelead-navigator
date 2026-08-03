import type { EnergyPriority } from "@/lib/energy-priority";

export type LeadStatus =
  | "Pending"
  | "Sent"
  | "Opened"
  | "Clicked"
  | "Replied"
  | "Interested"
  | "Not interested"
  | "Bounced";

export const LEAD_STATUSES: LeadStatus[] = [
  "Pending",
  "Sent",
  "Opened",
  "Clicked",
  "Replied",
  "Interested",
  "Not interested",
  "Bounced",
];

/** Statuses that count as real engagement for the summary stat block. */
export const ENGAGED_STATUSES: LeadStatus[] = ["Replied", "Interested"];

export interface PipelineRecord {
  /** Instantly lead id — the primary key used for status refresh. */
  leadId: string;
  businessName: string;
  contactName: string;
  title: string;
  email: string;
  /** Company domain — used to hide already-contacted businesses from search. */
  domain?: string;
  tier: string;
  industry: string;
  industryLabel: string;
  deregulated: string;
  energyPriority: EnergyPriority;
  campaignId: string;
  campaignName: string;
  dateAdded: string;
  status: LeadStatus;
  lastSynced?: string;
}

const KEY = "waveclimate.pipeline.v1";

function isBrowser() {
  return typeof window !== "undefined";
}

export function loadPipeline(): PipelineRecord[] {
  if (!isBrowser()) return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as PipelineRecord[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** Alias used by the cloud sync layer. */
export const readPipeline = loadPipeline;

/** Write to the local mirror AND the shared cloud table. */
export function savePipeline(records: PipelineRecord[]) {
  writePipelineLocal(records);
  // Dynamic import keeps this module free of a cycle with cloud-sync.
  void import("@/lib/cloud-sync").then((m) => m.upsertPipelineRecordsCloud(records));
}

/** Replace the local mirror only (used when hydrating from the cloud). */
export function writePipelineLocal(records: PipelineRecord[]) {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(records));
  } catch {
    /* storage full or unavailable — keep the page working */
  }
}

/** Upsert a record keyed by Instantly lead id, locally and in the cloud. */
export function addPipelineRecord(record: PipelineRecord) {
  const existing = loadPipeline().filter((r) => r.leadId !== record.leadId);
  writePipelineLocal([record, ...existing]);
  void import("@/lib/cloud-sync").then((m) => m.upsertPipelineRecordCloud(record));
}



/** Merge synced statuses into stored records; unknown ids keep last-known status. */
export function applyStatusUpdates(
  records: PipelineRecord[],
  updates: Record<string, LeadStatus>,
  syncedAt: string,
): PipelineRecord[] {
  return records.map((r) =>
    updates[r.leadId] ? { ...r, status: updates[r.leadId], lastSynced: syncedAt } : r,
  );
}

/** Normalized domains of companies that already have a lead in a campaign. */
export function contactedDomains(records = loadPipeline()): Set<string> {
  return new Set(
    records
      .map((r) => (r.domain ?? "").trim().toLowerCase().replace(/^www\./, ""))
      .filter(Boolean),
  );
}
