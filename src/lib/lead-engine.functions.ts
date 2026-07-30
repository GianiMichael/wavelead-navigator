import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { searchPlaces } from "@/lib/places.server";
import { enrichDomain } from "@/lib/enrichment.server";
import { listCampaigns, addLead } from "@/lib/instantly.server";

export const searchProspects = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        query: z.string().min(2).max(120),
        location: z.string().min(2).max(120),
        maxResults: z.number().int().min(1).max(20).default(20),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    return await searchPlaces(data);
  });

export const enrichCompany = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z.object({ domain: z.string().min(3).max(255) }).parse(data),
  )
  .handler(async ({ data }) => {
    return await enrichDomain(data.domain.replace(/^https?:\/\//, "").replace(/\/.*$/, ""));
  });

export const getCampaigns = createServerFn({ method: "GET" }).handler(async () => {
  return await listCampaigns();
});

export const sendToCampaign = createServerFn({ method: "POST" })
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
