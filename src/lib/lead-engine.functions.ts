import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

import { searchPlaces } from "@/lib/places.server";
import { enrichDomain } from "@/lib/enrichment.server";
import { listCampaigns, addLead, fetchLeadStatuses } from "@/lib/instantly.server";

export const searchProspects = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        query: z.string().min(2).max(120),
        location: z.string().min(2).max(120),
        maxResults: z.number().int().min(1).max(20).default(20),
        pageToken: z.string().max(2000).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    return await searchPlaces(data);
  });

export const enrichCompany = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        domain: z.string().min(3).max(255),
        industry: z.string().min(1).max(60).default("default"),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    return await enrichDomain(
      data.domain.replace(/^https?:\/\//, "").replace(/\/.*$/, ""),
      data.industry,
    );
  });

export const getCampaigns = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
  return await listCampaigns();
});

export const sendToCampaign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        campaignId: z.string().min(1).max(120),
        email: z.string().email(),
        firstName: z.string().max(80).optional(),
        lastName: z.string().max(80).optional(),
        companyName: z.string().max(160).optional(),
        title: z.string().max(160).optional(),
        website: z.string().max(255).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const result = await addLead(data);
    return { ok: true as const, id: result.id };
  });

export const syncLeadStatuses = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ leadIds: z.array(z.string().min(1)).max(500) }).parse(data),
  )
  .handler(async ({ data }) => {
    const statuses = await fetchLeadStatuses(data.leadIds);
    return { statuses, syncedAt: new Date().toISOString() };
  });
