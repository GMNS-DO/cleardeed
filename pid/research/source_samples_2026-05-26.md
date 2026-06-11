# Source Samples Run — 2026-05-26

Purpose: collect only a few raw samples from the remaining public/brittle sources before any bulk scraping. This run is evidence collation only; no buyer-facing risk claims or bulk source harvesting.

## Run Summary

| Item | Count / Status |
|---|---:|
| Source groups sampled | 6 |
| Unique raw artifact files | 34 |
| Parsed/summary JSON files validated | 44 |
| Manifest rows | 41 rows, including repeated Wave 3 probe rows from a refresh run |
| Bulk scraping | Not started |

Validation command result: all generated sample JSON files parsed successfully.

## Artifact Folders

All samples are under:

```text
pid/data/raw/<source_id>/2026-05-26-source-samples/
```

Each folder has:
- `manifest.jsonl` — provenance, hash, URL, status, content type.
- `artifacts/` — raw HTML/PDF/JPG files.
- `extracted/*_summary.json` — light extraction: title, forms, links, captcha/login hints, status.
- `extracted/source_sample_summary.json` — source-level run summary.

## Source Outcomes

| Source group | Artifacts in current summary | What we got | Status |
|---|---:|---|---|
| `orissa_high_court_public` | 5 | High Court index/search HTML plus 3 land/deed/acquisition-related judgment PDFs | Works for seed PDFs and public archives |
| `bda_planning_zoning` | 4 | BDA notices, planning page, maps page, BDPA proposed land-use JPG | Works for static planning/zoning samples |
| `bank_auction_public_notices` | 5 | OSHB notice/e-auction pages, BDA auction page, 2 linked OSHB auction docs returning 404 | Index pages work; linked old PDFs may expire |
| `consumer_commission_probe` | 4 | e-Jagriti home, NCDRC home, NCDRC RTI/reference page; legacy CONFONET DNS failed | Current portals reachable; legacy CONFONET not reliable |
| `wave3_brittle_access_probes` | 16 | Bhulekh/RCCMS/eCourts/CERSAI/IGR access pages and official IGR/RCCMS PDFs | Good access-map sample; several sources still captcha/session gated |
| `bhulekh_ror_samples` | 1 | One real browser-backed Bhulekh RoR sample for Mendhasala plot 415 | Works as controlled single-plot sample |

## High-Value Samples Captured

### Orissa High Court

Saved official pages and three seed judgment PDFs:
- `cmp-1094-2022-sale-deed-dispute`
- `cmp-1292-2023-partition-sale-deed`
- `wpc-15022-15020-2022-acquisition-sale-deed`

Usefulness: title litigation, partition/sale-deed challenge, land acquisition/sale-deed execution themes. Next step is OCR/text extraction and keyword/entity extraction from PDFs.

### BDA Planning/Zoning

Saved BDA notice/planning/maps pages and a BDPA proposed land-use image.

Usefulness: zoning/planning mismatch, proposed land-use, map/notification evidence. This is plot-matchable later only after georeferencing or manual map interpretation.

### Auction/Public Notices

Saved OSHB notice/e-auction index pages and BDA auction page. Two linked OSHB auction PDFs from the index returned `404 Page not found`; raw 404 pages were saved.

Usefulness: good source for distress/security/property-description leads, but stale links mean the collector must save pages frequently and not assume linked PDFs remain available.

### Consumer Commission

Saved e-Jagriti and NCDRC landing/reference pages. Legacy `confonet.nic.in` failed DNS.

Usefulness: buyer-builder/project dispute discovery. For real samples, the next collector should use e-Jagriti search flows or known complaint/order references.

### Bhulekh RoR

Saved one controlled RoR:
- Village: Mendhasala
- Tehsil: Bhubaneswar
- Khatiyan: 415
- Owner blocks parsed: 1
- Plot rows parsed: 1
- Area: 0.05 acre
- Land class/kisam: `ବାରି`
- Final publication date: `06/03/1962`

Usefulness: proves we can archive raw RoR HTML and parsed owner/plot/classification/area fields for a known plot. This should remain controlled before scaling.

### RCCMS

Saved:
- RCCMS login page
- public case-status page
- official user manual PDF

Findings:
- Login page has captcha/login hints.
- Case-status page is public HTML with 1 form, 6 inputs, and 5 selects.

Usefulness: likely viable for known-case lookup samples, but not broad discovery yet.

### eCourts

Saved:
- District eCourts case-status page
- High Court party-name search page

Findings:
- Both pages are reachable.
- Both show captcha hints; district page also has login-like UI hints.

Usefulness: high-value for dispute detection, but controlled known-CNR/known-party samples should come before any scraping plan.

### CERSAI

Saved:
- CERSAI home
- current asset-based search page: `/CERSAI/asstsrch.prg`
- current debtor/borrower-based search page: `/CERSAI/dbtrsrch.prg`
- current search-report page: `/CERSAI/searchreport.prg`
- old borrower-search URL returned 404

Findings:
- Current public search pages are reachable.
- Pages contain captcha/login hints.

Usefulness: strong encumbrance/charge source, but queries must be controlled and no-result should never be treated as clean title.

### IGR Odisha

Saved:
- IGR home
- Know Your SRO page
- document registration procedure PDF
- required documents PDF
- public service delivery timeline PDF

Usefulness: good for workflow metadata, SRO mapping, and required-doc checks. EC/deed retrieval itself remains manual/login/payment/certified-document heavy.

## PDF Text Probe

A quick compressed-stream text probe was run on the 7 sampled PDFs:

| PDF set | Probe result | Meaning |
|---|---|---|
| High Court judgment PDFs | Text streams exist but crude extraction is noisy; one sample showed weak `case` keyword recovery | Need proper PDF parser/OCR before extracting deed/partition/acquisition themes |
| IGR guidance PDFs | Text streams exist but crude extraction is mostly encoded/noisy | Useful raw official PDFs, but extraction needs stronger tooling |
| RCCMS user manual | Crude extraction recovered workflow words including `case` and `ror` | Useful for understanding RCCMS fields and query workflow |

Conclusion: the samples are useful as raw evidence, but dispute/theme extraction from these PDFs should not proceed until the OCR/text extraction stage is improved and spot-checked.

## Immediate Next Sample Steps

1. Improve PDF/OCR extraction for High Court and IGR PDFs, then re-run the probe on these same samples.
2. Do one controlled CERSAI asset/borrower query only if we have a safe known sample name/property string.
3. Do one RCCMS known-case lookup using a known case number from manual input or Bhulekh/court references.
4. Do one eCourts known-CNR or known-party sample with screenshots/query metadata, treating captcha/session failure as an access result.
5. Expand High Court samples by keyword only after the OCR path is confirmed on these three seed PDFs.
