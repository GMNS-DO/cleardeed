# BDA Zoning — Data File

This directory holds `bda_zones.json`, the per-village BDA master plan
zoning classification consumed by `packages/fetchers/bda-zoning`.

## Status: PENDING BLUIS SCRAPE

As of 2026-06-12, the JSON file does not yet exist. The fetcher falls back
to no data (returns "zone not available") until populated.

## How to populate this file

### Option A — Run the BLUIS scraper (preferred)

```bash
node scripts/probe/bluis-scraper.ts --probe   # Inspect form structure first
node scripts/probe/bluis-scraper.ts --scrape  # Run full scrape
```

The scraper queries the BLUIS (Bhubaneswar Land Use Intelligence System)
portal at `https://bluis.in/` for ~22 Khordha villages and writes the
result here.

**Run `--probe` first.** BLUIS is a JS-heavy single-page app; selectors
will likely need updates after the first probe.

### Option B — Manual entry from BDA Master Plan PDF

If BLUIS is unreachable, download the BDA Master Plan (zoning map) PDF
from `bdaodisha.gov.in` and transcribe the village -> zone mapping
manually:

```json
[
  {
    "village": "Mendhasala",
    "tahasil": "Bhubaneswar",
    "zone": "residential",
    "sourceUrl": "https://bluis.in/",
    "sourceDate": "2026-06-12"
  }
]
```

## File format

| Field      | Type   | Notes                                                    |
|------------|--------|----------------------------------------------------------|
| village    | string | English village/mouza name (matches KHRDHA_VILLAGES)     |
| tehsil     | string | English tehsil name                                      |
| zone       | string | One of: residential, commercial, industrial, green_belt, mixed_use, institutional |
| sourceUrl  | string | URL where the zone was retrieved                         |
| sourceDate | string | ISO date (YYYY-MM-DD) when retrieved                     |

## Why this matters

BDA zoning is one of the three signals in Sprint 4 Section 7 ("What is
it worth") — alongside circle rate (floor) and recent IGR transactions
(directional). Without zoning, a buyer can't tell if a cheap plot is
cheap because it's in a green belt (unbuildable) or in a planned
residential zone (a real deal).
