# BDA Zoning — smoke result, 2026-06-15

## TL;DR

**GREEN.** BDA zoning is a local point-in-polygon lookup fetcher, not a live portal. 13/13 contract tests pass. No fetcher changes needed.

## What this fetcher does

BDA Master Plan zone lookup for Bhubaneswar Development Authority area. Returns the zone (residential, commercial, industrial, green_belt, special, mixed_use, institutional) for a given lat/lon, plus permitted uses and restrictions for that zone.

## Data flow

1. `data/bda_zones.json` (committed to repo) — per-village/locality zone mapping
2. `scripts/probe/bluis-scraper.ts` — regenerates the JSON by scraping `https://bluis.in/`
3. In-memory 10-row seed (Patia, Jaydev Vihar, Khandagiri, etc.) — fallback when JSON missing
4. Point-in-polygon matching against zone polygons

## Contract tests

13/13 pass:
- health check returns true
- data source resolved (json or inline_seed fallback)
- zone-by-code lookup
- residential / commercial / industrial permission flags
- getZoneForVillage / getZoneForLocation
- _resetCache re-init

## Live portal status

**N/A.** This fetcher doesn't hit a live portal at runtime. The BDA Master Plan data is scraped once via `bluis-scraper.ts` and committed to the repo as a static JSON. The fetcher is a deterministic lookup.

If the BDA portal changes its master plan (zone reclassifications, new villages added), run `bluis-scraper.ts` to regenerate the JSON. There is no live runtime dependency.

## Artifacts

- Fetcher: `packages/fetchers/bda-zoning/src/index.ts` (unchanged)
- Contract tests: `packages/fetchers/bda-zoning/src/index.test.ts` (13/13 green)
- Data: `packages/fetchers/bda-zoning/data/bda_zones.json`
- Scraper: `scripts/probe/bluis-scraper.ts`
