import { createFileRoute } from "@tanstack/react-router";

import { PipelinePage } from "@/pages/PipelinePage";

export const Route = createFileRoute("/_authenticated/pipeline")({
  head: () => ({
    meta: [
      { title: "Pipeline — WaveClimate Lead Engine" },
      {
        name: "description",
        content:
          "Live command center for every prospect enriched and routed to outreach, synced with Instantly campaign status.",
      },
      { property: "og:title", content: "Pipeline — WaveClimate Lead Engine" },
      {
        property: "og:description",
        content: "Track outreach status, industry mix and engagement across your saved leads.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => <PipelinePage />,
});
