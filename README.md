# WaveLead Navigator

A B2B lead generation and prospecting tool built for WaveClimate, a commercial energy advisory firm operating in deregulated electricity markets. WaveLead Navigator finds commercial prospects, identifies the right decision-maker at each company, and routes them into automated outreach — combining public energy-market data with a multi-provider contact enrichment waterfall.

**🔗 Live site:** [wavelead-navigator.lovable.app](https://wavelead-navigator.lovable.app/)

> **Status: actively under development.** This is a working, live tool connected to real third-party APIs (Google Places, Hunter, Prospeo, Snov.io, Instantly) — features are still being added and refined. What's live reflects a real, functioning pipeline, not a static demo.

---

## What it does

1. **Prospect Search** — searches commercial businesses by industry and location using the Google Places API, cross-referenced against a deregulated electricity market lookup table
2. **Decision-Maker Enrichment** — runs a modular waterfall across Hunter, Prospeo, and Snov.io to find real contacts at each company, with cached results to avoid re-spending credits on repeat searches
3. **Tier Matching** — matches enriched contacts against industry-specific title hierarchies (10 verticals, each with its own ranked decision-maker path) to automatically surface the best point of contact
4. **Outreach Routing** — sends the matched contact directly into an Instantly email campaign with one click
5. **Pipeline Dashboard** — a persistent, live-synced record of every prospect found, enriched, and contacted, with status automatically pulled from Instantly

## Why I built this

My background is in enterprise telecom procurement — managing supplier relationships, contract lifecycles, and complex multi-party negotiations. I built WaveLead Navigator to demonstrate that the same skillset applies directly to clean energy procurement: both involve navigating supplier complexity, structured decision-making, and long-term contracts in regulated, technical markets. Rather than relying on off-the-shelf sales tools, I built this pipeline from scratch to show hands-on ability with API integration, data enrichment architecture, and AI-assisted app development — real infrastructure solving a real problem in my own business, not just a portfolio exercise.

## Tech stack

- **Frontend/Backend:** Built in Lovable (React + Supabase)
- **APIs:** Google Places API (New), Hunter.io, Prospeo, Snov.io, Instantly
- **Data sources:** EIA (retail rates, STEO forecasts), U.S. Census Bureau (County Business Patterns), EIA CBECS energy intensity survey
- **Version control:** GitHub, synced directly from Lovable

## Screenshots

![Homepage](./screenshots/homepage.png)
![Enrichment Flow](./screenshots/enrichment.png)
![Pipeline Dashboard](./screenshots/pipeline.png)

## Key features worth highlighting

- Modular waterfall enrichment architecture — providers can be added or swapped without rebuilding core logic
- Industry-specific decision-maker tier matching, with a corporate-title exclusion guardrail (deprioritizes titles like "Global VP" in favor of facility-specific contacts)
- Enrichment result caching to avoid re-spending API credits on repeat searches
- Live-synced outreach status pulled directly from Instantly's API

---

*Built as part of a portfolio demonstrating AI-assisted app development and data pipeline design for clean energy sales and partnerships roles.*
