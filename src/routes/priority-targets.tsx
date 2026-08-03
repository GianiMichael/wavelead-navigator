import { createFileRoute, Link } from "@tanstack/react-router";

import { CBECS_SOURCE, rankedIntensity } from "@/data/energy-intensity";

export const Route = createFileRoute("/priority-targets")({
  head: () => ({
    meta: [
      { title: "Priority Targets — WaveClimate Lead Engine" },
      {
        name: "description",
        content:
          "Rank commercial verticals by energy intensity using EIA CBECS survey data to focus outreach on the highest-spend markets.",
      },
      { property: "og:title", content: "Priority Targets — WaveClimate Lead Engine" },
      {
        property: "og:description",
        content: "Market intelligence layer ranking industry verticals by energy intensity.",
      },
    ],
  }),
  component: PriorityTargetsPage,
});

function PriorityTargetsPage() {
  const ranked = rankedIntensity();
  const max = Math.max(...ranked.map((r) => r.score));

  return (
    <main className="pipeline-scope min-h-screen">
      <div
        className="min-h-screen"
        style={{
          backgroundImage:
            "radial-gradient(900px 500px at 12% -8%, oklch(0.62 0.24 300 / 0.22), transparent 60%), radial-gradient(760px 420px at 92% 0%, oklch(0.82 0.15 55 / 0.16), transparent 62%)",
        }}
      >
        <header className="border-b border-white/10">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-6">
            <div className="flex items-baseline gap-3">
              <span className="headline text-lg">WaveClimate</span>
              <span className="eyebrow" style={{ color: "var(--cc-muted)" }}>
                Priority Targets
              </span>
            </div>
            <nav className="flex items-center gap-5 text-sm">
              <Link to="/" className="text-white/60 transition-colors hover:text-white">
                Lead Engine
              </Link>
              <Link to="/pipeline" className="text-white/60 transition-colors hover:text-white">
                Pipeline
              </Link>
              <Link to="/priority-targets" className="font-medium text-white">
                Priority Targets
              </Link>
            </nav>
          </div>
        </header>

        <section className="mx-auto max-w-6xl px-6 py-12">
          <h1 className="headline text-3xl">
            Where the <span className="grad-text">energy spend</span> lives
          </h1>
          <p className="mt-2 max-w-xl text-sm" style={{ color: "var(--cc-muted)" }}>
            Verticals ranked by building energy intensity. Higher intensity means a bigger
            electricity bill per square foot — and a bigger reason to take your call.
          </p>

          <div className="glass-panel mt-10 rounded-2xl p-6 sm:p-8">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <div className="eyebrow" style={{ color: "var(--cc-muted)" }}>
                Energy intensity by vertical
              </div>
              <div className="text-xs" style={{ color: "var(--cc-muted)" }}>
                Source: {CBECS_SOURCE.name} · {CBECS_SOURCE.edition} · data year{" "}
                {CBECS_SOURCE.dataDate}
              </div>
            </div>

            <div className="mt-8 space-y-5">
              {ranked.map((row, i) => (
                <div key={row.key}>
                  <div className="flex items-baseline justify-between gap-4">
                    <div className="flex items-baseline gap-3">
                      <span
                        className="text-xs tabular-nums"
                        style={{ color: "var(--cc-muted)" }}
                      >
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <span className="text-sm font-medium">{row.label}</span>
                    </div>
                    <div className="flex items-baseline gap-3 text-xs">
                      {row.siteEui !== undefined && (
                        <span style={{ color: "var(--cc-muted)" }}>
                          ~{row.siteEui} kBtu/sq ft
                        </span>
                      )}
                      <span className="tabular-nums font-medium">{row.score.toFixed(1)}</span>
                    </div>
                  </div>
                  <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-white/8">
                    <div
                      className="grad-fill h-full rounded-full"
                      style={{ width: `${(row.score / max) * 100}%` }}
                    />
                  </div>
                  <div className="mt-1.5 text-[11px]" style={{ color: "var(--cc-muted)" }}>
                    CBECS activity: {row.cbecsActivity}
                  </div>
                </div>
              ))}
            </div>

            <p className="mt-8 text-xs" style={{ color: "var(--cc-muted)" }}>
              Scores are a 1-10 normalization of CBECS site energy use intensity. This is survey
              data from {CBECS_SOURCE.dataDate}, not real-time consumption. Live retail rates,
              forecasts and market density arrive in later phases.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
