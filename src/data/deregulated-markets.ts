// Editable lookup: U.S. states/markets deregulated for COMMERCIAL electricity.
// Tweak freely — nothing else in the app hardcodes this list.

export type MarketStatus = "deregulated" | "partial" | "regulated";

export interface DeregulatedMarket {
  code: string;
  name: string;
  status: MarketStatus;
  note?: string;
}

export const MARKETS: DeregulatedMarket[] = [
  { code: "TX", name: "Texas", status: "deregulated", note: "ERCOT — fully competitive" },
  { code: "PA", name: "Pennsylvania", status: "deregulated" },
  { code: "OH", name: "Ohio", status: "deregulated" },
  { code: "IL", name: "Illinois", status: "deregulated" },
  { code: "NY", name: "New York", status: "deregulated" },
  { code: "NJ", name: "New Jersey", status: "deregulated" },
  { code: "MA", name: "Massachusetts", status: "deregulated" },
  { code: "CT", name: "Connecticut", status: "deregulated" },
  { code: "MD", name: "Maryland", status: "deregulated" },
  { code: "DE", name: "Delaware", status: "deregulated" },
  { code: "DC", name: "District of Columbia", status: "deregulated" },
  { code: "ME", name: "Maine", status: "deregulated" },
  { code: "NH", name: "New Hampshire", status: "deregulated" },
  { code: "RI", name: "Rhode Island", status: "deregulated" },
  { code: "MI", name: "Michigan", status: "partial", note: "10% retail choice cap" },
  { code: "CA", name: "California", status: "partial", note: "Limited direct access" },
  { code: "OR", name: "Oregon", status: "partial", note: "Large commercial only" },
  { code: "VA", name: "Virginia", status: "partial", note: "Large load / 100% renewable" },
  { code: "MT", name: "Montana", status: "partial" },
  { code: "GA", name: "Georgia", status: "partial", note: "Large commercial (900kW+)" },
  { code: "AL", name: "Alabama", status: "regulated" },
  { code: "AK", name: "Alaska", status: "regulated" },
  { code: "AZ", name: "Arizona", status: "regulated" },
  { code: "AR", name: "Arkansas", status: "regulated" },
  { code: "CO", name: "Colorado", status: "regulated" },
  { code: "FL", name: "Florida", status: "regulated" },
  { code: "HI", name: "Hawaii", status: "regulated" },
  { code: "ID", name: "Idaho", status: "regulated" },
  { code: "IN", name: "Indiana", status: "regulated" },
  { code: "IA", name: "Iowa", status: "regulated" },
  { code: "KS", name: "Kansas", status: "regulated" },
  { code: "KY", name: "Kentucky", status: "regulated" },
  { code: "LA", name: "Louisiana", status: "regulated" },
  { code: "MN", name: "Minnesota", status: "regulated" },
  { code: "MS", name: "Mississippi", status: "regulated" },
  { code: "MO", name: "Missouri", status: "regulated" },
  { code: "NE", name: "Nebraska", status: "regulated" },
  { code: "NV", name: "Nevada", status: "regulated" },
  { code: "NM", name: "New Mexico", status: "regulated" },
  { code: "NC", name: "North Carolina", status: "regulated" },
  { code: "ND", name: "North Dakota", status: "regulated" },
  { code: "OK", name: "Oklahoma", status: "regulated" },
  { code: "SC", name: "South Carolina", status: "regulated" },
  { code: "SD", name: "South Dakota", status: "regulated" },
  { code: "TN", name: "Tennessee", status: "regulated" },
  { code: "UT", name: "Utah", status: "regulated" },
  { code: "VT", name: "Vermont", status: "regulated" },
  { code: "WA", name: "Washington", status: "regulated" },
  { code: "WV", name: "West Virginia", status: "regulated" },
  { code: "WI", name: "Wisconsin", status: "regulated" },
  { code: "WY", name: "Wyoming", status: "regulated" },
];

const BY_CODE = new Map(MARKETS.map((m) => [m.code, m]));
const BY_NAME = new Map(MARKETS.map((m) => [m.name.toLowerCase(), m]));

export function lookupMarket(stateCodeOrName?: string | null): DeregulatedMarket | undefined {
  if (!stateCodeOrName) return undefined;
  const v = stateCodeOrName.trim();
  return BY_CODE.get(v.toUpperCase()) ?? BY_NAME.get(v.toLowerCase());
}

/** Extract a 2-letter state code from a formatted US address. */
export function stateFromAddress(address?: string | null): string | undefined {
  if (!address) return undefined;
  const m = address.match(/,\s*([A-Z]{2})\s+\d{5}(?:-\d{4})?/);
  if (m) return m[1];
  const m2 = address.match(/,\s*([A-Z]{2})\b/);
  return m2?.[1];
}
