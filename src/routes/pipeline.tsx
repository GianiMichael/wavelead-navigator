import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import { syncLeadStatuses } from "@/lib/lead-engine.functions";
import {
  applyStatusUpdates,
  loadPipeline,
  savePipeline,
  ENGAGED_STATUSES,
  LEAD_STATUSES,
  type LeadStatus,
  type PipelineRecord,
} from "@/lib/pipeline-store";
import { INDUSTRY_OPTIONS } from "@/lib/tier-matching";

export const Route = createFileRoute("/pipeline")({
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
    ],
  }),
  component: PipelinePage,
});

const TIERS = ["Tier 1", "Tier 2", "Tier 3", "Tier 4"];

function statusTone(status: LeadStatus) {
  switch (status) {
    case "Replied":
    case "Interested":
      return "border-emerald-400/30 bg-emerald-400/10 text-emerald-200";
    case "Clicked":
    case "Opened":
      return "border-sky-400/30 bg-sky-400/10 text-sky-200";
    case "Bounced":
    case "Not interested":
      return "border-rose-400/30 bg-rose-400/10 text-rose-200";
    default:
      return "border-white/15 bg-white/5 text-white/70";
  }
}

function PipelinePage() {
  const runSync = useServerFn(syncLeadStatuses);

  const [records, setRecords] = useState<PipelineRecord[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [lastSynced, setLastSynced] = useState<string | null>(null);

  const [industryFilter, setIndustryFilter] = useState("all");
  const [tierFilter, setTierFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortDesc, setSortDesc] = useState(true);

  async function sync(current: PipelineRecord[], silent = false) {
    const ids = current.map((r) => r.leadId).filter(Boolean);
    if (ids.length === 0) return;
    setSyncing(true);
    try {
      const res = await runSync({ data: { leadIds: ids } });
      const next = applyStatusUpdates(current, res.statuses as Record<string, LeadStatus>, res.syncedAt);
      setRecords(next);
      savePipeline(next);
      setLastSynced(res.syncedAt);
      setSyncError(null);
      if (!silent) toast.success("Statuses synced with Instantly.");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Instantly sync failed.";
      setSyncError(msg);
      if (!silent) toast.error(msg);
    } finally {
      setSyncing(false);
    }
  }

  useEffect(() => {
    const stored = loadPipeline();
    setRecords(stored);
    const newest = stored
      .map((r) => r.lastSynced)
      .filter(Boolean)
      .sort()
      .pop();
    if (newest) setLastSynced(newest);
    void sync(stored, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const engaged = records.filter((r) => ENGAGED_STATUSES.includes(r.status)).length;
  const enriched = records.length;
  const sent = records.filter((r) => r.status !== "Pending").length;

  const byIndustry = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of records) map.set(r.industryLabel, (map.get(r.industryLabel) ?? 0) + 1);
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [records]);
  const maxIndustry = byIndustry[0]?.[1] ?? 1;

  const filtered = useMemo(() => {
    const rows = records.filter(
      (r) =>
        (industryFilter === "all" || r.industry === industryFilter) &&
        (tierFilter === "all" || r.tier === tierFilter) &&
        (statusFilter === "all" || r.status === statusFilter),
    );
    return rows.sort((a, b) =>
      sortDesc
        ? b.dateAdded.localeCompare(a.dateAdded)
        : a.dateAdded.localeCompare(b.dateAdded),
    );
  }, [records, industryFilter, tierFilter, statusFilter, sortDesc]);

  function chip(active: boolean) {
    return `rounded-full border px-3 py-1 text-xs transition-all duration-200 ${
      active
        ? "grad-fill border-transparent font-medium text-black"
        : "border-white/15 bg-white/5 text-white/60 hover:text-white"
    }`;
  }

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
                Pipeline
              </span>
            </div>
            <nav className="flex items-center gap-5 text-sm">
              <Link to="/" className="text-white/60 transition-colors hover:text-white">
                Lead Engine
              </Link>
              <Link to="/pipeline" className="font-medium text-white">
                Pipeline
              </Link>
              <button
                onClick={() => void sync(records)}
                disabled={syncing}
                className="grad-fill rounded-full px-4 py-2 text-xs font-medium text-black transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {syncing ? "Syncing…" : "Refresh status"}
              </button>
            </nav>
          </div>
        </header>

        <section className="mx-auto max-w-6xl px-6 py-12">
          <h1 className="headline text-3xl">Outreach command center</h1>
          <p className="mt-2 max-w-xl text-sm" style={{ color: "var(--cc-muted)" }}>
            Every prospect enriched and routed to Instantly, with status pulled live from the
            campaign.
          </p>
          {(syncError || lastSynced) && (
            <p className="mt-3 text-xs" style={{ color: "var(--cc-muted)" }}>
              {syncError
                ? `Instantly unreachable — showing last known status. ${
                    lastSynced ? `Last synced ${new Date(lastSynced).toLocaleString()}.` : ""
                  }`
                : `Last synced ${new Date(lastSynced!).toLocaleString()}.`}
            </p>
          )}

          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { label: "Prospects saved", value: records.length, accent: true },
              { label: "Contacts enriched", value: enriched, accent: false },
              { label: "Sent to outreach", value: sent, accent: false },
              { label: "Replied / engaged", value: engaged, accent: true },
            ].map((s) => (
              <div key={s.label} className="glass-panel glass-hover rounded-2xl p-6">
                <div
                  className={`stat-number ${s.accent ? "grad-text" : ""}`}
                  style={s.accent ? undefined : { color: "var(--cc-fg)" }}
                >
                  {s.value}
                </div>
                <div className="eyebrow mt-3" style={{ color: "var(--cc-muted)" }}>
                  {s.label}
                </div>
              </div>
            ))}
          </div>

          <div className="glass-panel mt-8 rounded-2xl p-6">
            <div className="eyebrow" style={{ color: "var(--cc-muted)" }}>
              Leads by industry vertical
            </div>
            <div className="mt-6 space-y-4">
              {byIndustry.length === 0 && (
                <p className="text-sm" style={{ color: "var(--cc-muted)" }}>
                  No leads saved yet.
                </p>
              )}
              {byIndustry.map(([label, count]) => (
                <div key={label} className="flex items-center gap-4">
                  <div className="w-40 shrink-0 text-sm text-white/75">{label}</div>
                  <div className="h-3 flex-1 overflow-hidden rounded-full bg-white/8">
                    <div
                      className="grad-fill h-full rounded-full transition-all duration-500"
                      style={{ width: `${Math.max(4, (count / maxIndustry) * 100)}%` }}
                    />
                  </div>
                  <div className="w-8 text-right text-sm tabular-nums text-white/70">{count}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="glass-panel mt-8 rounded-2xl p-6">
            <div className="flex flex-wrap items-center gap-6">
              <div className="flex flex-wrap items-center gap-2">
                <span className="eyebrow" style={{ color: "var(--cc-muted)" }}>
                  Industry
                </span>
                <button className={chip(industryFilter === "all")} onClick={() => setIndustryFilter("all")}>
                  All
                </button>
                {INDUSTRY_OPTIONS.map((o) => (
                  <button
                    key={o.key}
                    className={chip(industryFilter === o.key)}
                    onClick={() => setIndustryFilter(o.key)}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-6">
              <div className="flex flex-wrap items-center gap-2">
                <span className="eyebrow" style={{ color: "var(--cc-muted)" }}>
                  Tier
                </span>
                <button className={chip(tierFilter === "all")} onClick={() => setTierFilter("all")}>
                  All
                </button>
                {TIERS.map((t) => (
                  <button key={t} className={chip(tierFilter === t)} onClick={() => setTierFilter(t)}>
                    {t}
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="eyebrow" style={{ color: "var(--cc-muted)" }}>
                  Status
                </span>
                <button className={chip(statusFilter === "all")} onClick={() => setStatusFilter("all")}>
                  All
                </button>
                {LEAD_STATUSES.map((s) => (
                  <button key={s} className={chip(statusFilter === s)} onClick={() => setStatusFilter(s)}>
                    {s}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-6 overflow-x-auto">
              <table className="w-full min-w-[900px] text-left text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-xs uppercase tracking-wider text-white/45">
                    <th className="py-3 pr-4 font-medium">Business</th>
                    <th className="py-3 pr-4 font-medium">Contact</th>
                    <th className="py-3 pr-4 font-medium">Tier</th>
                    <th className="py-3 pr-4 font-medium">Industry</th>
                    <th className="py-3 pr-4 font-medium">Deregulated</th>
                    <th className="py-3 pr-4 font-medium">Campaign</th>
                    <th className="py-3 pr-4 font-medium">Status</th>
                    <th className="py-3 font-medium">
                      <button
                        onClick={() => setSortDesc((v) => !v)}
                        className="uppercase tracking-wider transition-colors hover:text-white"
                      >
                        Date added {sortDesc ? "↓" : "↑"}
                      </button>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r) => (
                    <tr
                      key={r.leadId}
                      className="border-b border-white/5 transition-colors hover:bg-white/5"
                    >
                      <td className="py-3 pr-4">
                        <div className="text-white/90">{r.businessName}</div>
                        <div className="text-xs text-white/40">{r.energyPriority} energy priority</div>
                      </td>
                      <td className="py-3 pr-4">
                        <div className="text-white/85">{r.contactName || r.email}</div>
                        <div className="text-xs text-white/40">{r.title || "Title unknown"}</div>
                      </td>
                      <td className="py-3 pr-4 text-white/70">{r.tier}</td>
                      <td className="py-3 pr-4 text-white/70">{r.industryLabel}</td>
                      <td className="py-3 pr-4 text-white/70">{r.deregulated}</td>
                      <td className="py-3 pr-4 text-white/70">{r.campaignName}</td>
                      <td className="py-3 pr-4">
                        <span className={`rounded-full border px-2.5 py-1 text-xs ${statusTone(r.status)}`}>
                          {r.status}
                        </span>
                      </td>
                      <td className="py-3 text-white/60">
                        {new Date(r.dateAdded).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filtered.length === 0 && (
                <p className="py-10 text-center text-sm" style={{ color: "var(--cc-muted)" }}>
                  {records.length === 0
                    ? "Nothing here yet — send a contact to an Instantly campaign from the Lead Engine."
                    : "No leads match these filters."}
                </p>
              )}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
