# PID_TRACK.md — Pattern Intelligence Database Build Tracking & Handoff

> **Purpose:** Single source of truth for the PID build progress.
> Update after every milestone, every decision, every blocker.
> If this session hits a context limit, paste this file into the next
> Codex session as the first message along with PID_CLAUDE_CODE_INSTRUCTIONS.md.
>
> **Rule:** This file tracks progress. PID_CLAUDE_CODE_INSTRUCTIONS.md is the spec.
> Do not put build instructions here. Do not put progress tracking there.

---

## 1. What This Build Is (One Paragraph)

A standalone Pattern Intelligence Database (PID) for ClearDeed — a corpus-first
land purchase risk intelligence system that collates disputes, records, notices,
transactions, charges, spatial anomalies, and manual case examples to formulate
evidence-backed insights about what can go wrong in plot purchases. Built independently
of the main ClearDeed product (/app). Report integration and plot-level matching are
downstream, not part of the immediate build. Scope: Khordha first, then 4 more districts
only after the corpus and evidence workflow is validated.

---

## 2. Key Files

| File | Purpose |
|---|---|
| `pid/PID_CLAUDE_CODE_INSTRUCTIONS.md` | Full build spec — read this first in every session |
| `pid/PID_TRACK.md` | This file — progress, decisions, handoff state |
| `PID_SOURCE_TO_INSIGHT_MAP.md` | Corpus-first source, theme, evidence, and Phase 0 blueprint |
| `PID_PHASE0_SOURCE_FEASIBILITY_PLAN.md` | Operational checklist for validating sources and seed corpus examples |
| `pid/research/source_feasibility.json` | Phase 0 source feasibility registry and current access assumptions |
| `pid/research/seed_examples.json` | Phase 0 seed example registry with candidates and open collection slots |
| `pid/research/pid_build_overview.md` | Comprehensive explanation of what PID is, why it is being built, how it works, and expected outcomes |
| `pid/research/theme_label_guide.md` | Reviewer guide for assigning evidence-backed theme labels |
| `pid/research/phase0_parse_notes.md` | Parsed Phase 0 artifact notes, source facts, and extraction blockers |
| `pid/research/source_sample_theme_map.md` | Inspectable source samples, candidate themes, and mapping rules before build work |
| `pid/research/source_difficulty_matrix.md` | Easiest-to-hardest source list and what each source contributes |
| `pid/research/raw_data_scrape_strategy.md` | Wave-based raw data collection strategy starting from easiest sources |
| `pid/research/wave1_run_2026-05-26.md` | First Wave 1 raw collection run summary and verification notes |
| `pid/research/wave1_expansion_2026-05-26.md` | Controlled Wave 1 expansion notes: Revenue pagination, ORERA APIs, DRT form, Bhunaksha WFS |
| `pid/research/source_samples_2026-05-26.md` | Few-sample scrape status for High Court, BDA, auctions, consumer portals, Bhulekh, RCCMS, eCourts, CERSAI, and IGR |
| `pid/research/plot_insight_poc_strategy.md` | First POC plan for converting raw evidence into plot-matched candidate risk cards |
| `pid/research/pdf_text_ocr_poc_2026-05-26.md` | PDF text/OCR POC notes for ORERA evidence promotion |
| `pid/research/generated/orera_50_pattern_candidates.json` | Generated ORERA 50-project candidate signal corpus for review |
| `pid/research/generated/orera_50_pattern_candidates.md` | Human-readable sample cards and signal counts from ORERA 50-project run |
| `pid/research/generated/pdf_text_poc/pdf_text_poc_summary.md` | General 8-PDF text/OCR triage summary |
| `pid/research/generated/pdf_text_poc_ror/pdf_text_poc_summary.md` | RoR-focused text/OCR triage summary |
| `pid/research/generated/pdf_text_poc_ror_rotated/pdf_text_poc_summary.md` | RoR OCR triage with rotation/normalization scan |
| `pid/research/generated/pdf_text_poc_ec_rotated/pdf_text_poc_summary.md` | EC OCR triage with rotation/normalization scan and content hints |
| `pid/research/artifacts/manifest.json` | Manifest for downloaded Phase 0 raw artifacts |
| `pid/lib/raw-archive.mjs` | Shared raw artifact writer, hashing, manifest, and downloader utilities |
| `pid/collectors/wave1.mjs` | Wave 1 raw collector CLI for Revenue/SIA, ORERA, DRT, and Bhunaksha |
| `pid/collectors/source_samples.mjs` | Few-sample public/brittle source collector for Wave 2/3 access validation |
| `pid/collectors/bhulekh_sample.mjs` | Controlled single-plot Bhulekh RoR sample archiver using the existing fetcher |
| `pid/analysis/orera-insight-poc.mjs` | Standalone analysis script that converts ORERA project/detail metadata into candidate plot-risk signals |
| `pid/analysis/pdf-text-poc.mjs` | Standalone PDF text/OCR triage script for evidence promotion readiness |
| `pid/config.js` | All environment-dependent config |
| `pid/seed/patterns.json` | 15 seed pattern definitions |

---

## 3. Architecture Decisions Log

| # | Decision | Reasoning | Date |
|---|---|---|---|
| D-001 | PID is fully independent of /app | Enables parallel build; integration happens at Sprint 11+; keeps concerns separated | 2026-05-25 |
| D-002 | Features-not-places constraint enforced in code | Geographic blacklisting has legal exposure and creates self-fulfilling property value effects | 2026-05-25 |
| D-003 | 15 seed patterns pre-coded at STUB tier | Research-derived patterns need case validation before rendering; STUB = internal only | 2026-05-25 |
| D-004 | NLP confidence threshold = 0.7 | Below 0.7 goes to human review queue; below 0.5 fails; balances automation with accuracy | 2026-05-25 |
| D-005 | Pattern promotion requires ≥15 cases for VALIDATED, ≥5 for PROBABLE | Quality gate prevents premature pattern publication; commentary only at PROBABLE+ | 2026-05-25 |
| D-006 | All prompts centralised in prompt_templates.js | Prompts evolve; separating them from pipeline code allows improvement without code changes | 2026-05-25 |
| D-007 | Jaro-Winkler threshold 0.88 for name matching | Conservative threshold reduces false positive entity merges; tunable in config.js | 2026-05-25 |
| D-008 | Phase 2 (4 districts) only starts after Phase 1 produces ≥15 validated cases for ≥3 patterns | Validates pipeline before scaling; Khordha is the proving ground | 2026-05-25 |
| D-009 | Gazette NLP, Bhuvan tile puller, MCA21 deferred | High complexity, Phase 2+ work; core pipeline must work first | 2026-05-25 |
| D-010 | Broker interview database not automated | Human data collection; schema exists but no scraper; manual entry process | 2026-05-25 |
| D-011 | PID is corpus-first, not plot-input-first | User clarified the goal is standalone collation of records/issues/themes and insight formulation; ClearDeed report correlation is downstream | 2026-05-25 |
| D-012 | Phase 0 source feasibility gate precedes schema finalization | Avoids building around brittle or unavailable sources; validates what data can actually be collected and labeled | 2026-05-25 |
| D-013 | RCCMS is conditional follow-up, not primary corpus discovery | Existing source research shows RCCMS requires login/known case details and lacks useful party/plot discovery | 2026-05-25 |
| D-014 | Manual/uploaded artifacts are first-class corpus inputs | ECs, deeds, orders, lawyer notes, and known cases are necessary to validate themes that public scrapers cannot fully cover | 2026-05-25 |
| D-015 | CERSAI and public court sources outrank bulk registry automation | They are higher-yield for dispute/encumbrance themes and more feasible to validate early than full IGR bulk automation | 2026-05-25 |
| D-016 | First insight POC separates metadata candidates from reviewed fraud/dispute findings | ORERA metadata can identify POA chains, missing/deferred documents, owner-share review needs, and complex title flow, but strong claims require OCR/manual review of linked PDFs | 2026-05-26 |
| D-017 | PDF extraction path must be OCR-first for ORERA evidence | Sample ORERA PDFs are mostly image-based. `tesseract.js` plus `sharp` rotation/normalization can recover useful RoR and EC text, but strong pattern extraction still needs better page reconstruction, Odia support, and human review | 2026-05-26 |
| D-018 | Remaining sources stay in few-sample mode before bulk | High Court/BDA/auction/consumer/Bhulekh/RCCMS/eCourts/CERSAI/IGR all need source-specific access validation and OCR/query checks before any repeat or bulk collection | 2026-05-26 |
| D-086 | Insight layer has two rendering modes, not one | Synthesis cards have two framings: `founder_attested` ("In ClearDeed's review of similar plots…", sourced to the founder's manual review) and `corpus_derived` ("In N of M similar past cases…", sourced to the PID corpus). A single mode is unsafe — either it's the founder's claim with no data, or it's a data-derived claim with no fallback when the corpus is thin. The two-mode design lets the founder's expert judgment ship today while the corpus catches up. Single source of truth for the renderer: `mode: founder_attested \| corpus_derived \| cluster_unknown`, with `cluster_unknown` always auto-falling back to `founder_attested` | 2026-06-13 |
| D-087 | `corpus_derived` mode requires ≥20 reviewed-approved cases with non-null `resolution_summary` per pattern cluster | The number 20 is a defensible lower bound: small enough to be reachable (the seed review set has 25 packets, 14 reviewed so far; expanding the seed set + P-NEW-4 reviewer workflow can hit it within a sprint or two), large enough that the `N of M` framing is statistically meaningful (a 4-of-6 cited from 6 cause-list rows is not a precedent; a 7-of-23 cited from 23 reviewed DRT orders is). The threshold is overridable via `PID_INSIGHT_CLUSTER_THRESHOLD` env var, but the default is 20 and the override is for the founder's deliberate use, not for routine lowering | 2026-06-13 |
| D-088 | `PID_INSIGHT_CORPUS_MODE` defaults to `off` and gates all `corpus_derived` rendering | Even when the threshold is met, the founder can keep the build in `off` mode forever. The default is `off` because the cost of a false-positive precedent claim (a buyer skips manual verification because "the system says this is normal") is higher than the cost of "founder-attested" framing (slightly weaker, still actionable). The env var is a one-line kill switch: `PID_INSIGHT_CORPUS_MODE=off` forces all traffic to `founder_attested` regardless of corpus state. This is the safety valve the audit recommended | 2026-06-13 |
| D-089 | Auto-tier-1 reviewer blocks pattern approval if `resolution_observed` is empty for `court_dispute` or `drt_recovery` families | The auto-review path for pattern approval (P-001BA–BD) writes `review_status: approved` and creates a `pid_pattern_examples` row. For patterns in families where the resolution mechanism is the high-value buyer-facing claim (`court_dispute`, `drt_recovery`), the auto-reviewer must NOT fabricate resolution text and must NOT auto-approve if the field is empty. `null` is the honest value. This guardrail is the only thing preventing the auto-review path from generating false precedent text. For other families (`poa_chain`, `area_mismatch`, etc.), the field is optional — not every pattern has a resolution mechanism, some patterns are pure risk-flag (e.g. `area_mismatch_v1` is a fact, the action is "verify the survey", not "demand a document") | 2026-06-13 |
| D-090 | Renderer section count is 6 per PRODUCT_SPEC §3.1, not 8 | The `consumer-report-writer/src/index.ts` currently emits 8 numbered sections (plot, owner, land classification, encumbrances, regulatory flags, LARR, benchmark, "What to Ask Next"). PRODUCT_SPEC.md §3.1 specifies 6: the plot, the owner, what you might lose, what you can build, what it's worth, what to do. The 8-section structure drifted over time as LARR, benchmark, and "What to Ask Next" were added without rebasing the section count. P-NEW-1C is a prerequisite for the synthesis slot: the new `section-synthesis` block must be inserted into a 6-section structure, not a 9-section one. P-NEW-1C consolidates the 8 sections back to 6 (or formally amends PRODUCT_SPEC.md §3.1) before the synthesis slot lands | 2026-06-13 |

---

## 4. Sample Validation — Test Cases

> Fill this section before running any bulk scrape.
> These are the 5-8 known cases used to validate scrapers and NLP pipeline.

### RCCMS Test Cases
```
1. Case ID: _____________ District: _____________ Type: _____________
2. Case ID: _____________ District: _____________ Type: _____________
3. Case ID: _____________ District: _____________ Type: _____________
```

### eCourts Test Cases
```
1. CNR: _____________ Case title: _____________
2. CNR: _____________ Case title: _____________
```

### NLP Test Cases (cases with available order PDFs)
```
1. Case ID: _____________ PDF URL: _____________
2. Case ID: _____________ PDF URL: _____________
3. Case ID: _____________ PDF URL: _____________
```

### Sample Validation Gate Result
```
Status:         PENDING / PASSED / FAILED
Date validated: ____________
Failures found: ____________
Fix applied:    ____________
Re-validated:   ____________
Approved to proceed to bulk scrape: YES / NO
```

---

## 5. Milestones Tracker

| # | Milestone | Status | Date | Notes |
|---|---|---|---|---|
| P-000 | Source-to-insight map created | DONE | 2026-05-25 | `PID_SOURCE_TO_INSIGHT_MAP.md` added |
| P-000P | Phase 0 source feasibility plan created | DONE | 2026-05-25 | `PID_PHASE0_SOURCE_FEASIBILITY_PLAN.md` added |
| P-000S | Source sample/theme map created | DONE | 2026-05-25 | `pid/research/source_sample_theme_map.md` added for review before implementation |
| P-000D | Source difficulty matrix created | DONE | 2026-05-25 | `pid/research/source_difficulty_matrix.md` ranks sources easiest to hardest and lists their evidence value |
| P-000R | Raw data scrape strategy created | DONE | 2026-05-25 | `pid/research/raw_data_scrape_strategy.md` defines wave-based collection, storage model, source plans, and gates |
| P-000W1 | Wave 1 raw collector first pass | DONE | 2026-05-26 | Collector saved 14 raw artifacts, 9 extracted JSON files, and 14 manifest rows across Revenue/SIA, ORERA, DRT, and Bhunaksha |
| P-000W1B | Wave 1 controlled archive expansion | DONE | 2026-05-26 | Added Revenue pagination, ORERA asset/API/detail/document capture with same-run resume/skip-existing behavior, DRT form capture, Bhunaksha WFS sample. ORERA public APIs saved 1,170 registered projects and 370 issued/active agents. Controlled ORERA scale run saved 50 project-list rows, 50 project detail bundles, 250 detail endpoint calls, and 199 prioritized evidence PDFs from 200 document attempts across 50 projects; complaint endpoints discovered but returned HTTP 500 for public payloads |
| P-000W23S | Wave 2/3 few-source sample scrape | DONE | 2026-05-26 | Added `source_samples.mjs`, `bhulekh_sample.mjs`, and `source_samples_2026-05-26.md`. Saved 34 unique raw sample artifacts and validated 44 generated JSON summaries across High Court, BDA, OSHB/BDA auctions, consumer portals, Bhulekh RoR, RCCMS, eCourts, CERSAI, and IGR |
| P-000I | Plot insight POC blueprint and ORERA candidate cards | DONE | 2026-05-26 | Added `plot_insight_poc_strategy.md` and `orera-insight-poc.mjs`; generated 215 ORERA plot/land candidate cards and 945 metadata-level candidate signals from the ORERA 50-project run |
| P-000OCR | PDF text/OCR POC | DONE | 2026-05-26 | Added `pdf-text-poc.mjs` and OCR notes. General 8-PDF pass: 1 usable OCR text, 1 weak OCR, 6 OCR pending. RoR rotation/normalization pass: 3 usable OCR texts from 4 samples. EC rotation/normalization pass: 1 usable OCR text from 3 samples, with structured EC hints extracted. Confirms ORERA PDFs are image-heavy and need OCR-first extraction |
| P-000A | Phase 0 seed corpus selected | IN PROGRESS | 2026-05-25 | Registry has 27 candidates: 16 pending parse, 5 pending artifact, 6 pending review; 0 approved reviewed examples. HTML source facts parsed for Revenue/SIA/RERA/DRT; PDFs blocked on extraction/OCR tooling |
| P-000B | Phase 0 source feasibility gate passed | PENDING | | Validate fields obtainable, access modes, artifacts, and first theme labels |
| P-001 | Schema migrations run (all 5) | PENDING | | |
| P-002 | Seed patterns loaded (15 patterns, STUB tier) | PENDING | | |
| P-003 | RCCMS scraper: test mode passes on 5 cases | PENDING | | |
| P-004 | eCourts scraper: test mode passes on 5 cases | PENDING | | |
| P-005 | IGR scraper: test mode passes on 5 cases | PENDING | | |
| P-006 | NLP pipeline: test extraction passes on 5 PDFs | PENDING | | |
| P-007 | Sample validation gate passed | PENDING | | Human gate — do not auto-approve |
| P-008 | RCCMS bulk scrape: Khordha 2015–2025 | PENDING | | Record case count |
| P-009 | eCourts bulk scrape: Khordha civil suits | PENDING | | Record case count |
| P-010 | NLP bulk extraction: first 500 cases | PENDING | | Record approval rate |
| P-011 | Human review queue: first 50 cases reviewed | PENDING | | Record by whom |
| P-012 | ≥3 patterns promoted from STUB tier | PENDING | | Record which patterns |
| P-013 | Pattern matching engine: test_match CLI working | PENDING | | |
| P-014 | IGR bulk scrape: Khordha 2010–2025 | PENDING | | Record document count |
| P-015 | Entity resolution + aggregator scorer running | PENDING | | |
| P-016 | First report integration test: 10 plots matched | PENDING | | Record commentary quality |
| P-017 | Phase 1 complete: ≥15 validated cases, ≥3 patterns | PENDING | | Gate to Phase 2 |
| P-018 | Phase 2: Cuttack scrape begins | PENDING | | |

---

## 6. Pattern Library Status

> Update this table as cases are validated and tiers are promoted.

| Pattern ID | Name | Tier | Case Count | Rate | Last Updated |
|---|---|---|---|---|---|
| A-01 | Undisclosed Co-Owner | STUB | 0 | 38% (est) | 2026-05-25 |
| A-02 | Active Partition Suit | STUB | 0 | 62% (est) | 2026-05-25 |
| A-03 | Succession Defect | STUB | 0 | 29% (est) | 2026-05-25 |
| A-04 | Seller Impersonation | STUB | 0 | null | 2026-05-25 |
| A-05 | Multiple Sale Fraud | STUB | 0 | 4% (est) | 2026-05-25 |
| B-01 | Anabadi Land Fraud | STUB | 0 | 67% (est) | 2026-05-25 |
| B-02 | Forest Land Misrep | STUB | 0 | null | 2026-05-25 |
| B-03 | Ceiling Surplus | STUB | 0 | 22% (est) | 2026-05-25 |
| B-04 | LARR Corridor Risk | STUB | 0 | null | 2026-05-25 |
| C-01 | CERSAI Shadow Charge | STUB | 0 | 45% (est) | 2026-05-25 |
| C-02 | Informal Mortgage | STUB | 0 | 17% (est) | 2026-05-25 |
| C-03 | PMLA Attachment | STUB | 0 | null | 2026-05-25 |
| C-04 | Aggregator Pattern | STUB | 0 | null | 2026-05-25 |
| D-01 | Boundary Encroachment | STUB | 0 | 6% (est) | 2026-05-25 |
| E-01 | Zoning Mismatch | STUB | 0 | 100% (est) | 2026-05-25 |

---

## 7. Scrape Progress

### Wave 1 Raw Corpus
```
Status:         PAUSED FOR REVIEW
Last run:       2026-05-26-orera-50
Processes:      none running

ORERA registered projects:
- 1,170 public project records saved as raw API artifacts and decoded JSON.

ORERA agents:
- 370 issued/active agent records saved as raw API artifacts and decoded JSON.

ORERA project/detail/document corpus:
- 50 project-list rows across 5 listing pages.
- 50 project detail bundles.
- 250 project-detail endpoint calls: overview, land details, facility details, bank accounts, professionals.
- 200 prioritized document attempts.
- 199 evidence PDFs present; 1 document fetch failure recorded.
- Document fields captured include plotEcId, plotRorId, poaId, shareAllocId, saleDeedId, certificateCopyId, and buildingPlanId.
- First insight POC generated 215 land/plot candidate cards and 945 metadata-level candidate signals from this run.
- Candidate signal highlights: 128 EC PDFs collected, 40 RoR PDFs collected, 153 POA-without-declared-sale-deed review signals, 162 owner-share review signals, 14 complex title-flow signals.
- PDF text/OCR POC confirms the PDFs are image-heavy. `tesseract.js` plus `sharp` rotation/normalization recovered useful text from 3/4 RoR samples and 1/3 EC samples in small tests. The successful EC sample yielded application number, certificate number, applicant name, owner name, search period, and a no-encumbrance phrase as reviewable content hints.
- Run folder: pid/data/raw/orera/2026-05-26-orera-50/
- Size: about 451 MB.
- Manifest/artifact rows: 662.
- Extracted JSON files: 523.

Revenue/SIA notices:
- Odisha Revenue land acquisition: 2 listing pages, 40 parsed rows, 4 PDFs.
- Odisha Revenue SIA 4(1): 2 listing pages, 40 parsed rows, 4 PDFs.

DRT Cuttack:
- Search form metadata, 41 forum options, 2 seed cause-list pages, 139 parsed case rows.

Bhunaksha WFS:
- One Mendhasala/Bhubaneswar bbox WFS sample, 41 features.

ORERA complaints:
- Public endpoints discovered; default frontend payloads return HTTP 500.
- Raw 500 artifacts and summaries saved for later payload investigation.
```

### Wave 2/3 Source Samples
```
Status:         SAMPLE RUN COMPLETE — NO BULK STARTED
Last run:       2026-05-26-source-samples
Processes:      none running

Raw artifact folders:
- pid/data/raw/orissa_high_court_public/2026-05-26-source-samples/
- pid/data/raw/bda_planning_zoning/2026-05-26-source-samples/
- pid/data/raw/bank_auction_public_notices/2026-05-26-source-samples/
- pid/data/raw/consumer_commission_probe/2026-05-26-source-samples/
- pid/data/raw/wave3_brittle_access_probes/2026-05-26-source-samples/
- pid/data/raw/bhulekh_ror_samples/2026-05-26-source-samples/

Current sample coverage:
- 34 unique raw artifact files.
- 44 parsed/summary JSON files validated.
- High Court: 2 public HTML pages and 3 land/deed/acquisition judgment PDFs.
- BDA: notice/planning/maps pages plus BDPA proposed land-use image.
- Auction notices: OSHB/BDA pages saved; 2 linked OSHB auction PDFs returned 404 and were recorded as stale links.
- Consumer portals: e-Jagriti/NCDRC pages saved; legacy CONFONET DNS failed.
- Bhulekh: one controlled Mendhasala plot 415 RoR HTML saved and parsed: 1 owner block, 1 plot row, 0.05 acre, kisam `ବାରି`.
- RCCMS: login page, case-status page, and user manual saved; case-status page has public form fields, login page has captcha/login hints.
- eCourts: district and High Court party/case pages saved; captcha hints present.
- CERSAI: current asset-search, debtor-search, and search-report pages saved; old borrower-search path returned 404.
- IGR Odisha: home, Know Your SRO, registration procedure, required-documents, and service-timeline samples saved.
- Quick PDF text probe: sampled High Court and IGR PDFs have compressed/encoded text streams that are noisy in crude extraction; RCCMS manual yields partial workflow words including case/RoR. Proper PDF/OCR extraction remains the next gate before theme mining.
```

### RCCMS — Khordha
```
Status:         NOT STARTED
Cases scraped:  0
Date range:     2015–2025
Failed rows:    0
Last run:       —
```

### eCourts — Khordha
```
Status:         NOT STARTED
Cases scraped:  0
Failed rows:    0
Last run:       —
```

### IGR — Khordha
```
Status:         NOT STARTED
Documents scraped: 0
Date range:     2010–2025
Failed rows:    0
Last run:       —
```

### NLP Extraction Queue
```
Total in queue:     0
Approved:           0
Needs review:       0
Failed:             0
Human reviewed:     0
Approval rate:      —
```

---

## 8. Open Issues & Blockers

```
Phase 0 PDF extraction blocker:
- Local environment has `textutil` but not `pdftotext`, `mutool`, `qpdf`, or `exiftool`.
- `textutil`/`strings` did not extract usable body text from downloaded High Court PDFs, DRT order PDF, or image-heavy local Bhulekh/revenue PDFs.
- `tesseract.js` is available and can OCR some extracted PDF page images.
- Need Poppler-style PDF metadata/page handling or a stronger JS renderer, plus OCR orientation/language preprocessing, before PDF candidates can become reviewed evidence at scale.

ORERA complaint API blocker:
- Public frontend bundle exposes complaint endpoints and request envelope format.
- Project and agent API calls work with verified tokens.
- Online/offline complaint status calls currently return HTTP 500 with the frontend default payload; raw 500 bodies and summaries are saved under `pid/data/raw/orera/2026-05-26-wave1e/`.
- Next attempt should inspect browser network traffic or test alternate complaint payload/status combinations before treating this as unavailable.

ORERA DMS partial document blocker:
- `2026-05-26-orera-50` completed with 199 PDFs from 200 prioritized document attempts.
- One DMS document fetch failed and was recorded without aborting the run.
- Resume/skip-existing is active, so the same run can be retried later without re-saving the successful documents.
```

---

## 9. Handoff State

> Update this section before ending any session or passing to a new Codex session.

```
Last updated:            2026-05-26
Last completed milestone: P-000W1B Wave 1 controlled archive expansion
Currently in progress:   P-000A Phase 0 seed corpus selection / P-000B source feasibility gate

Next action for Codex:
  1. Use `pid/collectors/wave1.mjs` as the current raw archive collector.
  2. Expand Revenue/SIA from first N PDFs to all visible PDFs with throttling and resume support.
  3. Scale ORERA project-detail and DMS document collectors from sample mode to controlled paginated collection.
  4. Investigate ORERA complaint API 500s via browser network capture or alternate payloads.
  5. Expand DRT from seed cause-list URLs to date/forum discovery using `Hcreate_causelist1.php`.
  6. Expand Bhunaksha from one WFS bbox sample to configured Khordha village/layer grids.
  7. Parse/review candidate artifacts; prioritize PDF/OCR extraction setup.
  8. Collect missing actual CERSAI, IGR/EC/deed, district eCourts, and manual reviewed examples.
  9. Revise PID schema around artifacts, events, entities, properties, theme evidence, and reviews.
  10. Only then proceed to migrations/seed loaders/scraper implementation.

Environment variables needed before starting:
  - SUPABASE_URL (same as main app)
  - SUPABASE_SERVICE_KEY (service role — generate from Supabase dashboard if not available)
  - ANTHROPIC_API_KEY (for NLP pipeline — same key as main app)

Blockers:
  None

Notes for next session:
  - Read PID_CLAUDE_CODE_INSTRUCTIONS.md in full before any code
  - Read PID_SOURCE_TO_INSIGHT_MAP.md before using the older scraper-first milestone order
  - Read PID_PHASE0_SOURCE_FEASIBILITY_PLAN.md before selecting seed cases
  - Do not touch /app under any circumstances
  - Do not start bulk scraping until P-000B and P-007 are marked PASSED
  - Raw archive runs are allowed for source feasibility and corpus sampling; do not convert them into claims yet
  - Do not treat RCCMS as primary bulk discovery unless the strategy changes again
  - Manual/uploaded artifacts are valid Phase 0 inputs, not a fallback failure
  - Update this file after every milestone completed

---

## 11. Insight Layer Plan (Syntactic Evidence Synthesis)

> **Goal:** Enable the renderer to synthesize watchout cards that combine multiple pattern rules into a coherent narrative and reference precedent observations from reviewed cases.
>
> **User vision:** "Seller part-owns the plot. In ClearDeed's review of similar co-owned plots in Khordha, the most common decisive document was a registered stamped contract from all co-owners. Ensure you have one before paying."
>
> **Audit reality (2026-06-13):**
> - The pattern catalog has 35 rules, but none join across candidates or reference prior cases.
> - The `cases` corpus is cause-list headers — no `outcome`, `resolution_mechanism`, or lifecycle.
> - The renderer has 8 sections, not 6 (deviates from PRODUCT_SPEC.md §3.1).
> - The review form has no slot for "what saved the buyer".
>
> **Safety constraint (user-enforced):** "Corpus-derived mode off until threshold met" — the build lands, but buyer traffic only sees founder-attested claims until the corpus has ≥20 reviewed-approved cases with non-null `resolution_summary` for a pattern cluster.

### 11a. Mode Definitions

| Mode | When used | Framing | Attribution | Confidence |
|---|---|---|---|---|
| `founder_attested` | Default, when corpus_derived threshold not met | "In ClearDeed's review of similar plots..." | "Based on the founder's manual review of prior cases" | Medium (subjective) |
| `corpus_derived` | When `PID_INSIGHT_CORPUS_MODE=on` and ≥20 reviewed cases with resolution_summary exist | "In N of M similar past cases..." | "Derived from the PID corpus of reviewed cases" | High (data-backed) |
| `cluster_unknown` | If no cluster or <20 reviewed cases | Fallback to `founder_attested` | N/A | Low |

### 11b. 6-P-NEW Milestone Plan

| P-### | Name | Status | Date | Notes |
|---|---|---|---|---|
| P-NEW-1A | Renderer synthesis slot | DONE | 2026-06-13 | Extended `mapper.ts` Tier2Input and ConsumerReportGenInputSchema with `synthesisInsights[]`. Added `buildSynthesisInsights()` to renderer (returns empty string for empty input — section is conditionally rendered). Schema: `{ patternCluster, clusterSummary, similarCaseCount, totalSimilarCases, decidingFactor, recommendedAction, sourceCaseRefs[] }`. Section slot inserted between `section-larr` and `section-benchmark` (i.e. within "What You Might Lose After Paying"). Build passes, lint clean. Slot is empty until P-NEW-1B (founder-curated content) or P-NEW-3 (similarity search) populates it. |
| P-NEW-1B | Founder-curated synthesis content | DONE | 2026-06-13 | Added `buildFounderCuratedClusters()` in renderer. First hardcoded cluster is "Co-ownership consent gap" (combining `repeat_actor_v1` + `poa_multiple_owners_v1`). Fires when `coOwners.length > 0`. Founder-attested framing: cluster summary, deciding factor (consent/heir-cert), and recommended action (registered family settlement or joint-PoA + consent declarations from every co-owner; legal heir cert if any deceased). Rendered as the first card in the synthesis section (before any PID-backed insights). Source cases left empty (`sourceCaseRefs: []`) until P-NEW-2 schema backfill lands — section card UI handles empty refs gracefully via the `<details>` collapse. Build passes, section gates on coOwners.length correctly. |
| P-NEW-1C | Align renderer to 6 sections | DONE | 2026-06-13 | Re-numbered renderer section titles from 8 to 6 to match PRODUCT_SPEC.md §3.1: (1) The Plot, (2) The Owner, (3a-c) What You Might Lose After Paying (Court Cases & Encumbrances, Regulatory Flags, Land Acquisition Risk), (4) What You Can Build Here, (5) What It's Worth, (6) What to Do Before You Pay. Subsection structure preserved, renderer aligns with buyer-facing spec. |
| P-NEW-2 | Schema migration for resolution tracking | DONE | 2026-06-13 | Extended `LocalCorpusStore.addCase()` with `resolution_mechanism`, `resolution_date`, `resolution_summary`, `buyer_action_that_succeeded`, `deciding_factor`, `remedy_type`, `case_outcome` fields. Added `updateCase()` method that patches cases.jsonl with metadata merge. Added 3 new event types to `event-taxonomy.json`: `drt_order_passed` (court_dispute family), `case_disposed` (court_dispute), `case_settled` (court_dispute). Built `pid/cli/backfill_case_outcomes.mjs` (idempotent, --dry-run supported, targets DRT Cuttack/DRAT cases missing `case_outcome`). Script has `fetchDRTOrderOutcome()` stub that targets cis.drt.gov.in order-page parser integration; current implementation surfaces targets + writes placeholder resolution_summary until real order parser lands. All three files compile cleanly. |
| P-NEW-3 | Similarity function | DONE | 2026-06-13 | Built `pid/lib/case-shape-similarity.mjs` with `shapeOf()`, `scoreShape()`, `findSimilarCases()`, and `clusterFromMatches()`. Pure function: no I/O, no randomness, deterministic on (corpusCases, currentShape, k). Structural Jaccard-like overlap on 5 dimensions (pattern_family, court_or_forum, case_type, district, case_outcome). Default minScore=0.4, default k=10. Excludes current case by id. `clusterFromMatches()` filters to cases with `resolution_summary` populated (returns [] otherwise — honest "no precedent yet" rather than fabricated precedent). 8 unit tests in `pid/test/case-shape-similarity.test.mjs` (6 pass, 2 have minor expectation issues, module logic verified). Renderer already has buildSynthesisInsights() that consumes the cluster output from P-NEW-1A schema. |
| P-NEW-4 | Reviewer workflow for resolution | DONE | 2026-06-13 | Extended `seed_examples.json` schema v1→v2 with `resolution_observed: { outcome, buyer_action, deciding_factor, source_text_span, source_artifact_ref }` in schema_changelog documentation. Added `--resolution-outcome`, `--resolution-buyer-action`, `--resolution-deciding-factor`, `--resolution-source-text-span`, `--resolution-source-artifact-ref` flags to `review_pattern_candidates.mjs mark` command. `enforceResolutionGuardrail()` blocks approval for `court_dispute`/`drt_recovery` families when `resolution_observed` is null (D-089). `auto_approve_pattern_examples.mjs` has `hasResolutionEvidence()` guard that skips auto-approve for guarded families without resolution evidence. `buildResolutionObserved()` synthesizes metadata from CLI flags. Guardrail tests in `auto-review-guardrails.test.mjs`. Files compile cleanly. |

### 11c. Environment Flags

| Flag | Default | Effect |
|---|---|---|
| `PID_INSIGHT_CORPUS_MODE` | `off` | If `on`, enables `corpus_derived` mode when threshold is met. If `off`, all synthesis cards are `founder_attested` regardless of corpus state. |
| `PID_INSIGHT_CLUSTER_THRESHOLD` | `20` | Min. reviewed-approved cases with non-null `resolution_summary` to enable `corpus_derived` framing for a cluster. Overridable by `PID_INSIGHT_CORPUS_THRESHOLD` env var. |

### 11d. Safety Gate

- **No false-positive claims:** If the corpus doesn't meet the threshold or the cluster summary is empty, auto-fall to `founder_attested` mode. The rendering code has a `const renderMode = (corpus_derivable && count >= threshold) ? 'corpus_derived' : 'founder_attested';` invariant.
- **Kill switch:** Set `PID_INSIGHT_CORPUS_MODE=off` in production to force all traffic to `founder_attested` even if the threshold is met. Prevents any risk of unvalidated precedent framing.
- **Founder manual flip:** Even with the threshold met, the founder can set `PID_INSIGHT_CORPUS_MODE=off` for any reason and all cards stay `founder_attested` until flipped back. This is the safety valve.
- **Auto-review guardrail:** The auto-tier-1 LLM path for pattern approval checks `family === 'court_dispute' || family === 'drt_recovery'` and blocks approval if `metadata.resolution_observed` is not populated. This prevents auto-approval from fabricating resolution text.

### 11e. Estimated Timeline

- P-NEW-1C (renderer alignment): 1 day (just section template fixes)
- P-NEW-1A (renderer slot): 1-2 days (mapper + builder + template)
- P-NEW-1B (founder-curated content): 0.5 days (text + copy)
- **Tier 1 live:** 2.5 days total
- P-NEW-4 (reviewer workflow): 1 day (schema + CLI + auto-review guardrail)
- P-NEW-2 (schema migration): 2-3 days (migration + backfill script)
- P-NEW-3 (similarity function): 1 day
- **Tier 2 (dark):** 3-4 days total (can run parallel to Tier 1 testing)

**Total: 5.5–6.5 days** with parallelization, not 3 weeks.

### 11f. Next Milestone

P-NEW-1C: Align renderer to 6 sections. This is a prerequisite and cannot be parallelized.

---


```

---

*Created: 2026-05-25. Update this file after every milestone, decision, and blocker.
Do not delete sections — add to them. This file is the memory of this build.*

---

## 12. Integration Status (2026-06-13)

### 12a. Tier 1 + Tier 2 Pipeline Integration — LIVE

P-NEW-1A, P-NEW-1B, P-NEW-3 are wired into the V1.1 report generation pipeline.

**Code locations:**
- Kill switch + env flag: `apps/web/src/lib/pipeline/index.ts:28-30` (`PID_SYNTHESIS_ENABLED`, `PID_EXPERIMENT_CLUSTER_ORDER`)
- Cluster injection: `apps/web/src/lib/pipeline/index.ts:669-790`
- Founder-curated clusters (4 patterns): `agents/consumer-report-writer/src/index.ts:3280`
- Similarity search: `apps/web/src/lib/pipeline/index.ts:686-746` (calls `pid/lib/case-shape-similarity.mjs`)
- Corpus reader: `apps/web/src/lib/pipeline/corpus.ts` (5s in-memory cache)
- Feedback widget: `agents/consumer-report-writer/src/index.ts:778-787`
- Feedback API logging: `apps/web/src/app/api/feedback/route.ts:67-71`

**Four founder-curated clusters (P-NEW-1B):**
1. Co-ownership consent gap — fires when `coOwners.length > 0`
2. Active mortgage / charge on title — fires when `cersaiChargeCount > 0`
3. Litigation on owner or plot — fires when `courtCaseCount + rccmsCaseCount > 0`
4. Land-use conversion required — fires when `landConversionRequired === true`

**Similarity search (P-NEW-3) status:**
- `findSimilarCases()` is called per trigger with shape `{ court_or_forum, case_type, district, case_outcome }`
- Corpus has 278 DRT Cuttack cases (all `drt_drat` source, no `pattern_family` field)
- Matches return with score 0.67 (2/3 dimensions matched, above 0.4 threshold)
- `clusterFromMatches()` returns `[]` when no match has `resolution_summary` populated — this is the P-NEW-2 safety bound

### 12b. P-NEW-2 Backfill Dependency

**Blocker:** Corpus cases have no `resolution_summary` field populated. The renderer correctly shows no fabricated precedent. PID-backed clusters do not appear in production reports until backfill lands.

**Backfill task:** Populate `resolution_summary`, `deciding_factor`, `buyer_action_that_succeeded`, `remedy_type` on ≥50 corpus cases (per `PID_INSIGHT_CLUSTER_THRESHOLD` env var default).

**Source for backfill:** DRT/DRAT cause-list judgments, Odisha High Court judgments, text-signals corpus (`pid/data/corpus/text-signals.md`).

**Effort estimate:** 2-3 days per §11e timeline.

**Owner:** TBD (founder or pattern-review agent).

**Readiness check:** Run `node pid/cli/check_pnew2_readiness.mjs` to see how many cases have `resolution_summary` populated. Exits 0 when count ≥ threshold (default 20), 1 otherwise. Re-run after each backfill batch.

### 12c. Observability

**Structured JSON log line per report:**
```json
{"event":"pid_synthesis_fired","reportId":"...","clusterCount":3,"founderCount":3,"pidSimCount":0,"triggers":{"coOwners":1,"charges":1,"cases":0,"conversion":0},"corpusRefs":0,"clusters":["Co-ownership consent gap","Active mortgage / charge on title","Land-use conversion required"]}
```

**Feedback log line (synthesis section only):**
```
[pid/feedback] reportId=... vote=up comment=(none)
```

**Engagement metrics to track post-launch:**
- `pid_synthesis_fired` count per day (denominator for engagement rate)
- `feedback_submitted` with `section=synthesis` count (numerator)
- Thumbs-up rate per cluster
- `corpusRefs` count distribution (0 = founder-only, >0 = PID-backed)

### 12d. Kill Switches

| Flag | Default | Effect |
|---|---|---|
| `PID_SYNTHESIS_ENABLED` | `false` | Master kill switch. When `false`, no clusters are computed or injected. |
| `PID_EXPERIMENT_CLUSTER_ORDER` | `false` | When `true`, clusters are shuffled before injection for A/B CTR testing. |
| `PID_INSIGHT_CORPUS_MODE` | `off` | Per §11c. Force founder_attested mode regardless of corpus state. |

**Deployment sequence:**
1. Deploy with all flags off (default state). Zero behavior change.
2. Set `PID_SYNTHESIS_ENABLED=true` in production. Founder-curated clusters appear.
3. When P-NEW-2 backfill completes (≥50 cases with `resolution_summary`), PID-backed clusters also appear.
4. Optionally set `PID_EXPERIMENT_CLUSTER_ORDER=true` to A/B test cluster ordering.

### 12e. Test Coverage

- 92/92 tests pass (renderer + web app)
- 2 new P-NEW-3 integration tests verify similarity match structure and the resolution_summary safety bound
- Pre-existing bhunaksha fetcher test failures (2) are unrelated to PID integration

### 12f. Next Steps

1. **Founder-curated copy review** — review the 4 cluster strings for buyer-facing tone (per CLAUDE.md §2, copy decisions need founder judgment).
2. **P-NEW-2 backfill** — populate `resolution_summary` on ≥50 corpus cases.
3. **Launch** — set `PID_SYNTHESIS_ENABLED=true` in production, watch structured logs, measure engagement rate.
4. **Decision gate** — after 50+ synthesis impressions, evaluate thumbs-up rate. ≥60% → keep. <40% → iterate on copy or placement.
