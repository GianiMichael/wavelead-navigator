// ISO/RTO wholesale market regions and the deregulated states they serve.
// Editable: hub + dataset control which GridStatus.io series we cache.

export interface IsoRegion {
  code: string;
  name: string;
  /** GridStatus.io day-ahead hourly dataset id (primary displayed price). */
  dataset: string;
  /** Real-time price dataset id, used for the day-ahead vs real-time spread. */
  rtDataset: string;
  /** Regional load dataset id (current demand in MW). */
  loadDataset: string;
  /** Trading hub used as the representative price for the region. */
  hub: string;
  /** Human label for the hub. */
  hubLabel: string;
  /** Column holding the price value in that dataset. */
  priceColumn: string;
  /** Tracked states served by this ISO. */
  states: string[];
}

export const ISO_REGIONS: IsoRegion[] = [
  {
    code: "ERCOT",
    name: "ERCOT (Texas)",
    dataset: "ercot_spp_day_ahead_hourly",
    rtDataset: "ercot_spp_real_time_15_min",
    loadDataset: "ercot_load",
    hub: "HB_HOUSTON",
    hubLabel: "Houston Hub",
    priceColumn: "spp",
    states: ["TX"],
  },
  {
    code: "PJM",
    name: "PJM (Mid-Atlantic)",
    dataset: "pjm_lmp_day_ahead_hourly",
    rtDataset: "pjm_lmp_real_time_5_min",
    loadDataset: "pjm_load",
    hub: "WESTERN HUB",
    hubLabel: "Western Hub",
    priceColumn: "lmp",
    states: ["PA", "NJ", "MD", "DC", "DE", "OH"],
  },
  {
    code: "NYISO",
    name: "NYISO (New York)",
    dataset: "nyiso_lmp_day_ahead_hourly",
    rtDataset: "nyiso_lmp_real_time_5_min",
    loadDataset: "nyiso_load",
    hub: "N.Y.C.",
    hubLabel: "N.Y.C. Zone",
    priceColumn: "lmp",
    states: ["NY"],
  },
  {
    code: "ISONE",
    name: "ISO-NE (New England)",
    dataset: "isone_lmp_day_ahead_hourly",
    rtDataset: "isone_lmp_real_time_5_min",
    loadDataset: "isone_load",
    hub: ".H.INTERNAL_HUB",
    hubLabel: "Internal Hub",
    priceColumn: "lmp",
    states: ["MA", "CT", "ME", "NH", "RI"],
  },
  {
    code: "CAISO",
    name: "CAISO (California)",
    dataset: "caiso_lmp_day_ahead_hourly",
    rtDataset: "caiso_lmp_real_time_5_min",
    loadDataset: "caiso_load",
    hub: "TH_SP15_GEN-APND",
    hubLabel: "SP15 Hub",
    priceColumn: "lmp",
    states: ["CA"],
  },
  {
    code: "MISO",
    name: "MISO (Midwest)",
    dataset: "miso_lmp_day_ahead_hourly",
    rtDataset: "miso_lmp_real_time_5_min",
    loadDataset: "miso_load",
    hub: "INDIANA.HUB",
    hubLabel: "Indiana Hub",
    priceColumn: "lmp",
    states: ["MI", "IL"],
  },
];

const STATE_TO_ISO = new Map<string, IsoRegion>();
for (const r of ISO_REGIONS) for (const s of r.states) STATE_TO_ISO.set(s, r);

export function isoForState(state?: string | null): IsoRegion | undefined {
  if (!state) return undefined;
  return STATE_TO_ISO.get(state.trim().toUpperCase());
}

/**
 * Approximate map footprints for the boundary overlay. ISO territories follow
 * utility service areas, not state lines, so several states are split between
 * markets — those are listed under `partial` and drawn with a dashed outline.
 */
export interface IsoFootprint {
  code: string;
  /** States served (essentially) in full by this ISO. */
  full: string[];
  /** States split between this ISO and another market. */
  partial: string[];
  /** Overlay outline color. */
  color: string;
}

export const ISO_FOOTPRINTS: IsoFootprint[] = [
  { code: "ERCOT", full: ["TX"], partial: [], color: "oklch(0.80 0.16 55)" },
  {
    code: "PJM",
    full: ["PA", "NJ", "MD", "DC", "DE", "OH", "WV", "VA"],
    partial: ["IL", "IN", "KY", "NC", "TN", "MI"],
    color: "oklch(0.72 0.19 300)",
  },
  { code: "NYISO", full: ["NY"], partial: [], color: "oklch(0.78 0.15 200)" },
  {
    code: "ISONE",
    full: ["MA", "CT", "ME", "NH", "RI", "VT"],
    partial: [],
    color: "oklch(0.82 0.13 150)",
  },
  { code: "CAISO", full: ["CA"], partial: [], color: "oklch(0.80 0.14 25)" },
  {
    code: "MISO",
    full: ["IA", "MN", "ND", "SD", "WI", "AR", "LA", "MS"],
    partial: ["IL", "IN", "MI", "MO", "MT", "TX", "KY"],
    color: "oklch(0.75 0.14 250)",
  },
];
