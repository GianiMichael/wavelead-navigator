import { supabase } from "@/integrations/supabase/client";
import type { CachedEnrichment } from "@/lib/enrichment-cache";
import { mergeEnrichmentCache, readEnrichmentCache } from "@/lib/enrichment-cache";
import type { PipelineRecord } from "@/lib/pipeline-store";
import { readPipeline, writePipelineLocal } from "@/lib/pipeline-store";

/**
 * The app has no login, so records live in shared cloud tables. localStorage is
 * kept as a synchronous mirror so existing render paths stay simple; the cloud
 * copy is the source of truth shared by the editor preview and the live site.
 */

type Row = Record<string, unknown>;

function toRecord(row: Row): PipelineRecord {
  return {
    leadId: String(row["lead_id"]),
    businessName: String(row["business_name"] ?? ""),
    contactName: String(row["contact_name"] ?? ""),
    title: String(row["title"] ?? ""),
    email: String(row["email"] ?? ""),
    domain: (row["domain"] as string | null) ?? undefined,
    tier: String(row["tier"] ?? ""),
    industry: String(row["industry"] ?? ""),
    industryLabel: String(row["industry_label"] ?? ""),
    deregulated: String(row["deregulated"] ?? ""),
    energyPriority: (row["energy_priority"] ?? "Medium") as PipelineRecord["energyPriority"],
    campaignId: String(row["campaign_id"] ?? ""),
    campaignName: String(row["campaign_name"] ?? ""),
    dateAdded: String(row["date_added"] ?? new Date().toISOString()),
    status: (row["status"] ?? "Pending") as PipelineRecord["status"],
    lastSynced: (row["last_synced"] as string | null) ?? undefined,
  };
}

function toRow(r: PipelineRecord): Row {
  return {
    lead_id: r.leadId,
    business_name: r.businessName,
    contact_name: r.contactName,
    title: r.title,
    email: r.email,
    domain: r.domain ?? null,
    tier: r.tier,
    industry: r.industry,
    industry_label: r.industryLabel,
    deregulated: r.deregulated,
    energy_priority: r.energyPriority,
    campaign_id: r.campaignId,
    campaign_name: r.campaignName,
    date_added: r.dateAdded,
    status: r.status,
    last_synced: r.lastSynced ?? null,
    updated_at: new Date().toISOString(),
  };
}

/** Pull the shared cloud copy into the local mirror. Safe to call repeatedly. */
export async function hydrateFromCloud(): Promise<void> {
  if (typeof window === "undefined") return;

  const [pipeline, cache] = await Promise.all([
    supabase.from("pipeline_records").select("*").order("date_added", { ascending: false }),
    supabase.from("enrichment_cache").select("*"),
  ]);

  if (!pipeline.error && pipeline.data) {
    writePipelineLocal((pipeline.data as Row[]).map(toRecord));
  }
  if (!cache.error && cache.data) {
    const next: Record<string, CachedEnrichment> = {};
    for (const row of cache.data as Row[]) {
      next[String(row["domain"])] = {
        ...(row["payload"] as CachedEnrichment),
        domain: String(row["domain"]),
        cachedAt: String(row["cached_at"]),
      };
    }
    mergeEnrichmentCache(next);
  }
}

/** Push everything currently held locally up to the cloud (used for one-time migration). */
export async function pushLocalToCloud(): Promise<void> {
  const records = readPipeline();
  if (records.length) {
    await supabase.from("pipeline_records").upsert(records.map(toRow), { onConflict: "lead_id" });
  }
  const cache = Object.values(readEnrichmentCache());
  if (cache.length) {
    await supabase.from("enrichment_cache").upsert(
      cache.map((c) => ({ domain: c.domain, payload: c, cached_at: c.cachedAt })),
      { onConflict: "domain" },
    );
  }
}

export async function upsertPipelineRecordCloud(record: PipelineRecord) {
  const { error } = await supabase
    .from("pipeline_records")
    .upsert(toRow(record), { onConflict: "lead_id" });
  if (error) console.error("[cloud-sync] pipeline upsert failed", error.message);
}

export async function upsertPipelineRecordsCloud(records: PipelineRecord[]) {
  if (!records.length) return;
  const { error } = await supabase
    .from("pipeline_records")
    .upsert(records.map(toRow), { onConflict: "lead_id" });
  if (error) console.error("[cloud-sync] pipeline bulk upsert failed", error.message);
}

export async function upsertEnrichmentCloud(entry: CachedEnrichment) {
  const { error } = await supabase
    .from("enrichment_cache")
    .upsert(
      { domain: entry.domain, payload: entry, cached_at: entry.cachedAt },
      { onConflict: "domain" },
    );
  if (error) console.error("[cloud-sync] enrichment upsert failed", error.message);
}
