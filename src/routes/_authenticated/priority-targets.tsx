import { createFileRoute } from "@tanstack/react-router";

import { PriorityTargetsPage, intelQuery } from "@/pages/MarketIntelPage";

export const Route = createFileRoute("/_authenticated/priority-targets")({
  loader: ({ context }) => context.queryClient.ensureQueryData(intelQuery),
  head: () => ({
    meta: [
      { title: "Market Intelligence — WaveClimate Lead Engine" },
      {
        name: "description",
        content:
          "Today's top industry + state pick, commercial electricity rates by deregulated state, CBECS energy intensity and live U.S. grid demand.",
      },
      { property: "og:title", content: "Market Intelligence — WaveClimate Lead Engine" },
      {
        property: "og:description",
        content:
          "Five focused market visuals: top pick, state electricity rates, energy intensity by industry and live grid demand.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => <PriorityTargetsPage />,
  errorComponent: ({ error }) => (
    <main className="pipeline-scope flex min-h-screen items-center justify-center px-6">
      <p role="alert" className="text-sm text-white/70">
        Market intelligence didn&apos;t load: {error.message}
      </p>
    </main>
  ),
});
