import tiersConfig from "@/data/title-tiers.json";
import type { EnrichedContact } from "@/lib/types";

type TiersConfig = {
  industries: Record<string, { label: string; tiers: string[] }>;
  keywords: Record<string, string[]>;
};

const CONFIG = tiersConfig as TiersConfig;

export const INDUSTRY_OPTIONS = Object.entries(CONFIG.industries).map(([key, v]) => ({
  key,
  label: v.label,
  tiers: v.tiers,
}));

export function tiersForIndustry(industryKey: string): string[] {
  return (CONFIG.industries[industryKey] ?? CONFIG.industries.default).tiers;
}

function normalize(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
}

/** 0..1 loose similarity between a title and a tier keyword. */
function keywordScore(title: string, keyword: string): number {
  const t = normalize(title);
  const k = normalize(keyword);
  if (!t || !k) return 0;
  if (t === k) return 1;
  if (t.includes(k)) return 0.9;
  const kWords = k.split(" ");
  const tWords = new Set(t.split(" "));
  const hits = kWords.filter((w) => tWords.has(w) || [...tWords].some((tw) => tw.startsWith(w)));
  return hits.length / kWords.length >= 0.6 ? (hits.length / kWords.length) * 0.75 : 0;
}

export interface TierMatch {
  contact: EnrichedContact;
  tier: string;
  tierIndex: number;
  score: number;
}

/** Select the best decision-maker for an industry from a contact list. */
export function matchDecisionMaker(
  contacts: EnrichedContact[],
  industryKey: string,
): TierMatch | null {
  const tiers = tiersForIndustry(industryKey);
  let best: TierMatch | null = null;

  tiers.forEach((tier, tierIndex) => {
    const keywords = CONFIG.keywords[tier] ?? [normalize(tier)];
    contacts.forEach((contact) => {
      if (!contact.title) return;
      const score = Math.max(...keywords.map((k) => keywordScore(contact.title, k)));
      if (score < 0.5) return;
      const candidate: TierMatch = { contact, tier, tierIndex, score };
      if (
        !best ||
        candidate.tierIndex < best.tierIndex ||
        (candidate.tierIndex === best.tierIndex && candidate.score > best.score)
      ) {
        best = candidate;
      }
    });
  });

  return best;
}

export function rankAllMatches(contacts: EnrichedContact[], industryKey: string): TierMatch[] {
  const tiers = tiersForIndustry(industryKey);
  const out: TierMatch[] = [];
  contacts.forEach((contact) => {
    let bestForContact: TierMatch | null = null;
    tiers.forEach((tier, tierIndex) => {
      const keywords = CONFIG.keywords[tier] ?? [normalize(tier)];
      const score = Math.max(...keywords.map((k) => keywordScore(contact.title ?? "", k)));
      if (score >= 0.5 && (!bestForContact || tierIndex < bestForContact.tierIndex)) {
        bestForContact = { contact, tier, tierIndex, score };
      }
    });
    out.push(bestForContact ?? { contact, tier: "Unmatched", tierIndex: 99, score: 0 });
  });
  return out.sort((a, b) => a.tierIndex - b.tierIndex || b.score - a.score);
}
