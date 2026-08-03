import { createFileRoute } from "@tanstack/react-router";

import { refreshIsoPrices } from "@/lib/iso-prices.server";

/**
 * Scheduled refresh of the GridStatus.io wholesale price cache.
 * Called once daily by pg_cron; authenticated with the project's anon key.
 */
export const Route = createFileRoute("/api/public/hooks/refresh-iso-prices")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const key =
          request.headers.get("apikey") ??
          request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
        const expected = process.env["SUPABASE_PUBLISHABLE_KEY"] ?? process.env["SUPABASE_ANON_KEY"];
        if (!key || !expected || key !== expected) {
          return new Response(JSON.stringify({ error: "Unauthorized" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
          });
        }

        const result = await refreshIsoPrices();
        return new Response(JSON.stringify(result), {
          status: result.ok ? 200 : 500,
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});
