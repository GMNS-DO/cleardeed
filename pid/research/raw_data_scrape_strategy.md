# PID Raw Data Scrape Strategy

Date: 2026-05-25

Purpose: define a source-by-source strategy to collect and preserve raw evidence useful to land/plot buyers and sellers, starting from the easiest sources and moving toward harder/manual sources. This is a raw-data strategy only; synthesis, scoring, and insight generation come later.

## Strategy Principles

1. Save raw artifacts first, parse second.
2. Every artifact must have provenance: source URL, fetch time, query params, hash, access mode, and collector version.
3. Do not convert a source hit into a claim. Store it as evidence until reviewed.
4. Preserve negative results only with query metadata, especially for court/CERSAI searches.
5. Prefer public bulk/static sources before brittle captcha/login/payment sources.
6. Store enough context to re-parse later when extraction logic improves.
7. Respect rate limits, portal terms, and manual/legal boundaries.

## Raw Artifact Storage Model

Recommended folder shape:

```text
pid/data/raw/
  source_id/
    yyyy-mm-dd/
      manifest.jsonl
      artifacts/
        <artifact_id>.html
        <artifact_id>.pdf
        <artifact_id>.json
        <artifact_id>.png
      extracted/
        <artifact_id>.txt
        <artifact_id>.json
```

Each `manifest.jsonl` row should include:

```json
{
  "artifact_id": "stable-id",
  "source_id": "odisha_revenue_sia",
  "artifact_type": "html",
  "source_url": "https://...",
  "retrieved_at": "2026-05-25T00:00:00+05:30",
  "query": {},
  "storage_path": "pid/data/raw/...",
  "sha256": "...",
  "http_status": 200,
  "access_mode": "public_web",
  "collector_version": "manual-phase0",
  "parse_status": "raw_saved"
}
```

## Collection Waves

### Wave 1: Easy Public Corpus

Goal: build the raw archive and manifest discipline with low-friction sources.

| Source | What To Scrape/Save | Artifact Types | Initial Scope | Output Value |
|---|---|---|---|---|
| Odisha Revenue acquisition/SIA/LARR pages | listing pages, pagination, individual notice PDFs, title/date/letter/area/project rows | HTML, PDF, parsed JSON | Khordha/Khurda first, then all Odisha notices from visible archive | acquisition/SIA/regulatory evidence |
| ORERA/RERA Odisha | project list pages, project detail pages, promoter/agent pages, complaint/order pages if public | HTML, JSON, PDF/screenshot if needed | project/promoter search pages and first 100 project records | builder/project regulatory corpus |
| DRT/DRAT CIS cause lists | cause-list pages by forum/date, case rows, linked orders where available | HTML, PDF, parsed JSON | DRT Cuttack, recent 6-12 months | bank recovery/SARFAESI corpus |
| Bhunaksha/WFS | WFS responses for selected bbox/village/plot samples | JSON, GeoJSON | Khordha known villages first | plot geometry/area/adjoining evidence |

Wave 1 success gate:
- At least 500 raw artifacts saved.
- 100% artifacts have manifest rows and hashes.
- At least 4 source collectors produce raw artifacts repeatably.
- No synthesis claims generated.

### Wave 2: Public But Parsing-Heavy Corpus

Goal: collect high-value public PDFs/static files after raw storage is proven.

| Source | What To Scrape/Save | Artifact Types | Initial Scope | Output Value |
|---|---|---|---|---|
| Orissa High Court PDFs/archives | case/judgment PDFs matching land/title/acquisition/SARFAESI keywords | PDF, HTML search result, text/OCR cache | keyword and party/case search samples | title dispute, acquisition, PoA/deed litigation |
| Static zoning/planning/forest/flood layers | official PDFs/maps/GIS files, legends, notifications | PDF, images, GIS/GeoJSON where available | BDA/BMC/Khordha planning and forest/flood layers | regulatory/spatial restrictions |
| Bank auction/public possession notices | bank auction listings, possession notices, property descriptions | HTML, PDF, image, parsed JSON | Odisha/Khordha notices from public bank/e-auction portals | distressed property/security lead corpus |
| Consumer Commission | orders/case pages for real estate/promoter/project disputes | HTML, PDF | Odisha real estate/project keywords | buyer-builder dispute corpus |

Wave 2 success gate:
- PDF text/OCR pipeline exists.
- At least 300 PDFs saved with extraction status.
- At least 50 artifacts contain property/entity fields usable for later linking.

### Wave 3: Brittle Public Search Sources

Goal: collect targeted records from high-value sources that require browser automation, captcha handling, or careful query design.

| Source | What To Scrape/Save | Artifact Types | Initial Scope | Output Value |
|---|---|---|---|---|
| Bhulekh Odisha RoR | RoR pages/PDFs by district/tahasil/village/plot/khata | HTML, PDF, screenshot, parsed JSON | Khordha known village/plot list; do not attempt all Odisha first | ownership, co-owner, kisam, area, remarks |
| District eCourts | party-name/case-number results, CNR pages, orders | HTML, PDF, screenshot, query JSON | known parties/cases first, then controlled party-name sampling | partition, injunction, fraud, title litigation |
| CERSAI public search | search result pages for seller/entity/name variants | HTML, screenshot, PDF if generated | curated seller/entity names; active/satisfied/no-result examples | active/satisfied charge evidence |
| RCCMS Odisha | known case lookup, mutation/revenue case status/orders | HTML, PDF, screenshot | only case numbers surfaced from Bhulekh/manual/courts | mutation/revenue dispute follow-up |
| e-Pauti/revenue receipts | uploaded/local receipts and public detail pages where accessible | PDF, HTML, screenshot | artifacts already available plus future uploads | supporting revenue/payment evidence |

Wave 3 success gate:
- Query metadata is stored for every search.
- Captcha/session failures are recorded as failures, not no-results.
- At least 25 examples per brittle source are collected and manually spot-checked.

### Wave 4: Manual/Certified High-Value Sources

Goal: ingest the strongest legal evidence even when bulk scraping is impossible.

| Source | What To Save | Artifact Types | Initial Scope | Output Value |
|---|---|---|---|---|
| IGR EC/deeds | EC PDFs, deed PDFs, certified copies, Index-II style records if available | PDF, image, scanned docs, extracted text | uploaded/manual artifacts first | title chain, sale, mortgage, PoA, partition, lease |
| Certified SRO/court/revenue copies | official certified orders/deeds/schedules | PDF/image, metadata note | user/lawyer/operator supplied | strongest evidence for disputed plots |
| Manual lawyer/broker/operator notes | reviewed case notes plus artifact links | Markdown/JSON, supporting PDFs | 20-50 curated known cases | practical fraud/dispute corpus |

Wave 4 success gate:
- Upload/manual artifact intake format is defined.
- Reviewer can mark fact/allegation/inference separately.
- At least 20 reviewed manual/certified cases exist.

### Wave 5: Noisy Pattern Discovery Sources

Goal: collect leads, not proof.

| Source | What To Save | Artifact Types | Initial Scope | Output Value |
|---|---|---|---|---|
| News/media articles | land fraud, forged deed, land mafia, acquisition, builder fraud articles | HTML/PDF/screenshot, citation metadata | Odisha/Khordha keywords | pattern leads and narrative examples |
| FIR/police/public complaint reports where public | public notices, press releases, FIR references where legally accessible | HTML/PDF/screenshot | public official pages only | fraud lead corpus |

Wave 5 success gate:
- Each record is tagged as lead-only unless backed by official/court/deed artifact.
- Source credibility and publication date are captured.

## Source-Specific Scrape Plans

### 1. Odisha Revenue Acquisition/SIA/LARR

Start first.

Save:
- listing page HTML
- pagination state
- each row as parsed JSON
- each linked PDF notice
- PDF text/OCR extraction

Key fields:
- notice title
- date
- letter number
- village
- district
- area
- project/purpose
- PDF URL

Risks:
- PDF links may move.
- Notice PDFs may contain scanned land schedules.

### 2. ORERA/RERA Odisha

Save:
- project list HTML/API response if available
- project detail pages
- promoter/agent pages
- complaints/orders where public

Key fields:
- project name
- registration number
- promoter/entity
- land/project location
- validity/status
- complaint/order references

Risks:
- Single-page app may need browser automation.
- Project pages may rely on API calls that need discovery.

### 3. DRT/DRAT CIS

Save:
- cause-list HTML by date/forum
- parsed case rows
- linked order PDFs if available
- screenshots for brittle pages

Key fields:
- forum
- date
- case number
- case type
- applicant/lender
- respondent/borrower
- linked IA/order references

Risks:
- Cause lists are not property-specific.
- Property/security interest requires order/CERSAI/EC linkage.

### 4. Bhunaksha/WFS

Save:
- raw WFS JSON/GeoJSON
- bbox/query params
- computed area result
- geometry hash

Key fields:
- plot number
- village/layer
- polygon geometry
- computed area
- adjacent feature candidates

Risks:
- Layer names and schemas may vary by district.
- Geometry alone does not prove dispute.

### 5. High Court PDFs/Archives

Save:
- search result HTML
- PDF orders/judgments
- extracted text/OCR cache
- keyword hit metadata

Key fields:
- case number
- parties
- case type
- order/judgment date
- property/deed/khata/plot references
- outcome/order direction

Risks:
- PDFs may be scanned or non-extractable without OCR.
- Keyword hits need review before labeling.

### 6. Static Planning/Zoning/Forest/Flood

Save:
- official PDFs/maps
- GIS files where available
- legends and notification text
- converted vector/raster metadata

Key fields:
- layer name
- effective date
- category/restriction
- geometry or map reference
- official authority

Risks:
- Maps may be images/PDFs with no coordinates.
- Need georeferencing before plot matching.

### 7. Bank Auction/Public Notices

Save:
- listing pages
- notice PDFs/images
- property descriptions
- lender and borrower names

Key fields:
- bank/lender
- borrower/guarantor
- property description
- reserve price
- auction date
- possession/status wording

Risks:
- Notices are fragmented across banks and portals.
- Same borrower names can over-match.

### 8. Consumer Commission

Save:
- case pages
- order PDFs
- party/project/promoter fields

Key fields:
- complaint number
- complainant/opposite party
- project/promoter name
- issue
- order outcome

Risks:
- Good for developer/project risk, weaker for private plot sales.

### 9. Bhulekh

Save:
- raw RoR HTML/PDF
- screenshot
- session/query metadata
- parsed owner/plot/remarks JSON

Key fields:
- district/tahasil/village
- khata/plot
- owner/co-owner rows
- kisam/classification
- area
- remarks/special case references
- publication/current dates

Risks:
- Session-heavy ASP.NET flow.
- Full district scrape may be large and fragile.
- OCR may be needed for saved PDFs.

### 10. District eCourts

Save:
- search query metadata
- result HTML/screenshot
- CNR pages
- order PDFs

Key fields:
- party variants searched
- CNR/case number
- court/case type/status
- parties/roles
- filing/disposal dates
- order text

Risks:
- Captcha.
- Name search false positives/false negatives.
- Negative results require careful confidence tagging.

### 11. CERSAI

Save:
- query metadata
- result HTML/screenshot/PDF
- name variants searched
- result rows

Key fields:
- borrower/chargor
- secured creditor
- charge type
- creation date
- amount
- status active/satisfied
- property description

Risks:
- Live flow needs validation.
- Name transliteration/variant matching is critical.
- Must not treat no-result as clean title.

### 12. RCCMS

Save:
- known case query metadata
- case status/order pages
- screenshots/PDFs

Key fields:
- case number
- district/tahasil
- parties
- case type
- order/status
- linked khata/plot if present

Risks:
- Weak for broad discovery.
- Use mainly as follow-up from Bhulekh remarks or known cases.

### 13. IGR EC/Deeds

Save:
- uploaded EC/deed/certified copy PDFs
- extracted text/OCR
- manual metadata form

Key fields:
- SRO
- search period
- document numbers
- document types
- parties
- property schedule
- consideration
- mortgage/lease/gift/PoA/partition indicators

Risks:
- Login/payment/manual process.
- Full automation likely unrealistic without official access.

### 14. Manual Notes

Save:
- structured note
- linked artifacts
- reviewer identity/date
- fact/allegation/inference separation

Key fields:
- source facts
- documents seen
- alleged issue
- reviewer inference
- property identifiers
- outcome

Risks:
- Anecdotes are not proof without artifacts.

## Implementation Sequence

1. Build raw artifact manifest writer.
2. Build generic downloader for public HTML/PDF/JSON.
3. Implement Wave 1 collectors:
   - Revenue/SIA/LARR
   - ORERA/RERA discovery
   - DRT cause lists
   - Bhunaksha/WFS
4. Add artifact text extraction/OCR status pipeline.
5. Implement Wave 2 collectors.
6. Implement browser/session collectors for Wave 3.
7. Add manual artifact intake for Wave 4.
8. Add lead-only media corpus for Wave 5.

## Current Collector Entrypoint

Wave 1 has a standalone collector at:

```text
pid/collectors/wave1.mjs
```

Run a small first pass:

```bash
node pid/collectors/wave1.mjs --date=2026-05-26 --max-pdfs=3
```

Supported options:
- `--source=revenue,orera,drt,bhunaksha` to run selected collectors
- `--max-pdfs=N` to cap linked Revenue/SIA PDF downloads per listing page
- `--skip-pdfs` to save listing pages and parsed rows only
- `--root=pid/data/raw` to choose a raw archive root
- `--strict-tls` to avoid the collector's curl `-k` fallback for government pages with local certificate-chain issues

Current Wave 1 collector coverage:
- Odisha Revenue acquisition/SIA listing pages and linked PDFs
- ORERA app-shell pages and visible public navigation links
- DRT Cuttack seed cause-list URLs
- Bhunaksha WFS sample bbox for Khordha/Bhubaneswar/Mendhasala

Current few-sample source collector coverage:
- `pid/collectors/source_samples.mjs` saves small public/access-probe samples for Orissa High Court PDFs, BDA planning/zoning pages, OSHB/BDA auction pages, consumer portals, RCCMS, eCourts, CERSAI, and IGR Odisha.
- `pid/collectors/bhulekh_sample.mjs` saves one controlled browser-backed Bhulekh RoR sample using the existing product fetcher and the PID raw archive.
- Latest sample run: `2026-05-26-source-samples`.
- Latest sample status: 34 unique raw artifact files and 44 generated JSON summaries validated. No bulk scrape started for these sources.
- Run notes: `pid/research/source_samples_2026-05-26.md`.

Run the public/access probe samples:

```bash
node pid/collectors/source_samples.mjs --date=2026-05-26-source-samples --max-linked-docs=2 --throttle-ms=750
```

Run the controlled Bhulekh single-plot sample:

```bash
node pid/collectors/bhulekh_sample.mjs --date=2026-05-26-source-samples
```

## Initial 2-Week Target

Week 1:
- raw storage and manifest format
- Revenue/SIA collector
- DRT cause-list collector
- Bhunaksha/WFS sample collector
- ORERA discovery collector

Week 2:
- PDF/text extraction status
- High Court PDF keyword collector
- bank auction/public notice collector prototype
- manual artifact intake format
- 1,000 raw artifacts target if source volume allows

## Do Not Do Yet

- Do not build buyer-facing scoring.
- Do not claim plot risk from source hits.
- Do not attempt full Odisha Bhulekh/eCourts scraping before controlled source tests.
- Do not mix raw-data collection with insight generation.
- Do not treat news/media as proof without official artifacts.
