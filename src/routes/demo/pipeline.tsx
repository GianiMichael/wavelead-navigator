import { createFileRoute } from "@tanstack/react-router";

import { PipelinePage } from "@/pages/PipelinePage";

export const Route = createFileRoute("/demo/pipeline")({
  head: () => ({
    meta: [
      { title: "Demo — Outreach Command Center — WaveClimate" },
      {
        name: "description",
        content:
          "Sample outreach command center showing lead status, industry mix and engagement — demo data only.",
      },
      { property: "og:title", content: "Demo — Outreach Command Center — WaveClimate" },
      {
        property: "og:description",
        content: "Sample pipeline records with statuses, tiers and campaign assignment.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => <PipelinePage demo />,
});
