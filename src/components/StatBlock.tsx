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
    <div className="border-t border-border pt-5">
      <div className={accent ? "stat-number text-accent" : "stat-number text-foreground"}>
        {value}
      </div>
      <div className="eyebrow mt-3">{label}</div>
    </div>
  );
}
