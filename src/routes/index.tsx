import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { StatBlock } from "@/components/StatBlock";
import { ProspectTable } from "@/components/ProspectTable";
import { INDUSTRY_OPTIONS, rankAllMatches, matchDecisionMaker } from "@/lib/tier-matching";
import { MARKETS } from "@/data/deregulated-markets";
import { energyPriorityForIndustry } from "@/lib/energy-priority";
import { addPipelineRecord } from "@/lib/pipeline-store";
import { defaultBusinessType } from "@/lib/industry-defaults";
import {
  cachedDomains as loadCachedDomains,
  getCachedEnrichment,
  saveEnrichment,
} from "@/lib/enrichment-cache";

import type { EnrichmentResult, Prospect } from "@/lib/types";
import {
  searchProspects,
  enrichCompany,
  getCampaigns,
  sendToCampaign,
} from "@/lib/lead-engine.functions";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Lead Engine — WaveClimate" },
      {
        name: "description",
        content:
          "Find commercial energy prospects in deregulated markets, enrich decision-makers and route them to outreach.",
      },
      { property: "og:title", content: "Lead Engine — WaveClimate" },
      {
        property: "og:description",
        content:
          "Prospect, qualify and route commercial energy leads across 90+ licensed suppliers.",
      },
    ],
  }),
  component: LeadEngine,
});

const DEREGULATED_STATES = MARKETS.filter((m) => m.status === "deregulated");

function LeadEngine() {
  const runSearch = useServerFn(searchProspects);
  const runEnrich = useServerFn(enrichCompany);
  const runSend = useServerFn(sendToCampaign);

  const [industry, setIndustry] = useState("manufacturing");
  const [businessType, setBusinessType] = useState("manufacturing plant");
  const [location, setLocation] = useState("Houston, TX");
  const [deregulatedOnly, setDeregulatedOnly] = useState(true);

  const [searching, setSearching] = useState(false);
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [enrichments, setEnrichments] = useState<Record<string, EnrichmentResult>>({});
  const [enrichingId, setEnrichingId] = useState<string | null>(null);
  const [openProspect, setOpenProspect] = useState<Prospect | null>(null);
  const [selectedEmail, setSelectedEmail] = useState<string | null>(null);
  const [showOthers, setShowOthers] = useState(false);
  const [campaignId, setCampaignId] = useState<string>("");
  const [sending, setSending] = useState(false);
  const [sentCount, setSentCount] = useState(0);

  const campaigns = useQuery({
    queryKey: ["instantly-campaigns"],
    queryFn: () => getCampaigns(),
    retry: false,
  });

  const visible = useMemo(
    () => (deregulatedOnly ? prospects.filter((p) => p.marketStatus === "deregulated") : prospects),
    [prospects, deregulatedOnly],
  );

  const enrichedIds = useMemo(() => new Set(Object.keys(enrichments)), [enrichments]);
  const contactsCount = useMemo(
    () => Object.values(enrichments).reduce((n, e) => n + e.contacts.length, 0),
    [enrichments],
  );
  const matchedCount = useMemo(
    () =>
      Object.values(enrichments).filter((e) => matchDecisionMaker(e.contacts, industry)).length,
    [enrichments, industry],
  );

  async function handleSearch() {
    setSearching(true);
    try {
      const results = await runSearch({
        data: { query: businessType, location, maxResults: 20 },
      });
      setProspects(results);
      if (results.length === 0) toast.info("No businesses matched that search.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Search failed.");
    } finally {
      setSearching(false);
    }
  }

  async function handleEnrich(p: Prospect) {
    setOpenProspect(p);
    setSelectedEmail(null);
    if (enrichments[p.id] || !p.domain) return;
    setEnrichingId(p.id);
    try {
      const result = await runEnrich({ data: { domain: p.domain } });
      setEnrichments((prev) => ({ ...prev, [p.id]: result }));
      if (result.error) toast.error(result.error);
      else if (result.contacts.length === 0) toast.info("No contacts found for this domain.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Enrichment failed.");
    } finally {
      setEnrichingId(null);
    }
  }

  const openResult = openProspect ? enrichments[openProspect.id] : undefined;
  const ranked = openResult ? rankAllMatches(openResult.contacts, industry) : [];
  const topMatches = ranked.filter((r) => r.tier !== "Unmatched" && r.tierIndex < 4).slice(0, 4);
  const otherContacts = ranked.filter((r) => !topMatches.includes(r));
  const autoBest = openResult ? matchDecisionMaker(openResult.contacts, industry) : null;
  const activeEmail = selectedEmail ?? autoBest?.contact.email ?? null;
  const activeMatch = ranked.find((r) => r.contact.email === activeEmail) ?? null;

  function renderContact(r: (typeof ranked)[number]) {
    const active = r.contact.email === activeEmail;
    return (
      <button
        key={r.contact.email}
        onClick={() => setSelectedEmail(r.contact.email)}
        className={`w-full border px-4 py-3 text-left transition-colors ${
          active ? "border-accent bg-accent/8" : "border-border hover:bg-secondary"
        }`}
      >
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-sm font-medium text-foreground">{r.contact.name}</span>
          <span className="text-xs text-muted-foreground">{r.contact.confidence}% conf.</span>
        </div>
        <div className="text-sm text-muted-foreground">{r.contact.title || "Title unknown"}</div>
        <div className="text-xs text-muted-foreground">{r.contact.email}</div>
        <div className="mt-2 text-[11px] tracking-wide text-accent">
          {r.tier === "Unmatched" ? "No tier match" : `Tier ${r.tierIndex + 1} · ${r.tier}`}
          {r.excluded && (
            <span className="ml-2 text-muted-foreground">Non-site scope — deprioritized</span>
          )}
        </div>
      </button>
    );
  }

  async function handleSend() {
    if (!openProspect || !activeMatch || !campaignId) return;
    setSending(true);
    const [firstName, ...rest] = (activeMatch.contact.name ?? "").split(" ");
    try {
      const res = await runSend({
        data: {
          campaignId,
          email: activeMatch.contact.email,
          firstName: firstName || undefined,
          lastName: rest.join(" ") || undefined,
          companyName: openProspect.name,
          title: activeMatch.contact.title || undefined,
          website: openProspect.website,
        },
      });
      const industryLabel =
        INDUSTRY_OPTIONS.find((o) => o.key === industry)?.label ?? industry;
      addPipelineRecord({
        leadId: res.id ?? `${campaignId}:${activeMatch.contact.email}`,
        businessName: openProspect.name,
        contactName: activeMatch.contact.name,
        title: activeMatch.contact.title,
        email: activeMatch.contact.email,
        tier:
          activeMatch.tier === "Unmatched"
            ? "Unmatched"
            : `Tier ${activeMatch.tierIndex + 1}`,
        industry,
        industryLabel,
        deregulated:
          openProspect.marketStatus.charAt(0).toUpperCase() +
          openProspect.marketStatus.slice(1),
        energyPriority: energyPriorityForIndustry(industry),
        campaignId,
        campaignName:
          (campaigns.data ?? []).find((c) => c.id === campaignId)?.name ?? "Campaign",
        dateAdded: new Date().toISOString(),
        status: "Pending",
      });
      setSentCount((n) => n + 1);
      toast.success(`${activeMatch.contact.email} added to campaign.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not add contact to campaign.");
    } finally {
      setSending(false);
    }
  }

  return (
    <main className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-6xl items-baseline justify-between px-6 py-6">
          <div className="flex items-baseline gap-3">
            <span className="headline text-lg text-foreground">WaveClimate</span>
            <span className="eyebrow">Lead Engine</span>
          </div>
          <nav className="flex items-center gap-5 text-sm">
            <Link to="/" className="font-medium text-foreground">
              Lead Engine
            </Link>
            <Link to="/pipeline" className="text-muted-foreground transition-colors hover:text-foreground">
              Pipeline
            </Link>
          </nav>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-6 py-16">
        <h1 className="headline max-w-xl text-3xl text-foreground">
          Find commercial accounts in deregulated markets.
        </h1>
        <div className="mt-12 grid grid-cols-2 gap-x-10 gap-y-10 md:grid-cols-4">
          <StatBlock value={prospects.length} label="Prospects found" />
          <StatBlock value={contactsCount} label="Contacts enriched" />
          <StatBlock value={matchedCount} label="Decision-makers matched" />
          <StatBlock value={sentCount} label="Sent to outreach" accent />
        </div>
      </section>

      <section className="border-t border-border bg-surface">
        <div className="mx-auto max-w-6xl px-6 py-12">
          <div className="eyebrow">Step 1 — Prospect search</div>
          <div className="mt-6 grid gap-6 md:grid-cols-4">
            <div className="space-y-2">
              <Label className="eyebrow">Industry</Label>
              <Select value={industry} onValueChange={setIndustry}>
                <SelectTrigger className="rounded-none">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {INDUSTRY_OPTIONS.map((o) => (
                    <SelectItem key={o.key} value={o.key}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="eyebrow">Business type</Label>
              <Input
                className="rounded-none"
                value={businessType}
                onChange={(e) => setBusinessType(e.target.value)}
                placeholder="cold storage warehouse"
              />
            </div>
            <div className="space-y-2">
              <Label className="eyebrow">Area</Label>
              <Input
                className="rounded-none"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Dallas, TX"
              />
              <div className="text-xs text-muted-foreground">
                Deregulated: {DEREGULATED_STATES.map((m) => m.code).join(", ")}
              </div>
            </div>
            <div className="flex flex-col justify-between gap-4">
              <div className="flex items-center gap-3">
                <Switch checked={deregulatedOnly} onCheckedChange={setDeregulatedOnly} />
                <span className="text-sm text-foreground">Deregulated only</span>
              </div>
              <Button
                className="rounded-none"
                onClick={handleSearch}
                disabled={searching || !businessType || !location}
              >
                {searching ? "Searching…" : "Search"}
              </Button>
            </div>
          </div>

          <div className="mt-10">
            {visible.length > 0 ? (
              <ProspectTable
                prospects={visible}
                onEnrich={handleEnrich}
                enrichingId={enrichingId}
                enrichedIds={enrichedIds}
              />
            ) : (
              <p className="border border-dashed border-border px-6 py-12 text-center text-sm text-muted-foreground">
                {prospects.length === 0
                  ? "Run a search to load prospects."
                  : "No deregulated results. Turn off the filter to see everything."}
              </p>
            )}
          </div>
        </div>
      </section>

      <Sheet open={!!openProspect} onOpenChange={(o) => !o && setOpenProspect(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
          <SheetHeader>
            <SheetTitle className="headline">{openProspect?.name}</SheetTitle>
          </SheetHeader>
          <div className="space-y-8 px-4 pb-10">
            <div>
              <div className="eyebrow">Step 2 — Decision-maker enrichment</div>
              <p className="mt-2 text-sm text-muted-foreground">
                {openProspect?.domain
                  ? `Hunter domain search · ${openProspect.domain}`
                  : "No website on file — enrichment unavailable."}
              </p>
            </div>

            {enrichingId && <p className="text-sm text-muted-foreground">Loading contacts…</p>}

            {openResult && (
              <div>
                <div className="eyebrow">Step 3 — Tier matching</div>
                <div className="mt-4 space-y-2">
                  {ranked.length === 0 && (
                    <p className="text-sm text-muted-foreground">No contacts returned.</p>
                  )}
                  {ranked.length > 0 && topMatches.length === 0 && (
                    <p className="text-sm text-muted-foreground">
                      No tier-matched decision-makers found.
                    </p>
                  )}
                  {topMatches.map((r) => renderContact(r))}
                </div>

                {otherContacts.length > 0 && (
                  <div className="mt-6">
                    <button
                      onClick={() => setShowOthers((v) => !v)}
                      className="eyebrow text-muted-foreground hover:text-foreground"
                    >
                      {showOthers ? "Hide" : "Show"} other contacts found (
                      {otherContacts.length})
                    </button>
                    {showOthers && (
                      <div className="mt-3 space-y-2">
                        {otherContacts.map((r) => renderContact(r))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {openResult && ranked.length > 0 && (
              <div>
                <div className="eyebrow">Step 4 — Send to outreach</div>
                <div className="mt-4 space-y-3">
                  <Select value={campaignId} onValueChange={setCampaignId}>
                    <SelectTrigger className="rounded-none">
                      <SelectValue
                        placeholder={
                          campaigns.isLoading
                            ? "Loading campaigns…"
                            : campaigns.isError
                              ? "Campaigns unavailable"
                              : "Select Instantly campaign"
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {(campaigns.data ?? []).map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    className="w-full rounded-none"
                    disabled={!campaignId || !activeMatch || sending}
                    onClick={handleSend}
                  >
                    {sending ? "Adding…" : "Add contact to campaign"}
                  </Button>
                  {activeMatch && (
                    <p className="text-xs text-muted-foreground">
                      Sending {activeMatch.contact.email} ({activeMatch.tier}).
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </main>
  );
}
