import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
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
import {
  INDUSTRY_OPTIONS,
  rankAllMatches,
  matchDecisionMaker,
  tierLabel,
  tierShortLabel,
} from "@/lib/tier-matching";

import { MARKETS } from "@/data/deregulated-markets";
import { energyPriorityForIndustry } from "@/lib/energy-priority";
import { addPipelineRecord, contactedDomains } from "@/lib/pipeline-store";
import { defaultBusinessType } from "@/lib/industry-defaults";
import {
  cachedDomains as loadCachedDomains,
  getCachedEnrichment,
  saveEnrichment,
} from "@/lib/enrichment-cache";

import type { EnrichmentResult, Prospect } from "@/lib/types";
import {
  DEMO_CAMPAIGNS,
  DEMO_PAGE_SIZE,
  buildDemoEnrichment,
  buildDemoProspects,
} from "@/data/demo-data";
import {
  searchProspects,
  enrichCompany,
  getCampaigns,
  sendToCampaign,
} from "@/lib/lead-engine.functions";


const DEREGULATED_STATES = MARKETS.filter((m) => m.status === "deregulated");

export function LeadEngine({ demo = false }: { demo?: boolean }) {
  const runSearch = useServerFn(searchProspects);
  const runEnrich = useServerFn(enrichCompany);
  const runSend = useServerFn(sendToCampaign);

  const [industry, setIndustry] = useState("manufacturing");
  const [businessType, setBusinessType] = useState("manufacturing plant");
  const [location, setLocation] = useState("Houston, TX");
  const [deregulatedOnly, setDeregulatedOnly] = useState(true);

  const [searching, setSearching] = useState(false);
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [excludedNoWebsite, setExcludedNoWebsite] = useState(0);
  const [enrichments, setEnrichments] = useState<Record<string, EnrichmentResult>>({});
  const [enrichingId, setEnrichingId] = useState<string | null>(null);
  const [openProspect, setOpenProspect] = useState<Prospect | null>(null);
  const [selectedEmail, setSelectedEmail] = useState<string | null>(null);
  const [showOthers, setShowOthers] = useState(false);
  const [campaignId, setCampaignId] = useState<string>("");
  const [sending, setSending] = useState(false);
  const [sentCount, setSentCount] = useState(0);
  const [cachedSet, setCachedSet] = useState<Set<string>>(new Set());
  const [contactedSet, setContactedSet] = useState<Set<string>>(new Set());
  const [showContacted, setShowContacted] = useState(false);
  const [nextPageToken, setNextPageToken] = useState<string | undefined>(undefined);
  const [loadingMore, setLoadingMore] = useState(false);
  const [exhausted, setExhausted] = useState(false);

  useEffect(() => {
    // Demo Mode never touches the shared cloud tables or real saved data.
    if (demo) {
      setProspects(buildDemoProspects(industry, location));
      return;
    }
    // Pull the shared cloud copy first (so the published site and the editor
    // see the same data), pushing up anything only stored locally.
    void (async () => {
      const { hydrateFromCloud, pushLocalToCloud } = await import("@/lib/cloud-sync");
      await pushLocalToCloud();
      await hydrateFromCloud();
      setCachedSet(loadCachedDomains());
      setContactedSet(contactedDomains());
    })();
    setCachedSet(loadCachedDomains());
    setContactedSet(contactedDomains());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demo]);


  const campaigns = useQuery({
    queryKey: ["instantly-campaigns", demo],
    queryFn: () => (demo ? Promise.resolve(DEMO_CAMPAIGNS) : getCampaigns()),
    retry: false,
  });

  // Preselect a campaign so the send step is never a dead end.
  useEffect(() => {
    const first = campaigns.data?.[0]?.id;
    if (!campaignId && first) setCampaignId(first);
  }, [campaigns.data, campaignId]);


  const hiddenContacted = useMemo(
    () =>
      prospects.filter(
        (p) => p.domain && contactedSet.has(p.domain.toLowerCase().replace(/^www\./, "")),
      ).length,
    [prospects, contactedSet],
  );

  const visible = useMemo(() => {
    let rows = deregulatedOnly
      ? prospects.filter((p) => p.marketStatus === "deregulated")
      : prospects;
    if (!showContacted) {
      rows = rows.filter(
        (p) => !p.domain || !contactedSet.has(p.domain.toLowerCase().replace(/^www\./, "")),
      );
    }
    return rows;
  }, [prospects, deregulatedOnly, showContacted, contactedSet]);

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

  /** Industry drives tier matching; it also seeds a Places keyword to edit. */
  function handleIndustryChange(next: string) {
    const previousDefault = defaultBusinessType(industry);
    setIndustry(next);
    if (!businessType.trim() || businessType.trim() === previousDefault) {
      setBusinessType(defaultBusinessType(next));
    }
  }

  async function handleSearch() {
    setSearching(true);
    setExhausted(false);
    if (demo) {
      // Demo Mode: a full page of fabricated prospects, never Google Places.
      setProspects(buildDemoProspects(industry, location, DEMO_PAGE_SIZE));
      setExcludedNoWebsite(0);
      setNextPageToken(undefined);
      setExhausted(true);
      setSearching(false);
      toast.info("Demo Mode — fictional prospects, no Places call made.");
      return;
    }
    try {
      const res = await runSearch({
        data: { query: businessType, location, maxResults: 20 },
      });
      setProspects(res.prospects);
      setExcludedNoWebsite(res.excludedNoWebsite);
      setNextPageToken(res.nextPageToken);
      if (res.prospects.length === 0) toast.info("No businesses matched that search.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Search failed.");
    } finally {
      setSearching(false);
    }
  }

  /** Google Places caps a text search at ~60 results across 3 pages. */
  async function handleLoadMore() {
    if (demo || !nextPageToken) return;
    setLoadingMore(true);
    try {
      const res = await runSearch({
        data: { query: businessType, location, maxResults: 20, pageToken: nextPageToken },
      });
      setProspects((prev) => {
        const seen = new Set(prev.map((p) => p.id));
        return [...prev, ...res.prospects.filter((p) => !seen.has(p.id))];
      });
      setExcludedNoWebsite((n) => n + res.excludedNoWebsite);
      setNextPageToken(res.nextPageToken);
      if (!res.nextPageToken) setExhausted(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not load more results.");
    } finally {
      setLoadingMore(false);
    }
  }

  async function handleEnrich(p: Prospect) {
    setOpenProspect(p);
    setSelectedEmail(null);
    if (enrichments[p.id] || !p.domain) return;

    if (demo) {
      // Demo Mode: fabricated tier-matched contacts, no Hunter/Prospeo/Snov call.
      const sample = buildDemoEnrichment(p, industry);
      setEnrichments((prev) => ({ ...prev, [p.id]: sample }));
      toast.info("Demo Mode — fictional contacts, no enrichment credit used.");
      return;
    }

    // Never spend a Hunter credit on a domain we've already enriched.
    const cached = getCachedEnrichment(p.domain);
    if (cached) {
      setEnrichments((prev) => ({ ...prev, [p.id]: cached }));
      toast.info("Loaded saved enrichment — no Hunter credit used.");
      return;
    }

    setEnrichingId(p.id);
    try {
      const result = await runEnrich({ data: { domain: p.domain, industry } });
      setEnrichments((prev) => ({ ...prev, [p.id]: result }));
      saveEnrichment(p.domain, result);
      setCachedSet(loadCachedDomains());
      if (result.contacts.length === 0)
        toast.info("No contacts found across all providers.");
      else if (result.error) toast.error(result.error);
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
          {tierLabel(r)}
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
    if (demo) {
      // Demo Mode: confirm success without calling Instantly or saving data.
      setTimeout(() => {
        setSentCount((n) => n + 1);
        setSending(false);
        toast.success(
          `Demo Mode — ${activeMatch.contact.email} would be added to the campaign. No outreach sent.`,
        );
      }, 400);
      return;
    }
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
        domain: openProspect.domain,
        tier: tierShortLabel(activeMatch),

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
      setContactedSet(contactedDomains());
      toast.success(`${activeMatch.contact.email} added to campaign.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not add contact to campaign.");
    } finally {
      setSending(false);
    }
  }

  return (
    <main className="relative min-h-screen bg-background">
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 opacity-[0.22] [background:radial-gradient(60rem_40rem_at_15%_-10%,oklch(0.62_0.24_300),transparent_60%),radial-gradient(50rem_36rem_at_95%_10%,oklch(0.66_0.26_340),transparent_60%),radial-gradient(40rem_30rem_at_60%_110%,oklch(0.82_0.15_55),transparent_60%)]"
      />
      <div className="relative">
        <header className="border-b border-border">
          <div className="mx-auto flex max-w-6xl items-baseline justify-between px-6 py-6">
            <div className="flex items-baseline gap-3">
              <span className="headline text-lg text-foreground">WaveClimate</span>
              <span className="eyebrow">Lead Engine</span>
            </div>
            <nav className="flex items-center gap-5 text-sm">
              <Link
                to={demo ? "/demo/app" : "/app"}
                className="font-medium text-foreground"
              >
                Lead Engine
              </Link>
              <Link
                to={demo ? "/demo/pipeline" : "/pipeline"}
                className="text-muted-foreground transition-colors hover:text-foreground"
              >
                Pipeline
              </Link>
              <Link
                to={demo ? "/demo/priority-targets" : "/priority-targets"}
                className="text-muted-foreground transition-colors hover:text-foreground"
              >
                Priority Targets
              </Link>
            </nav>
          </div>
        </header>

        <section className="mx-auto max-w-6xl px-6 py-16">
          <h1 className="headline max-w-2xl text-4xl leading-tight text-foreground">
            Find commercial accounts in <span className="grad-text">deregulated markets</span>.
          </h1>
          <div className="mt-12 grid grid-cols-2 gap-5 md:grid-cols-4">
            <StatBlock value={prospects.length} label="Prospects found" />
            <StatBlock value={contactsCount} label="Contacts enriched" />
            <StatBlock value={matchedCount} label="Decision-makers matched" />
            <StatBlock value={sentCount} label="Sent to outreach" accent />
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-6 pb-20">
          <div className="glass-panel rounded-2xl p-8">
            <div className="eyebrow">Step 1 — Prospect search</div>
            <div className="mt-6 grid gap-6 md:grid-cols-4">
              <div className="space-y-2">
                <Label className="eyebrow">Industry</Label>
                <Select value={industry} onValueChange={handleIndustryChange}>
                  <SelectTrigger className="rounded-lg bg-white/[0.04]">
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
                <div className="text-xs text-muted-foreground">Sets the title-tier waterfall.</div>
              </div>
              <div className="space-y-2">
                <Label className="eyebrow">Business type</Label>
                <Input
                  className="rounded-lg bg-white/[0.04]"
                  value={businessType}
                  onChange={(e) => setBusinessType(e.target.value)}
                  placeholder="cold storage warehouse"
                />
                <div className="text-xs text-muted-foreground">
                  Search keyword — suggested from industry, editable.
                </div>
              </div>
              <div className="space-y-2">
                <Label className="eyebrow">Area</Label>
                <Input
                  className="rounded-lg bg-white/[0.04]"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="Dallas, TX"
                />
                <div className="text-xs text-muted-foreground">
                  Deregulated: {DEREGULATED_STATES.map((m) => m.code).join(", ")}
                </div>
              </div>
              <div className="flex flex-col justify-between gap-4">
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <Switch checked={deregulatedOnly} onCheckedChange={setDeregulatedOnly} />
                    <span className="text-sm text-foreground">Deregulated only</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Switch checked={showContacted} onCheckedChange={setShowContacted} />
                    <span className="text-sm text-foreground">Show already-contacted</span>
                  </div>
                </div>
                <Button
                  className="grad-fill rounded-full border-0 text-white hover:opacity-90"
                  onClick={handleSearch}
                  disabled={searching || !businessType || !location}
                >
                  {searching ? "Searching…" : "Search"}
                </Button>
              </div>
            </div>

            {!showContacted && hiddenContacted > 0 && (
              <p className="mt-8 text-xs text-muted-foreground">
                {hiddenContacted} compan{hiddenContacted === 1 ? "y" : "ies"} already in outreach{" "}
                {hiddenContacted === 1 ? "was" : "were"} hidden — flip &ldquo;Show
                already-contacted&rdquo; to see them.
              </p>
            )}

            {excludedNoWebsite > 0 && (
              <p className="mt-8 text-xs text-muted-foreground">
                {excludedNoWebsite} business{excludedNoWebsite === 1 ? "" : "es"} without a website{" "}
                {excludedNoWebsite === 1 ? "was" : "were"} excluded — they can&apos;t be enriched by
                any domain-based provider.
              </p>
            )}

            <div className="mt-6">
              {visible.length > 0 ? (
                <ProspectTable
                  prospects={visible}
                  onEnrich={handleEnrich}
                  enrichingId={enrichingId}
                  enrichedIds={enrichedIds}
                  cachedDomains={cachedSet}
                />
              ) : (
                <p className="rounded-xl border border-dashed border-border px-6 py-12 text-center text-sm text-muted-foreground">
                  {prospects.length === 0
                    ? "Run a search to load prospects."
                    : "No deregulated results. Turn off the filter to see everything."}
                </p>
              )}
            </div>

            {prospects.length > 0 && !demo && (
              <div className="mt-6 flex flex-col items-center gap-3">
                {nextPageToken && !exhausted ? (
                  <Button
                    variant="outline"
                    className="rounded-full"
                    onClick={handleLoadMore}
                    disabled={loadingMore}
                  >
                    {loadingMore ? "Loading…" : "Load more results"}
                  </Button>
                ) : (
                  <p className="max-w-lg text-center text-xs text-muted-foreground">
                    That&apos;s all the results Google Places returns for this search. Try a
                    different keyword (e.g. &ldquo;auto wash&rdquo; instead of &ldquo;car
                    wash&rdquo;) or narrow the area to find more.
                  </p>
                )}
              </div>
            )}
          </div>
        </section>
      </div>



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
                  ? `Waterfall: Hunter → Prospeo → Snov.io · ${openProspect.domain}`
                  : "No website on file — enrichment unavailable."}
              </p>
            </div>

            {enrichingId && <p className="text-sm text-muted-foreground">Loading contacts…</p>}

            {openResult && (
              <div>
                <div className="eyebrow">Step 3 — Tier matching</div>
                {openResult.contacts.length > 0 && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Supplied by {openResult.provider}
                    {openResult.attempted && openResult.attempted.length > 1
                      ? ` · tried ${openResult.attempted.join(" → ")}`
                      : ""}
                  </p>
                )}
                <div className="mt-4 space-y-2">
                  {ranked.length === 0 && (
                    <p className="text-sm text-muted-foreground">
                      No contacts found across all providers.
                    </p>
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
