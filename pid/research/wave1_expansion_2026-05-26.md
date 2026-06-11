# Wave 1 Controlled Archive Expansion

Date: 2026-05-26

Purpose: move from seed artifact saving to repeatable raw collection for the easiest public sources, while still avoiding synthesis or product integration.

## Commands Run

```bash
node pid/collectors/wave1.mjs --date=2026-05-26-wave1b --max-revenue-pages=2 --max-pdfs=2
node pid/collectors/wave1.mjs --date=2026-05-26-wave1c --source=orera
node pid/collectors/wave1.mjs --date=2026-05-26-wave1e --source=orera --skip-orera-assets
node pid/collectors/wave1.mjs --date=2026-05-26-wave1f --source=orera --skip-orera-assets --max-orera-project-details=3
node pid/collectors/wave1.mjs --date=2026-05-26-wave1h --source=orera --skip-orera-assets --max-orera-project-details=1 --max-orera-documents-per-project=6
node pid/collectors/wave1.mjs --date=2026-05-26-wave1i --source=orera --skip-orera-assets --max-orera-project-pages=2 --orera-project-page-size=10 --max-orera-project-details=4 --max-orera-documents-per-project=4 --throttle-ms=250
node pid/collectors/wave1.mjs --date=2026-05-26-orera-50 --source=orera --skip-orera-assets --max-orera-project-pages=5 --orera-project-page-size=10 --max-orera-project-details=50 --max-orera-documents-per-project=4 --throttle-ms=750
```

## Collector Improvements

- Added shared POST support to `pid/lib/raw-archive.mjs`.
- Fixed ORERA Angular asset URL resolution so JS/CSS resolve from the site root, not route-relative paths.
- Added ORERA public API envelope support: `REQUEST_DATA` base64 payload plus `REQUEST_TOKEN` HMAC-SHA256.
- Added decoded ORERA API outputs alongside raw encoded API artifacts.
- Made API capture failure-tolerant so HTTP 500 bodies are preserved instead of aborting the run.
- Added ORERA project-detail API capture for overview, land details, facilities, bank accounts, and project professionals.
- Added ORERA DMS document download support using public file-viewer token generation and decrypt metadata capture.
- Prioritized plot-specific ORERA evidence documents before planning/certificate documents: EC, RoR, POA, sale deed, share allocation, owner file IDs.
- Added ORERA project listing pagination controls: `--max-orera-project-pages`, `--orera-project-page-size`, and `--throttle-ms`.
- Added same-run resume behavior: `--skip-existing` is on by default and `--no-skip-existing` forces re-fetch/rewrite. Repeating the same ORERA run now skips existing route HTML, API JSON, decoded summaries, and DMS document PDFs instead of adding duplicate manifest rows.
- Made ORERA DMS document capture failure-tolerant so one slow/missing file is recorded as a failed document attempt without aborting the whole batch.

## Current Raw Outputs

| Source | Run | Result |
|---|---|---|
| Odisha Revenue land acquisition | `2026-05-26-wave1b` | 2 listing pages, 40 parsed rows, 4 linked PDFs saved |
| Odisha Revenue SIA 4(1) | `2026-05-26-wave1b` | 2 listing pages, 40 parsed rows, 4 linked PDFs saved |
| ORERA routes/assets | `2026-05-26-wave1c` | 3 route HTML pages, 5 root assets, 80 endpoint hints discovered |
| ORERA project counts | `2026-05-26-wave1e` | API raw response and decoded JSON saved; token verified |
| ORERA registered projects | `2026-05-26-wave1e` | 1,170 project records saved; token verified |
| ORERA issued/active agents | `2026-05-26-wave1e` | 370 agent records saved; token verified |
| ORERA project details | `2026-05-26-wave1f` | 3 projects sampled; 15 detail endpoint calls succeeded with verified tokens |
| ORERA plot documents | `2026-05-26-wave1h` | 1 project sampled; 6 PDFs saved: plot EC, plot RoR, POA, share allocation, owner document, registration certificate |
| ORERA controlled scale run | `2026-05-26-wave1i` | 2 listing pages, 20 project-list rows, 4 project detail bundles, 20 detail endpoint calls, 16 prioritized evidence PDFs saved |
| ORERA controlled 50-project run | `2026-05-26-orera-50` | 5 listing pages, 50 project-list rows, 50 project detail bundles, 250 detail endpoint calls, 200 prioritized document attempts, 199 evidence PDFs present, 1 document fetch failure recorded; 662 manifest/artifact rows, 523 extracted JSON files, about 451 MB |
| ORERA online/offline complaints | `2026-05-26-wave1e` | endpoints discovered, raw HTTP 500 responses saved; decode summary records blocker |
| DRT Cuttack | `2026-05-26-wave1b` | form page saved, 41 forum options parsed, 2 seed cause lists parsed into 139 case rows |
| Bhunaksha WFS | `2026-05-26-wave1b` | Mendhasala/Bhubaneswar bbox WFS JSON saved, 41 features summarized |

## Current Source Inventory

| Source | What We Have | Stored Form | Buyer/Seller Evidence Value |
|---|---|---|---|
| ORERA registered projects | Full public registered-project API response from the current public endpoint: 1,170 project records | Raw API artifact plus decoded JSON summaries | Registration status, project/promoter identity, project type, location, start/end dates, certificate IDs |
| ORERA agents | Full public agent API response: 370 issued/active agent records | Raw API artifact plus decoded JSON summaries | Agent identity and registration checks |
| ORERA project listing pages | Controlled paginated sample: 50 listing rows across 5 pages | Raw encoded API artifacts plus `project_listing_pages_summary.json` | Project/promoter IDs needed to fetch deeper project and document evidence |
| ORERA project details | 50 project bundles, 5 endpoints each: overview, land details, facility details, bank accounts, professionals | Raw encoded API artifacts plus decoded JSON per endpoint and project-level summary | Land parcels, declared project data, amenities, bank account declarations, professionals linked to project |
| ORERA DMS documents | 199 PDFs from 200 prioritized attempts across 50 projects | PDF artifacts plus DMS decrypt metadata JSON | Plot EC, RoR, POA, sale deed, share allocation, certificate and plan evidence useful for plot-specific risk review |
| Odisha Revenue land acquisition | 2 public listing pages, 40 parsed rows, 4 PDFs | HTML listing artifacts, parsed row JSON, PDF artifacts | Acquisition/LARR corridor or government-notice risk signals |
| Odisha Revenue SIA 4(1) | 2 public listing pages, 40 parsed rows, 4 PDFs | HTML listing artifacts, parsed row JSON, PDF artifacts | Early acquisition/social-impact notices around proposed projects |
| DRT Cuttack cause lists | Search form metadata, 41 forum options, 2 seed cause-list pages, 139 parsed case rows | HTML artifacts and parsed JSON summaries | Bank recovery/lender-dispute signals around parties, borrowers, secured assets where names align later |
| Bhunaksha WFS | One Mendhasala/Bhubaneswar bbox WFS sample with 41 features | GeoJSON/WFS JSON artifact and summary | Spatial parcel/plot boundary sample for later map or mismatch checks |
| ORERA complaints | Public complaint endpoints identified, but default public payload returns HTTP 500 | Raw 500 artifacts and decode-error summaries | Potential dispute corpus source; currently blocked pending browser-network payload discovery |

## Key Files To Inspect

```text
pid/data/raw/orera/2026-05-26-wave1e/extracted/api-registered-projects_summary.json
pid/data/raw/orera/2026-05-26-wave1e/extracted/api-registered-projects_decoded.json
pid/data/raw/orera/2026-05-26-wave1e/extracted/api-approved-agents_summary.json
pid/data/raw/orera/2026-05-26-wave1e/extracted/api-project-counts_summary.json
pid/data/raw/orera/2026-05-26-wave1e/extracted/api-online-complaints-page-1_summary.json
pid/data/raw/orera/2026-05-26-wave1e/extracted/api-offline-complaints-page-1_summary.json
pid/data/raw/orera/2026-05-26-wave1f/extracted/project_detail_sample_summary.json
pid/data/raw/orera/2026-05-26-wave1h/extracted/project_detail_sample_summary.json
pid/data/raw/orera/2026-05-26-wave1h/artifacts/project-1878-doc-235559-plotecid.pdf
pid/data/raw/orera/2026-05-26-wave1h/artifacts/project-1878-doc-235560-plotrorid.pdf
pid/data/raw/orera/2026-05-26-wave1h/artifacts/project-1878-doc-250157-poaid.pdf
pid/data/raw/orera/2026-05-26-wave1h/artifacts/project-1878-doc-251375-shareallocid.pdf
pid/data/raw/orera/2026-05-26-wave1i/extracted/project_listing_pages_summary.json
pid/data/raw/orera/2026-05-26-wave1i/extracted/project_detail_sample_summary.json
pid/data/raw/orera/2026-05-26-orera-50/extracted/project_listing_pages_summary.json
pid/data/raw/orera/2026-05-26-orera-50/extracted/project_detail_sample_summary.json
pid/data/raw/orera/2026-05-26-orera-50/manifest.jsonl
pid/data/raw/orera/2026-05-26-wave1c/extracted/endpoint_discovery.json
pid/data/raw/odisha_revenue_land_acquisition/2026-05-26-wave1b/extracted/listing_rows.json
pid/data/raw/odisha_revenue_sia_4_1/2026-05-26-wave1b/extracted/listing_rows.json
pid/data/raw/drt_cuttack_cause_lists/2026-05-26-wave1b/extracted/cause_list_form_summary.json
pid/data/raw/bhunaksha_wfs/2026-05-26-wave1b/extracted/khurda-bhubaneswar-20-272688-85-701271_summary.json
```

## Verification

```bash
node --check pid/lib/raw-archive.mjs
node --check pid/collectors/wave1.mjs
```

Extracted ORERA JSON files from `2026-05-26-wave1e` parsed successfully.
Extracted ORERA JSON files from `2026-05-26-wave1h` parsed successfully.

`2026-05-26-wave1h` saved 26 manifest rows and about 15 MB of ORERA raw artifacts.
`2026-05-26-wave1i` saved 62 manifest rows, 57 extracted JSON files, 16 PDFs, and about 38 MB of ORERA raw artifacts.
After adding resume behavior, repeating the `2026-05-26-wave1i` ORERA command kept the ORERA manifest stable at 65 rows. The extra 3 rows were route HTML duplicates from the pre-resume test; subsequent reruns did not add more rows.
`2026-05-26-orera-50` completed after resume from an interrupted DMS fetch. Final state: 50 project detail bundles, 250 detail endpoint calls, 200 prioritized document attempts, 199 PDFs present, 1 document fetch failure recorded, 662 manifest/artifact rows, 523 extracted JSON files, and about 451 MB of raw artifacts. `node --check` passes for both collector modules.

## Next Collection Steps

1. Pause for corpus review: inspect ORERA 50-project samples before adding synthesis or insight generation.
2. Add resume/throttle support and collect all visible Revenue/SIA PDFs.
3. Investigate ORERA complaint endpoint 500s with browser network capture or alternate status filters.
4. Add DRT date/forum discovery beyond the two seed URLs.
5. Expand Bhunaksha WFS to a controlled Khordha village grid.
