import { createFileRoute } from "@tanstack/react-router";

import { LeadEngine } from "@/pages/LeadEnginePage";

export const Route = createFileRoute("/demo/app")({
  head: () => ({
    meta: [
      { title: "Demo — Lead Engine — WaveClimate" },
      {
        name: "description",
        content:
          "Explore the WaveClimate Lead Engine with sample prospects and contacts — no login and no live API calls.",
      },
      { property: "og:title", content: "Demo — Lead Engine — WaveClimate" },
      {
        property: "og:description",
        content: "Sample-data walkthrough of prospect search, enrichment and outreach routing.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => <LeadEngine demo />,
});
