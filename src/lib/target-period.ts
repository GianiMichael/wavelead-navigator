/**
 * Biweekly target-list cadence.
 *
 * Energy contracts run on multi-year sales cycles, so the target list is
 * regenerated on a fixed 14-day clock rather than on every page load. Periods
 * are derived deterministically from a fixed anchor so every visitor (and the
 * server cache) agrees on which period they are looking at.
 */

const ANCHOR_UTC = Date.UTC(2026, 0, 5); // Monday, 5 Jan 2026
const PERIOD_DAYS = 14;
const PERIOD_MS = PERIOD_DAYS * 24 * 60 * 60 * 1000;

export interface TargetPeriod {
  /** Stable id, e.g. "2026-P43". */
  id: string;
  /** ISO date (UTC) the list was generated on. */
  generatedAt: string;
  /** ISO date (UTC) of the next refresh. */
  nextRefreshAt: string;
  index: number;
}

export function currentTargetPeriod(now: Date = new Date()): TargetPeriod {
  const index = Math.floor((now.getTime() - ANCHOR_UTC) / PERIOD_MS);
  const start = new Date(ANCHOR_UTC + index * PERIOD_MS);
  const end = new Date(ANCHOR_UTC + (index + 1) * PERIOD_MS);
  return {
    id: `${start.getUTCFullYear()}-P${index}`,
    generatedAt: start.toISOString(),
    nextRefreshAt: end.toISOString(),
    index,
  };
}

export function periodDateLabel(iso: string): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}
