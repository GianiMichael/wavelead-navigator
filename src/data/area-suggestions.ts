// Local type-ahead source for the Lead Engine "Area" field.
// No API calls — edit freely to add metros.

import { MARKETS } from "@/data/deregulated-markets";

export interface AreaSuggestion {
  label: string;
  state: string;
  deregulated: boolean;
}

/** Major metros, grouped by state. Deregulated markets first — those convert. */
const METROS: Record<string, string[]> = {
  TX: ["Houston", "Dallas", "Fort Worth", "San Antonio", "Austin", "El Paso", "Corpus Christi", "Lubbock", "Laredo", "McAllen"],
  PA: ["Philadelphia", "Pittsburgh", "Allentown", "Erie", "Harrisburg", "Scranton"],
  OH: ["Columbus", "Cleveland", "Cincinnati", "Toledo", "Akron", "Dayton"],
  IL: ["Chicago", "Aurora", "Naperville", "Joliet", "Rockford", "Springfield"],
  NY: ["New York", "Brooklyn", "Queens", "Buffalo", "Rochester", "Syracuse", "Albany", "Yonkers"],
  NJ: ["Newark", "Jersey City", "Paterson", "Elizabeth", "Trenton", "Edison"],
  MA: ["Boston", "Worcester", "Springfield", "Cambridge", "Lowell", "Quincy"],
  CT: ["Hartford", "New Haven", "Bridgeport", "Stamford", "Waterbury", "Norwalk"],
  MD: ["Baltimore", "Columbia", "Frederick", "Rockville", "Silver Spring", "Annapolis"],
  DE: ["Wilmington", "Dover", "Newark"],
  DC: ["Washington"],
  ME: ["Portland", "Lewiston", "Bangor"],
  NH: ["Manchester", "Nashua", "Concord"],
  RI: ["Providence", "Warwick", "Cranston"],
  MI: ["Detroit", "Grand Rapids", "Ann Arbor", "Lansing", "Warren", "Flint"],
  CA: ["Los Angeles", "San Diego", "San Jose", "San Francisco", "Fresno", "Sacramento", "Long Beach", "Oakland", "Bakersfield", "Riverside"],
  OR: ["Portland", "Salem", "Eugene", "Hillsboro", "Bend"],
  VA: ["Virginia Beach", "Richmond", "Norfolk", "Chesapeake", "Arlington", "Alexandria"],
  MT: ["Billings", "Missoula", "Bozeman", "Great Falls"],
  GA: ["Atlanta", "Augusta", "Savannah", "Columbus", "Macon"],
  FL: ["Miami", "Orlando", "Tampa", "Jacksonville", "St. Petersburg"],
  NC: ["Charlotte", "Raleigh", "Greensboro", "Durham"],
  AZ: ["Phoenix", "Tucson", "Mesa", "Chandler"],
  WA: ["Seattle", "Spokane", "Tacoma", "Bellevue"],
  CO: ["Denver", "Colorado Springs", "Aurora", "Fort Collins"],
  TN: ["Nashville", "Memphis", "Knoxville", "Chattanooga"],
  IN: ["Indianapolis", "Fort Wayne", "Evansville"],
  MO: ["Kansas City", "St. Louis", "Springfield"],
  WI: ["Milwaukee", "Madison", "Green Bay"],
  MN: ["Minneapolis", "St. Paul", "Rochester"],
  NV: ["Las Vegas", "Henderson", "Reno"],
  UT: ["Salt Lake City", "West Valley City", "Provo"],
  SC: ["Charleston", "Columbia", "Greenville"],
  AL: ["Birmingham", "Huntsville", "Montgomery", "Mobile"],
  LA: ["New Orleans", "Baton Rouge", "Shreveport"],
  OK: ["Oklahoma City", "Tulsa"],
  KY: ["Louisville", "Lexington"],
  IA: ["Des Moines", "Cedar Rapids"],
  KS: ["Wichita", "Overland Park"],
  AR: ["Little Rock", "Fayetteville"],
  MS: ["Jackson", "Gulfport"],
  NE: ["Omaha", "Lincoln"],
  NM: ["Albuquerque", "Santa Fe"],
  ID: ["Boise", "Meridian"],
  WV: ["Charleston", "Huntington"],
  HI: ["Honolulu"],
  AK: ["Anchorage"],
  ND: ["Fargo", "Bismarck"],
  SD: ["Sioux Falls", "Rapid City"],
  VT: ["Burlington"],
  WY: ["Cheyenne", "Casper"],
};

function build(): AreaSuggestion[] {
  const out: AreaSuggestion[] = [];
  for (const m of MARKETS) {
    const deregulated = m.status !== "regulated";
    out.push({ label: m.name, state: m.code, deregulated });
    for (const city of METROS[m.code] ?? []) {
      out.push({ label: `${city}, ${m.code}`, state: m.code, deregulated });
    }
  }
  return out;
}

export const AREA_SUGGESTIONS: AreaSuggestion[] = build();

/** Prefix matches first, then substring; deregulated markets outrank regulated. */
export function matchAreas(query: string, limit = 8): AreaSuggestion[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const scored: { s: AreaSuggestion; score: number }[] = [];
  for (const s of AREA_SUGGESTIONS) {
    const label = s.label.toLowerCase();
    let score: number | null = null;
    if (label.startsWith(q)) score = 0;
    else if (s.state.toLowerCase() === q) score = 1;
    else if (label.includes(q)) score = 2;
    if (score === null) continue;
    if (!s.deregulated) score += 3;
    scored.push({ s, score });
  }
  scored.sort((a, b) => a.score - b.score || a.s.label.localeCompare(b.s.label));
  return scored.slice(0, limit).map((x) => x.s);
}
