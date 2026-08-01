import type { Prospect } from "@/lib/types";
import { Button } from "@/components/ui/button";

function MarketBadge({ status }: { status: Prospect["marketStatus"] }) {
  const map: Record<Prospect["marketStatus"], { label: string; className: string }> = {
    deregulated: {
      label: "Deregulated",
      className: "border-primary/40 bg-primary/15 text-foreground",
    },
    partial: { label: "Partial", className: "bg-muted text-muted-foreground border-border" },
    regulated: { label: "Regulated", className: "bg-muted text-muted-foreground border-border" },
    unknown: { label: "Unknown", className: "bg-muted text-muted-foreground border-border" },
  };
  const s = map[status];
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-medium tracking-wide ${s.className}`}
    >
      {s.label}
    </span>
  );
}

export function ProspectTable({
  prospects,
  onEnrich,
  enrichingId,
  enrichedIds,
  cachedDomains,
}: {
  prospects: Prospect[];
  onEnrich: (p: Prospect) => void;
  enrichingId: string | null;
  enrichedIds: Set<string>;
  cachedDomains: Set<string>;
}) {
  const isCached = (p: Prospect) =>
    !!p.domain && cachedDomains.has(p.domain.trim().toLowerCase().replace(/^www\./, ""));

  return (
    <div className="glass-panel overflow-x-auto rounded-xl">
      <table className="w-full min-w-[900px] text-sm">
        <thead>
          <tr className="border-b border-border text-left">
            <th className="eyebrow px-4 py-3 font-medium">Business</th>
            <th className="eyebrow px-4 py-3 font-medium">Address</th>
            <th className="eyebrow px-4 py-3 font-medium">Category</th>
            <th className="eyebrow px-4 py-3 font-medium">Market</th>
            <th className="eyebrow px-4 py-3 font-medium">Benchmarking</th>
            <th className="eyebrow px-4 py-3 font-medium"></th>
          </tr>
        </thead>
        <tbody>
          {prospects.map((p) => (
            <tr
              key={p.id}
              className="border-b border-border align-top transition-colors last:border-0 hover:bg-white/[0.03]"
            >
              <td className="px-4 py-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-foreground">{p.name}</span>
                  {isCached(p) && (
                    <span className="inline-flex items-center rounded-full border border-border bg-white/[0.06] px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                      Already enriched
                    </span>
                  )}
                </div>
                {p.domain ? (
                  <div className="text-xs text-muted-foreground">{p.domain}</div>
                ) : (
                  <div className="text-xs text-muted-foreground">No website</div>
                )}
              </td>
              <td className="max-w-[260px] px-4 py-4 text-muted-foreground">{p.address}</td>
              <td className="px-4 py-4 capitalize text-muted-foreground">{p.category}</td>
              <td className="px-4 py-4">
                <MarketBadge status={p.marketStatus} />
                {p.marketNote && (
                  <div className="mt-1 text-xs text-muted-foreground">{p.marketNote}</div>
                )}
              </td>
              <td className="px-4 py-4 text-muted-foreground">
                {p.benchmark ? (
                  <div className="text-xs">
                    <div className="text-foreground">
                      {p.benchmark.siteEui ? `${p.benchmark.siteEui} kBtu/ft²` : "Disclosed"}
                    </div>
                    <div>
                      {p.benchmark.source} · {p.benchmark.year}
                    </div>
                    {p.benchmark.energyStarScore && (
                      <div>ENERGY STAR {p.benchmark.energyStarScore}</div>
                    )}
                  </div>
                ) : (
                  <span className="text-xs">—</span>
                )}
              </td>
              <td className="px-4 py-4 text-right">
                <Button
                  size="sm"
                  variant={enrichedIds.has(p.id) || isCached(p) ? "outline" : "default"}
                  className="rounded-full"
                  disabled={!p.domain || enrichingId === p.id}
                  onClick={() => onEnrich(p)}
                >
                  {enrichingId === p.id
                    ? "Enriching…"
                    : enrichedIds.has(p.id) || isCached(p)
                      ? "View contacts"
                      : "Enrich"}
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
