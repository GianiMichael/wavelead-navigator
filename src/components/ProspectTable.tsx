import type { Prospect } from "@/lib/types";
import { Button } from "@/components/ui/button";

function MarketBadge({ status }: { status: Prospect["marketStatus"] }) {
  const map: Record<Prospect["marketStatus"], { label: string; className: string }> = {
    deregulated: { label: "Deregulated", className: "bg-accent/12 text-accent border-accent/30" },
    partial: { label: "Partial", className: "bg-muted text-muted-foreground border-border" },
    regulated: { label: "Regulated", className: "bg-muted text-muted-foreground border-border" },
    unknown: { label: "Unknown", className: "bg-muted text-muted-foreground border-border" },
  };
  const s = map[status];
  return (
    <span
      className={`inline-flex items-center border px-2 py-0.5 text-[11px] font-medium tracking-wide ${s.className}`}
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
}: {
  prospects: Prospect[];
  onEnrich: (p: Prospect) => void;
  enrichingId: string | null;
  enrichedIds: Set<string>;
}) {
  return (
    <div className="overflow-x-auto border border-border">
      <table className="w-full min-w-[900px] text-sm">
        <thead>
          <tr className="border-b border-border bg-secondary/60 text-left">
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
            <tr key={p.id} className="border-b border-border last:border-0 align-top">
              <td className="px-4 py-4">
                <div className="font-medium text-foreground">{p.name}</div>
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
                  variant={enrichedIds.has(p.id) ? "outline" : "default"}
                  disabled={!p.domain || enrichingId === p.id}
                  onClick={() => onEnrich(p)}
                >
                  {enrichingId === p.id
                    ? "Enriching…"
                    : enrichedIds.has(p.id)
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
