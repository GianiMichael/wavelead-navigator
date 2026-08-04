import type { ScoreResult } from "@/lib/priority-score";
import type { TargetPeriod } from "@/lib/target-period";

/**
 * Persistence for the biweekly target list. The list is generated once per
 * 14-day period and then served unchanged to every visitor for that period,
 * so the user gets a stable working list instead of daily noise.
 */

const TABLE = "target_lists";
const LIST_SIZE = 11;

function publicClient() {
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
  return import("@supabase/supabase-js").then(({ createClient }) =>
    createClient(process.env["SUPABASE_URL"]!, key, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: {
        fetch: (input: RequestInfo | URL, init?: RequestInit) => {
          const h = new Headers(init?.headers);
          if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`)
            h.delete("Authorization");
          h.set("apikey", key);
          return fetch(input, { ...init, headers: h });
        },
      },
    }),
  );
}

export async function readStoredTargetList(periodId: string): Promise<ScoreResult[] | null> {
  try {
    const supabase = await publicClient();
    const { data } = await supabase
      .from(TABLE)
      .select("items")
      .eq("period_id", periodId)
      .maybeSingle();
    const items = data?.items as ScoreResult[] | undefined;
    return items && items.length ? items : null;
  } catch {
    return null;
  }
}

export async function storeTargetList(period: TargetPeriod, items: ScoreResult[]): Promise<void> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from(TABLE).upsert(
      {
        period_id: period.id,
        generated_at: period.generatedAt,
        next_refresh_at: period.nextRefreshAt,
        items: items.slice(0, LIST_SIZE),
      },
      { onConflict: "period_id" },
    );
  } catch {
    /* the list still renders from the freshly computed ranking */
  }
}

export const TARGET_LIST_SIZE = LIST_SIZE;
