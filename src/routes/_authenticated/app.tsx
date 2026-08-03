import { createFileRoute } from "@tanstack/react-router";

import { LeadEngine } from "@/pages/LeadEnginePage";

export const Route = createFileRoute("/_authenticated/app")({
  head: () => ({
    meta: [
      { title: "Lead Engine — WaveClimate" },
      {
        name: "description",
        content:
          "Find commercial energy prospects in deregulated markets, enrich decision-makers and route them to outreach.",
      },
      { property: "og:title", content: "Lead Engine — WaveClimate" },
      {
        property: "og:description",
        content:
          "Prospect, qualify and route commercial energy leads across 90+ licensed suppliers.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => <LeadEngine />,
});
