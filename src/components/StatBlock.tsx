export function StatBlock({
  value,
  label,
  accent = false,
}: {
  value: number | string;
  label: string;
  accent?: boolean;
}) {
  return (
    <div className="glass-panel rounded-xl px-5 py-6">
    <div className={accent ? "stat-number text-primary" : "stat-number text-foreground"}>
        {value}
      </div>
      <div className="eyebrow mt-3">{label}</div>
    </div>
  );
}
