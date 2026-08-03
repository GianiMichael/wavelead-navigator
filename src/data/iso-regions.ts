// ISO/RTO wholesale market regions and the deregulated states they serve.
// Editable: hub + dataset control which GridStatus.io series we cache.

export interface IsoRegion {
  code: string;
  name: string;
  /** GridStatus.io dataset id. */
  dataset: string;
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
    hub: "HB_HOUSTON",
    hubLabel: "Houston Hub",
    priceColumn: "spp",
    states: ["TX"],
  },
  {
    code: "PJM",
    name: "PJM (Mid-Atlantic)",
    dataset: "pjm_lmp_day_ahead_hourly",
    hub: "WESTERN HUB",
    hubLabel: "Western Hub",
    priceColumn: "lmp",
    states: ["PA", "NJ", "MD", "DC", "DE", "OH"],
  },
  {
    code: "NYISO",
    name: "NYISO (New York)",
    dataset: "nyiso_lmp_day_ahead_hourly",
    hub: "N.Y.C.",
    hubLabel: "N.Y.C. Zone",
    priceColumn: "lmp",
    states: ["NY"],
  },
  {
    code: "ISONE",
    name: "ISO-NE (New England)",
    dataset: "isone_lmp_day_ahead_hourly",
    hub: ".H.INTERNAL_HUB",
    hubLabel: "Internal Hub",
    priceColumn: "lmp",
    states: ["MA", "CT", "ME", "NH", "RI"],
  },
  {
    code: "CAISO",
    name: "CAISO (California)",
    dataset: "caiso_lmp_day_ahead_hourly",
    hub: "TH_SP15_GEN-APND",
    hubLabel: "SP15 Hub",
    priceColumn: "lmp",
    states: ["CA"],
  },
  {
    code: "MISO",
    name: "MISO (Midwest)",
    dataset: "miso_lmp_day_ahead_hourly",
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
