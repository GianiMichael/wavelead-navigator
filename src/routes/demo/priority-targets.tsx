import { createFileRoute } from "@tanstack/react-router";

import { PriorityTargetsPage, intelQuery } from "@/pages/MarketIntelPage";

export const Route = createFileRoute("/demo/priority-targets")({
  loader: ({ context }) => context.queryClient.ensureQueryData(intelQuery),
  head: () => ({
    meta: [
      { title: "Demo — Market Intelligence — WaveClimate" },
      {
        name: "description",
        content:
          "Live commercial electricity rates, CBECS energy intensity and U.S. grid demand — public data, shown live even in demo mode.",
      },
      { property: "og:title", content: "Demo — Market Intelligence — WaveClimate" },
      {
        property: "og:description",
        content: "Top pick, state electricity rates, energy intensity and live grid demand.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => <PriorityTargetsPage demo />,
  errorComponent: ({ error }) => (
    <main className="pipeline-scope flex min-h-screen items-center justify-center px-6">
      <p role="alert" className="text-sm text-white/70">
        Market intelligence didn&apos;t load: {error.message}
      </p>
    </main>
  ),
});
