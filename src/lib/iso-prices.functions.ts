import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";

import { ISO_REGIONS } from "@/data/iso-regions";
import type { Database } from "@/integrations/supabase/types";

export interface IsoPrice {
  iso: string;
  isoName: string;
  hub: string;
  market: string;
  priceMwh: number | null;
  /** cents per kWh equivalent (price / 10) */
  priceCentsKwh: number | null;
  intervalStart: string | null;
  fetchedAt: string | null;
  states: string[];
  error?: string;
}

export interface IsoPriceResult {
  regions: IsoPrice[];
  /** Most recent cache refresh across all regions. */
  lastUpdated: string | null;
  error?: string;
}

/** Public read of the shared GridStatus cache — never calls GridStatus itself. */
export const getIsoPrices = createServerFn({ method: "GET" }).handler(
  async (): Promise<IsoPriceResult> => {
    const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
    const supabase = createClient<Database>(process.env["SUPABASE_URL"]!, key, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: {
        fetch: (input, init) => {
          const h = new Headers(init?.headers);
          if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`)
            h.delete("Authorization");
          h.set("apikey", key);
          return fetch(input, { ...init, headers: h });
        },
      },
    });

    const { data, error } = await supabase
      .from("iso_wholesale_prices")
      .select("iso, iso_name, hub, price_mwh, market, interval_start, fetched_at, error");

    const byIso = new Map((data ?? []).map((r) => [r.iso, r]));
    let lastUpdated: string | null = null;

    const regions: IsoPrice[] = ISO_REGIONS.map((r) => {
      const row = byIso.get(r.code);
      const price = row?.price_mwh === null || row?.price_mwh === undefined ? null : Number(row.price_mwh);
      if (row?.fetched_at && (!lastUpdated || row.fetched_at > lastUpdated)) {
        lastUpdated = row.fetched_at;
      }
      return {
        iso: r.code,
        isoName: r.name,
        hub: row?.hub || r.hubLabel,
        market: row?.market ?? "",
        priceMwh: price,
        priceCentsKwh: price === null ? null : price / 10,
        intervalStart: row?.interval_start ?? null,
        fetchedAt: row?.fetched_at ?? null,
        states: r.states,
        ...(row?.error ? { error: row.error } : {}),
      };
    });

    return {
      regions,
      lastUpdated,
      ...(error ? { error: error.message } : {}),
    };
  },
);
