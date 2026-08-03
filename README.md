# WaveClimate Lead Engine

WaveClimate Lead Engine — Lovable Build Prompt

Copy everything below into Lovable as your initial project prompt.

Build a B2B lead generation tool called Lead Engine for WaveClimate, a commercial energy advisory firm that helps businesses in deregulated electricity markets find better supply rates through a network of 90+ licensed suppliers.

Brand identity (match this exactly — do not default to generic SaaS/startup styling)

WaveClimate's existing brand (waveclimate.co) is calm, confident, and advisory-grade — closer to a boutique consulting firm than a tech startup. Match this tone:

Palette: Deep navy/ink blue as the primary dark color, clean white space, a single confident accent color (teal or cyan) used sparingly for CTAs and key data points — not neon, not gradient-heavy

Typography: Clean modern sans-serif throughout (e.g. Inter or similar), generous letter-spacing on headlines, confident and short headline copy rather than dense paragraphs

Signature pattern: Big standalone stat blocks are core to this brand's visual language — e.g. large numbers with a short label beneath them ("90+ Licensed suppliers", "18% Average savings found"). Use this pattern for dashboard summary metrics (prospects found, contacts enriched, campaigns sent).

Voice: Direct, confident, zero fluff. Copy should read like "We shop your account across 90+ suppliers" — plain declarative sentences, not marketing hype.

Overall feel: Trustworthy, data-driven, whitespace-heavy, minimal decoration. This is a working tool for a solo advisor, not a flashy product demo — polish should come from restraint and clarity, not visual effects.

What this tool does

A prospecting pipeline for finding and qualifying commercial energy leads in deregulated markets, then routing qualified contacts into outreach.

Step 1 — Prospect Search

User sets search criteria: industry/business type, geographic area (state or metro), and deregulated market status

Search commercial businesses using the Google Places API based on these criteria

Cross-reference results against a deregulated market lookup table (build this as static seed data: list of U.S. states/markets that are deregulated for commercial electricity, e.g. TX, PA, OH, IL, NY, NJ, MA, CT, MD, DE, DC, ME, NH, and others — flag each search result as deregulated or not)

Where available, cross-reference against public energy benchmarking disclosure data (e.g. NYC Local Law 84, Chicago, Boston building energy disclosure datasets) to surface actual energy use data tied to named buildings when the search area overlaps those cities — treat this as an optional enrichment, not a blocker, since it will only be available in a handful of cities

Display results in a clean table: business name, address, industry category, deregulated status (yes/no badge), energy benchmarking data if available

Step 2 — Decision-Maker Enrichment (build this as a modular, swappable step)

For each selected prospect, enrich the company using Hunter.io's Domain Search API (not Email Finder) to pull all known contacts and titles at that company

Architect this enrichment step as a single function/module with a clear interface (input: company domain, output: list of contacts with name/title/email/confidence score) so that additional providers can be added later as fallback steps in a waterfall without touching the rest of the app. For now, only Hunter is active — write the code so a second or third provider can be added later as an additional call inside the same module if Hunter returns no results, but do not build UI or logic for other providers yet.

Store the Hunter API key as an environment variable / secret, never hardcoded

Step 3 — Decision-Maker Tier Matching

Apply title-tier matching logic to the enriched contact list to auto-select the best decision-maker contact per company, using industry-specific tier waterfalls:

Manufacturing: Plant Manager → Director of Operations → VP Manufacturing → Owner/President

Hospitality: Director of Engineering → General Manager → VP Operations → Owner/President

Cold Storage: Facility Manager → Director of Operations → VP Operations → Owner/President

Multi-site Retail: Director of Facilities → VP Real Estate/Facilities → COO → Owner/President

Data Center: Facility Manager → Director of Facilities/Engineering → VP Infrastructure → Owner/President

Default/other industries: Facilities Manager → Director of Operations → COO → Owner/President

Build this as a structured, editable JSON/config table (industry → ordered list of title keywords), not hardcoded logic, so tiers can be adjusted later without a code change

Match contact titles against the appropriate tier list using fuzzy/partial matching (titles in the wild won't exactly match the tier list), and select the highest-ranked match found. Show the matched tier level next to the selected contact so the user can see why that person was chosen.

Step 4 — Send to Outreach

Once a decision-maker contact is confirmed, let the user select an Instantly campaign from a dropdown (pull the user's existing campaign list via the Instantly API) and add the contact to it with one click

Show a simple success/failure confirmation per contact

Store the Instantly API key as an environment variable / secret

Dashboard / summary view

Landing view shows big stat blocks in the WaveClimate visual style: total prospects found, contacts enriched, decision-makers matched, sent to outreach — styled as the large-number-plus-label pattern described above

Keep this view simple and glanceable; it's a working dashboard, not a marketing page

Technical notes

All API keys (Google Places, Hunter, Instantly) stored as environment variables, never in client-side code

Build the enrichment step (Step 2) with clean separation so it can grow into a real waterfall later

The deregulated market lookup table and industry tier tables should be editable data files, not buried in logic, since these will likely need tweaking as the tool gets used

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://wavelead-navigator.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/45d8ddbf-4ec8-4f45-9125-b5b3fe00b9c6).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
