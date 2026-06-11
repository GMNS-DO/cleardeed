# PID_CLAUDE_CODE_INSTRUCTIONS.md
# ClearDeed — Pattern Intelligence Database (PID) Build Instructions

> **What this file is:** A self-contained Claude Code instruction document for building
> the ClearDeed Pattern Intelligence Database (PID) as a standalone system.
> This system is independent of the main ClearDeed product and will be integrated
> into the report pipeline at a later stage (Sprint 11+ per ROADMAP.md).
>
> **Read this entire file before writing a single line of code.**
> Every section exists for a reason. Do not skip ahead.
>
> **Companion tracking file:** `PID_TRACK.md` — update it after every milestone.

---

## Strategy Addendum — 2026-05-25

The PID build direction has been clarified by the user:

PID is a **standalone corpus-first land purchase risk intelligence system**. It should
collate public, paid/manual, and expert-reviewed records about what can go wrong in plot
purchases, then formulate evidence-backed insights and pattern themes from that corpus.

Do **not** begin from ClearDeed report inputs or product integration. Plot-level matching
and report consumption are downstream capabilities, not the immediate build objective.

Read `PID_SOURCE_TO_INSIGHT_MAP.md` before implementing anything. It is the current
source-to-theme blueprint and supersedes the older scraper-first sequencing where the two
conflict.

Immediate build sequence is now:

1. Phase 0 source feasibility and seed corpus selection.
2. Corpus schema design around artifacts, events, entities, properties, theme evidence,
   reviews, and insights.
3. Manual/uploaded artifact ingestion and review workflow.
4. Public-source collectors for validated sources.
5. NLP/theme extraction and evidence promotion.
6. Later: matching engine and report-consumption surfaces.

Important adjustments:

- RCCMS is conditional follow-up from known case/mutation references, not primary bulk
  discovery, unless new access/API facts prove otherwise.
- Manual/uploaded ECs, deeds, court orders, known cases, and reviewer notes are first-class
  corpus inputs.
- CERSAI, eCourts, High Court, DRT, Bhulekh, and Bhunaksha/WFS are higher-priority early
  validation sources than bulk IGR/RCCMS automation.
- Schema migrations in Section 3 should be treated as the older baseline. Revise them for
  the corpus-first event/artifact/evidence model before running migrations.

---

## 0. What You Are Building (Read This First)

You are building a **Pattern Intelligence Database (PID)** — a structured, taxonomy-driven
database of land dispute and fraud patterns that can be matched algorithmically against
individual plot data to produce predictive commentary in ClearDeed reports.

This is **not** a scraper. It is **not** a report generator. It is a standalone data
pipeline that:
1. Ingests case data from multiple public sources (RCCMS, eCourts, IGR, Bhulekh, CERSAI, etc.)
2. Extracts structured pattern features from case records using NLP
3. Builds and maintains a pattern library with confidence tiers and historical dispute rates
4. Exposes a pattern matching function: given plot attributes → return matching patterns + scores

The output this system produces will eventually be consumed by the ClearDeed report
pipeline. That integration is NOT part of this build. Build only what is in this document.

### The core principle you must never violate
**The PID reports on FEATURES, never on PLACES.**
Output is always: *"this plot matches 5 of 7 features common to Pattern X (historical
dispute rate: 34%)"* — never *"this area is high-risk."*

Geographic blacklisting is prohibited. Enforce this in code, not just in comments.
If any function, query, or output references a place name as a risk signal, that is a bug.

---

## 1. Scope of This Build

### In scope
- Database schema for all PID tables
- Seed data loader (15 patterns defined in this document, pre-coded into the schema)
- Scraper modules for: RCCMS, eCourts, IGR, Bhulekh (wrapping existing fetcher), CERSAI
- NLP extraction pipeline (case order PDFs → structured pattern features via Claude API)
- Entity resolution layer (name normalisation, PAN anchor, co-occurrence graph)
- Pattern matching engine (plot attributes → pattern scores)
- Confidence tier management (VALIDATED / PROBABLE / INDICATIVE / STUB)
- Admin CLI for: running scrapers, triggering NLP batches, reviewing extraction queue

### Out of scope — do not build these
- Any UI or buyer-facing output
- Integration with the ClearDeed report pipeline (`/app` directory is off-limits)
- The broker interview database (manual data collection — not automated)
- Gazette NLP scraper (complex PDF extraction — deferred to Phase 2)
- Bhuvan/ORSAC tile puller (GIS processing — deferred to Phase 2)
- MCA21 / news NLP layer (deferred to Phase 3)
- Any modification to the existing Bhulekh fetcher

### Geography scope
- **Phase 1:** Khordha district only
- **Phase 2:** Cuttack, Puri, Ganjam, Sambalpur (do not start until Phase 1 is validated)
- Do not build multi-district from the start. Parameterise for it, but run Khordha first.

---

## 2. Repository Structure

Create a `/pid` directory at the repo root. Do not touch `/app`.

```
/pid/
  README.md                     ← how to run each component
  config.js                     ← all env-dependent config (district scope, thresholds, etc.)

  schema/
    001_pid_patterns.sql        ← pattern library table
    002_pid_cases.sql           ← case library table
    003_pid_entities.sql        ← entity resolution tables
    004_pid_queue.sql           ← NLP extraction queue
    005_pid_match_log.sql       ← pattern match log (for audit)

  seed/
    patterns.json               ← 15 seed patterns (see Section 5)
    load_seed.js                ← loads patterns.json into pid_patterns table

  scrapers/
    rccms_scraper.js            ← RCCMS case extractor
    ecourts_scraper.js          ← eCourts case extractor
    igr_scraper.js              ← IGR document extractor
    bhulekh_scraper.js          ← wraps existing fetcher (DO NOT rewrite it)
    cersai_scraper.js           ← CERSAI charge extractor
    lib/
      rate_limiter.js           ← shared: delay + exponential backoff
      supabase_client.js        ← service role client for bulk writes
      http_client.js            ← shared HTTP client with retry logic

  nlp/
    extraction_pipeline.js      ← PDF → text → LLM → structured fields
    prompt_templates.js         ← all Claude API prompts (centralised here)
    review_queue.js             ← manages low-confidence extractions
    pdf_extractor.js            ← pdfplumber / Tesseract wrapper

  entity_resolution/
    normaliser.js               ← name normalisation (strip honorifics, Jaro-Winkler)
    pan_anchor.js               ← PAN/Aadhaar-based entity linking
    graph_builder.js            ← co-occurrence graph construction
    aggregator_scorer.js        ← Aggregator Pattern Score computation

  matching/
    engine.js                   ← core: plot_attributes → pattern matches
    feature_extractors.js       ← extract matchable features from raw plot data
    commentary_generator.js     ← matched patterns → LLM narrative

  cli/
    run_scraper.js              ← CLI: node cli/run_scraper.js --source rccms --district Khordha
    run_nlp_batch.js            ← CLI: process N items from NLP queue
    review_extractions.js       ← CLI: show low-confidence items for human review
    update_pattern_rates.js     ← CLI: recompute historical_dispute_rate from case library
    test_match.js               ← CLI: test pattern matching on a given plot attribute set

  PID_TRACK.md                  ← tracking and handoff doc (update after every milestone)
```

---

## 3. Database Schema

Run migrations in numbered order. All tables go in your existing Supabase instance.
Use the same connection as the main app but with the service role key.

### Migration 001 — pid_patterns (the pattern library)
```sql
CREATE TABLE pid_patterns (
  pattern_id              TEXT PRIMARY KEY,
  -- Format: [A-E]-[01-99] e.g. 'A-01'

  name                    TEXT NOT NULL,
  category                TEXT NOT NULL CHECK (category IN ('A','B','C','D','E')),
  -- A=Title, B=GovtLand, C=Encumbrance, D=Physical, E=Regulatory

  root_cause              TEXT NOT NULL,
  features                JSONB NOT NULL DEFAULT '[]',
  -- Array of {feature_id, description, source_portal, query_method, weight}

  data_signals            JSONB NOT NULL DEFAULT '[]',
  -- Array of {signal, portal, detection_logic}

  source_portals          JSONB NOT NULL DEFAULT '[]',
  -- Array of portal names used to detect this pattern

  historical_dispute_rate FLOAT,
  -- Null until enough cases are validated

  confidence_tier         TEXT NOT NULL DEFAULT 'STUB'
    CHECK (confidence_tier IN ('VALIDATED','PROBABLE','INDICATIVE','STUB')),

  case_library_count      INTEGER NOT NULL DEFAULT 0,
  prevention_signal       TEXT,
  last_updated            TIMESTAMPTZ DEFAULT NOW(),
  version                 INTEGER NOT NULL DEFAULT 1,
  is_active               BOOLEAN NOT NULL DEFAULT TRUE,
  created_at              TIMESTAMPTZ DEFAULT NOW()
);

-- Confidence tier rules (enforced in application layer, documented here):
-- STUB:       case_library_count = 0 — not rendered in reports
-- INDICATIVE: case_library_count 1-4 — rendered with caveat
-- PROBABLE:   case_library_count 5-14 — rendered with "estimated" qualifier
-- VALIDATED:  case_library_count >= 15, >= 2 human reviewers — full commentary
```

### Migration 002 — pid_cases (case library)
```sql
CREATE TABLE pid_cases (
  id                      BIGSERIAL PRIMARY KEY,
  case_source             TEXT NOT NULL,
  -- 'rccms' | 'ecourts' | 'igr' | 'news' | 'manual'

  source_case_id          TEXT,
  -- Original case number / document number from source

  district                TEXT NOT NULL,
  tahasil                 TEXT,
  plot_number             TEXT,
  khatiyan_number         TEXT,
  unique_plot_id          TEXT,

  -- Parties (raw as scraped)
  petitioner_raw          TEXT,
  respondent_raw          TEXT,
  parties_raw             JSONB,

  -- Case metadata
  case_type               TEXT,
  filing_date             DATE,
  disposal_date           DATE,
  case_status             TEXT,
  outcome                 TEXT,

  -- NLP extraction results
  dispute_type            TEXT,
  root_cause_category     TEXT CHECK (root_cause_category IN ('A','B','C','D','E')),
  pattern_ids_matched     JSONB DEFAULT '[]',
  -- Array of pattern_ids this case contributes to

  features_extracted      JSONB DEFAULT '{}',
  -- Structured features extracted from order text

  legal_provisions_cited  JSONB DEFAULT '[]',
  extraction_confidence   FLOAT,
  -- 0.0 to 1.0; < 0.7 goes to manual review queue

  -- Review state
  review_status           TEXT DEFAULT 'pending'
    CHECK (review_status IN ('pending','approved','rejected','needs_review')),
  reviewed_by             TEXT,
  reviewed_at             TIMESTAMPTZ,
  review_notes            TEXT,

  -- Source document
  order_pdf_url           TEXT,
  order_text_raw          TEXT,
  -- Raw extracted text before NLP; keep for re-processing

  scraped_at              TIMESTAMPTZ DEFAULT NOW(),
  created_at              TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_cases_district ON pid_cases(district);
CREATE INDEX idx_cases_pattern ON pid_cases USING GIN(pattern_ids_matched);
CREATE INDEX idx_cases_review ON pid_cases(review_status);
CREATE INDEX idx_cases_plot ON pid_cases(unique_plot_id) WHERE unique_plot_id IS NOT NULL;
```

### Migration 003 — pid_entities (entity resolution)
```sql
-- Normalised entity registry
CREATE TABLE pid_entities (
  id                      BIGSERIAL PRIMARY KEY,
  entity_key              TEXT UNIQUE NOT NULL,
  -- Primary stable key: PAN if available, else generated UUID

  name_variants           JSONB NOT NULL DEFAULT '[]',
  -- All name forms seen across sources

  pan_number              TEXT,
  aadhaar_last4           TEXT,
  -- Never store full Aadhaar

  entity_type             TEXT DEFAULT 'individual'
    CHECK (entity_type IN ('individual','company','trust','unknown')),

  -- Aggregator Pattern Score
  aggregator_score        FLOAT,
  -- 0-100; computed by aggregator_scorer.js

  aps_portfolio_size      INTEGER DEFAULT 0,
  aps_avg_hold_months     FLOAT,
  aps_district_spread     INTEGER DEFAULT 0,
  aps_litigation_rate     FLOAT,
  aps_last_computed       TIMESTAMPTZ,

  is_flagged              BOOLEAN DEFAULT FALSE,
  flag_reason             TEXT,

  created_at              TIMESTAMPTZ DEFAULT NOW(),
  updated_at              TIMESTAMPTZ DEFAULT NOW()
);

-- Name variant index for fuzzy lookup
CREATE INDEX idx_entities_pan ON pid_entities(pan_number) WHERE pan_number IS NOT NULL;
CREATE INDEX idx_entities_flagged ON pid_entities(is_flagged) WHERE is_flagged = TRUE;

-- Entity-to-property linkage
CREATE TABLE pid_entity_properties (
  id                      BIGSERIAL PRIMARY KEY,
  entity_key              TEXT NOT NULL REFERENCES pid_entities(entity_key),
  unique_plot_id          TEXT,
  district                TEXT,
  tahasil                 TEXT,
  transaction_type        TEXT,
  -- 'purchase' | 'sale' | 'mortgage' | 'poa' | 'inheritance' | 'unknown'
  transaction_date        DATE,
  consideration_raw       TEXT,
  source                  TEXT,
  -- 'igr' | 'rccms' | 'ecourts' | 'cersai'
  source_document_id      TEXT,
  created_at              TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_ep_entity ON pid_entity_properties(entity_key);
CREATE INDEX idx_ep_plot ON pid_entity_properties(unique_plot_id);
```

### Migration 004 — pid_nlp_queue (extraction queue)
```sql
CREATE TABLE pid_nlp_queue (
  id                      BIGSERIAL PRIMARY KEY,
  case_id                 BIGINT REFERENCES pid_cases(id),
  priority                INTEGER DEFAULT 5,
  -- 1=highest, 10=lowest

  status                  TEXT DEFAULT 'pending'
    CHECK (status IN ('pending','processing','done','failed','needs_review')),

  attempt_count           INTEGER DEFAULT 0,
  last_attempted_at       TIMESTAMPTZ,
  error_message           TEXT,
  created_at              TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_queue_status ON pid_nlp_queue(status, priority);
```

### Migration 005 — pid_match_log (audit trail)
```sql
CREATE TABLE pid_match_log (
  id                      BIGSERIAL PRIMARY KEY,
  unique_plot_id          TEXT NOT NULL,
  matched_at              TIMESTAMPTZ DEFAULT NOW(),
  plot_attributes         JSONB NOT NULL,
  -- Snapshot of attributes used for matching

  matches                 JSONB NOT NULL DEFAULT '[]',
  -- Array of {pattern_id, match_score, matched_features, commentary}

  highest_match_score     FLOAT,
  has_showstopper         BOOLEAN DEFAULT FALSE,
  triggered_by            TEXT
  -- 'report_generation' | 'monitoring' | 'test'
);

CREATE INDEX idx_matchlog_plot ON pid_match_log(unique_plot_id, matched_at DESC);
CREATE INDEX idx_matchlog_showstopper
  ON pid_match_log(has_showstopper) WHERE has_showstopper = TRUE;
```

---

## 4. Config File

All environment-dependent values live in `config.js`. Never hardcode these.

```javascript
// pid/config.js
module.exports = {
  // Geography
  DISTRICT_SCOPE: process.env.PID_DISTRICT_SCOPE || 'Khordha',
  // Comma-separated when expanding: 'Khordha,Cuttack,Puri'

  // Scraping behaviour
  SCRAPE_DELAY_MS: parseInt(process.env.PID_SCRAPE_DELAY_MS) || 1500,
  MAX_RETRIES: parseInt(process.env.PID_MAX_RETRIES) || 3,
  BACKOFF_MULTIPLIER: 2,

  // NLP pipeline
  NLP_BATCH_SIZE: parseInt(process.env.PID_NLP_BATCH_SIZE) || 10,
  NLP_CONFIDENCE_THRESHOLD: parseFloat(process.env.PID_NLP_CONFIDENCE_THRESHOLD) || 0.7,
  // Items below this go to manual review queue

  // Pattern matching thresholds
  MATCH_COMMENTARY_THRESHOLD: 0.6,
  // match_score above this → generate commentary

  MATCH_SHOWSTOPPER_THRESHOLD: 0.8,
  // match_score above this AND pattern VALIDATED → SHOWSTOPPER flag

  // Confidence tier thresholds
  TIER_VALIDATED_MIN_CASES: 15,
  TIER_PROBABLE_MIN_CASES: 5,

  // Entity resolution
  JARO_WINKLER_THRESHOLD: 0.88,
  // Name match threshold for entity deduplication

  // Aggregator Pattern Score thresholds
  APS_MIN_PORTFOLIO_SIZE: 5,
  // Seller with >= 5 properties in 5 years triggers APS computation

  APS_MAX_HOLD_MONTHS: 18,
  // Sell within 18 months = short hold period signal
};
```

---

## 5. Seed Patterns

The following 15 patterns must be loaded into `pid_patterns` via `seed/load_seed.js`
before any scraping begins. They are pre-defined from primary research and do not
require case validation to be entered — they start at STUB tier and are promoted
as case evidence accumulates.

Each pattern below maps directly to the schema in Migration 001.

> **Coding rule:** Do not inline these in `load_seed.js`. Put them in `seed/patterns.json`
> and have `load_seed.js` read and upsert from that file. This way patterns can be
> updated without touching code.

### Pattern definitions to encode in patterns.json:

**A-01 — Undisclosed Co-Owner / Partial Title Sale**
- category: A
- features: ROR shows ≥2 owners; seller claims sole ownership; share fractions present;
  co-owner name differs from seller; recent mutation dispute between co-owners;
  sale consideration inconsistent with fractional share
- source_portals: Bhulekh ROR Front Page, RCCMS, IGR, eCourts
- prevention_signal: Demand certified copies of all co-owners' ID proofs + written
  consent on sale deed; verify each co-owner's PAN links to the same KYC as ROR name
- historical_dispute_rate: 0.38 (initial estimate — update from case data)

**A-02 — Active Partition Suit (Lis Pendens)**
- category: A
- features: eCourts shows OS/CS case naming plot; last hearing within 12 months;
  multiple family-name defendants; ROR shows inherited ownership; mutation on hold
- source_portals: eCourts, RCCMS, IGR, Bhulekh Back Page
- prevention_signal: Obtain certified copy of latest order; if unresolved, walk away —
  Section 52 TPA exposure is absolute
- historical_dispute_rate: 0.62

**A-03 — Succession / Inheritance Defect (Unrecorded Heirs)**
- category: A
- features: Seller name differs from ROR owner; mutation not updated after owner death;
  ROR shows single ancestral name; no registered Will or succession certificate;
  female heirs of same family not mentioned
- source_portals: Bhulekh ROR, IGR, Civil courts, RCCMS
- prevention_signal: Demand registered succession certificate or probate of Will; if
  intestate, require all Class-I heirs to co-sign
- historical_dispute_rate: 0.29

**A-04 — Seller Impersonation / Identity Fraud**
- category: A
- features: Seller name has transliteration variants inconsistent with ROR; owner known
  to be NRI or absentee; property vacant; PoA registered in unrelated state; seller ID
  address does not match property district
- source_portals: IGR, Bhulekh ROR, CERSAI, Criminal courts
- prevention_signal: Require video-call verification with original owner; cross-verify
  Aadhaar biometric at CSC; do not accept PoA without original owner verification
- historical_dispute_rate: null (set to null until validated)

**A-05 — Multiple Sale / Double-Registration Fraud**
- category: A
- features: IGR shows >1 sale deed for same plot in last 5 years; gap between registration
  and mutation date >90 days; khatiyan inconsistency between documents
- source_portals: IGR, Bhulekh ROR, RCCMS
- prevention_signal: Check IGR for all prior transactions on plot — not just current
  seller's registration; insist mutation is complete before paying balance
- historical_dispute_rate: 0.04

**B-01 — Anabadi / Government Waste Land Fraud**
- category: B
- features: Kisam = Anabadi/Jungle/Sarkari; seller cannot produce original settlement order;
  plot adjacent to other government-classified parcels; no evidence of tehsil-recorded conversion
- source_portals: Bhulekh ROR Front+Back, Revenue Records, RCCMS, Odisha Gazette
- prevention_signal: Do not accept photocopied settlement orders; demand original gazette
  notification number; cross-verify at DLR office
- historical_dispute_rate: 0.67

**B-02 — Forest / Eco-Sensitive Land Misrepresentation**
- category: B
- features: Bhuvan shows tree canopy on/adjacent to plot; plot within 1km of Reserved/Protected
  Forest; no conversion certificate; Kisam shows agricultural but ground is forest
- source_portals: Bhuvan Forest Map, MoEFCC portal, Forest Dept records, Bhulekh ROR
- prevention_signal: Run Bhuvan satellite overlay for every peri-urban/semi-rural plot;
  any green canopy within 200m triggers Forest Department verification
- historical_dispute_rate: null

**B-03 — Ceiling Surplus / Bhoodan Encumbrance**
- category: B
- features: Area >5 acres agricultural in single ownership; RoR shows pre-1970 settlement
  without subsequent transfers; no 30-year title chain in IGR; Back Page shows ceiling reference;
  related khatiyan plots held by family members
- source_portals: Bhulekh ROR Back Page, RCCMS, District Collector records
- prevention_signal: Demand full 30-year title chain; any pre-1980 gap for agricultural land
  requires Revenue Department certification that ceiling vesting does not apply
- historical_dispute_rate: 0.22

**B-04 — LARR Acquisition Corridor Risk**
- category: B
- features: Plot within 500m of gazette-notified acquisition alignment; LARR Section 11
  notification within 36 months; plot in gazetted "likely to acquire" zone
- source_portals: Odisha Gazette, NHIDCL/NHAI alignment maps, BDA Master Plan
- prevention_signal: Download gazette notification; measure plot distance from centre-line;
  get written District Collector confirmation if distance <200m
- historical_dispute_rate: null

**C-01 — Undisclosed Active Mortgage (CERSAI Shadow Charge)**
- category: C
- features: CERSAI shows active charge; no satisfaction registered; charge registration
  within 5 years; seller has multiple active charges; loan amount ≥ sale price
- source_portals: CERSAI, IGR, RCCMS
- prevention_signal: CERSAI search mandatory for every transaction; demand written NOC
  from lender confirming discharge before registration
- historical_dispute_rate: 0.45

**C-02 — Private / Informal Lender Mortgage (Off-CERSAI)**
- category: C
- features: CERSAI clean but Bhulekh Back Page shows encumbrance; seller profile consistent
  with informal borrowing; IGR shows short-gap resales
- source_portals: Bhulekh ROR Back Page, IGR, SRO records, RCCMS
- prevention_signal: Search IGR for all document types; demand seller's signed declaration
  of all financial claims with personal liability for undisclosed charges
- historical_dispute_rate: 0.17

**C-03 — PMLA Attachment / ED Proceedings**
- category: C
- features: Seller has ED/CBI proceedings in any court; property in ED press release;
  seller's other properties have ED attachment; rapid price negotiation
- source_portals: eCourts (PMLA case type), ED press releases, Benami Prohibition Unit
- prevention_signal: Run seller name in eCourts across all case types; check ED website;
  any PMLA signal = immediate walk away
- historical_dispute_rate: null

**C-04 — Aggregator / Land Flipper Portfolio Pattern**
- category: C
- features: IGR owner search returns ≥5 properties in 5 years; properties span multiple
  districts; short hold periods (<18 months); name variants across registrations;
  multiple co-occurring parties across different transactions
- source_portals: IGR (pan-state), CERSAI, eCourts, RCCMS
- prevention_signal: Run IGR owner search on seller name AND all variants; compute portfolio
  size, hold period, multi-district spread
- historical_dispute_rate: null

**D-01 — Boundary Encroachment / Neighbour Dispute**
- category: D
- features: Bhunaksha boundary does not match physical demarcation; no recent re-survey
  (>15 years); neighbouring plot owner in dispute with seller in RCCMS; plot shape change
  between Bhunaksha and current satellite
- source_portals: Bhunaksha, Bhuvan satellite, RCCMS, Tehsil survey records
- prevention_signal: Commission ETS physical survey before paying balance; compare
  Bhunaksha boundary with current satellite at plot level
- historical_dispute_rate: 0.06

**E-01 — Zoning / Land Use Mismatch (Master Plan Conflict)**
- category: E
- features: BDA/ORSAC Master Plan shows zone incompatible with intended use; plot in
  Industrial/Green Belt/Flood Zone; no conversion order; price premium unexplained by
  permitted use
- source_portals: BDA Master Plan 2030, ORSAC, Odisha Town Planning regulations
- prevention_signal: Cross-check every plot against BDA Master Plan zone designation before
  any payment; confirm permitted uses match buyer's stated purpose in writing
- historical_dispute_rate: 1.0

---

## 6. Scraper Modules — Specification

Each scraper module must implement this interface:

```javascript
// All scrapers export this shape
module.exports = {
  name: 'rccms',           // source identifier
  scrape: async (params) => {
    // params: { district, tahasil, dateFrom, dateTo, caseType }
    // returns: Array of raw case objects
  },
  transform: (rawCase) => {
    // converts raw scrape output to pid_cases row shape
    // returns: object matching pid_cases schema (without id, scraped_at)
  }
};
```

### RCCMS Scraper (rccms_scraper.js)
- Search by: district + date range + case type
- Case types to capture: all revenue court case types (OLR, mutation disputes, title disputes)
- Extract per case: case_number, district, tahasil, plot_number, khatiyan, petitioner_raw,
  respondent_raw, case_type, filing_date, status, last_hearing_date, order_pdf_url
- If order PDF is available, download to S3 / store URL in order_pdf_url
- Rate: 1 request per 1.5s, sequential
- Failure handling: log to error table, continue; never crash the loop

### eCourts Scraper (ecourts_scraper.js)
- Search by: district court name + party name OR case type (OS, CS, IA — property-related)
- Extract per case: CNR number, case title, petitioner, respondent, filing_date,
  next_hearing, disposal_date, acts_sections, order_pdf_urls
- Note: eCourts has both free HTTP access and a paid API (₹200 free credit).
  Use free HTTP access first; fall back to API if rate-limited.
- Rate: 1 request per 2s (eCourts is sensitive to automated access)

### IGR Scraper (igr_scraper.js)
- Search by: owner name + district + date range
- Extract per document: document_number, document_type (all types, not just sale deeds),
  parties, consideration_raw, registration_date, plot_reference, SRO_code
- Document types to capture: sale deed, mortgage deed, PoA, Will, partition deed,
  gift deed, agreement to sell
- Rate: 1 request per 1.5s

### Bhulekh Scraper (bhulekh_scraper.js)
- **CRITICAL:** This module MUST wrap the existing fetcher. Do not re-implement
  the Bhulekh fetcher. Import it from wherever it lives in the main app.
- Additional fields needed for PID (that may not be in the existing fetcher output):
  - Kisam (land classification code + raw string)
  - Back Page encumbrance entries
  - OLR Section 7-A notation
  - Survey date
  - Ceiling/vesting remarks on Back Page
- If the existing fetcher already extracts these, use them directly.
  If not, add extraction only — do not modify the fetcher's core logic.

### CERSAI Scraper (cersai_scraper.js)
- Search by: owner name + property state (Odisha)
- Extract per charge: secured_creditor, principal_amount_raw, charge_date,
  satisfaction_date (null if active), property_description_raw
- Active charge = satisfaction_date IS NULL
- Rate: 1 request per 2s (CERSAI may require session handling)

---

## 7. NLP Extraction Pipeline

### The pipeline (extraction_pipeline.js)

```
Input: pid_cases row with order_pdf_url or order_text_raw
Step 1: Extract text from PDF (if not already extracted)
         → Use pdfplumber first; fall back to Tesseract for scanned PDFs
Step 2: Send to Claude API with the extraction prompt
Step 3: Parse structured response
Step 4: If confidence >= threshold: mark approved, link to patterns
         If confidence < threshold: queue for human review
Step 5: Update pid_cases row with extraction results
Step 6: Increment case_library_count on matched patterns
Step 7: Recompute confidence_tier on matched patterns
```

### Extraction prompt (in prompt_templates.js)

The prompt must be centralised in `prompt_templates.js` — never inline in pipeline code.
This way prompts can be improved without touching pipeline logic.

```javascript
// prompt_templates.js
exports.CASE_EXTRACTION_PROMPT = `
You are extracting structured information from an Indian land court order.
The document may be in English, Odia, or a mix of both.

Extract the following fields. If a field is not present or unclear, use null.
Respond ONLY with a valid JSON object. No preamble, no markdown, no explanation.

{
  "dispute_type": "<one of: title_defect | partition | encumbrance | boundary | classification | regulatory | fraud | other>",
  "root_cause_category": "<one of: A | B | C | D | E | null>",
  "plot_features_mentioned": [<list of observable plot/seller features described in the order>],
  "legal_provisions_cited": [<list of Act names and section numbers>],
  "outcome": "<one of: plaintiff_wins | defendant_wins | settled | ongoing | dismissed | null>",
  "key_finding": "<one sentence: what was the core finding or order>",
  "confidence": <float 0.0 to 1.0 — how confident you are in this extraction>
}

Category codes:
A = Title & Ownership Defect
B = Government Land & Classification Fraud
C = Encumbrance & Financial Fraud
D = Physical & Spatial Fraud
E = Regulatory & Approval Fraud

Order text:
{{ORDER_TEXT}}
`;
```

### Confidence scoring rules
- confidence >= 0.7: auto-approve, write to pid_cases, queue for pattern linking
- confidence 0.5-0.69: flag as 'needs_review' in pid_nlp_queue
- confidence < 0.5: mark 'failed', preserve order_text_raw for manual review

### Human review queue (review_queue.js)
- CLI command: `node cli/review_extractions.js`
- Shows items with review_status = 'needs_review', one at a time
- Shows: case_id, extracted fields, order text snippet, confidence score
- Reviewer can: approve (with optional corrections), reject, or mark for re-extraction
- All review decisions logged with reviewer ID and timestamp

---

## 8. Entity Resolution

### Name normalisation (normaliser.js)
Input: raw name string (may be in English or Odia)
Steps:
1. Strip honorifics: Sri, Smt, Shri, Mr, Mrs, Dr, Late (case-insensitive)
2. Strip punctuation: periods, commas, hyphens used as separators
3. Normalise whitespace: collapse multiple spaces to single
4. For English names: lowercase, then title-case
5. For Odia script: strip only whitespace and punctuation; do NOT transliterate
6. Return normalised string as `name_key`

**Do not transliterate Odia to English at this stage.** Name matching across
sources that use the same script should use Jaro-Winkler on the normalised string.
Cross-script matching is deferred.

### PAN anchor (pan_anchor.js)
- If IGR document contains a PAN number for a party, use PAN as `entity_key`
- Link all name variants that appear with the same PAN → same entity record
- PAN is the most reliable deduplication key; use it whenever available

### Co-occurrence graph (graph_builder.js)
- Nodes: entities (entity_key)
- Edges: co-occurrence in the same transaction across any source
- Edge weight: number of co-occurrences
- Graph is stored in Supabase as an adjacency list (not a graph DB — keep it simple)
- A cluster of ≥3 entities with ≥5 mutual edges is a candidate aggregator network

### Aggregator Pattern Score (aggregator_scorer.js)
Computed only for entities where aps_portfolio_size >= APS_MIN_PORTFOLIO_SIZE (default 5).

```
APS = weighted sum of:
  portfolio_size_score  (0-25): log scale, 5 properties = 5, 20+ = 25
  hold_period_score     (0-25): avg hold < 18 months = 25, > 36 months = 0
  district_spread_score (0-25): 1 district = 0, 3+ districts = 25
  litigation_rate_score (0-25): % of properties with RCCMS/eCourts case
```

APS >= 60 → entity is flagged in pid_entities, triggers C-04 pattern signal

---

## 9. Pattern Matching Engine

### Engine interface (engine.js)

```javascript
// Input: structured plot attributes
// Output: array of matches, sorted by score descending
async function matchPatterns(plotAttributes) {
  // plotAttributes shape:
  // {
  //   unique_plot_id: string,
  //   kisam_raw: string,
  //   owner_count: number,
  //   has_share_fractions: boolean,
  //   mutation_count: number,
  //   last_mutation_date: string,
  //   active_rccms_cases: array,
  //   active_ecourts_cases: array,
  //   cersai_charges: array,
  //   seller_entity_key: string,
  //   seller_aps: number | null,
  //   bda_zone: string | null,
  //   // ... all extractable attributes
  // }
  //
  // Returns: [
  //   {
  //     pattern_id: string,
  //     pattern_name: string,
  //     match_score: float,       // 0.0 to 1.0
  //     matched_features: array,  // which features triggered
  //     missing_features: array,  // which features were absent
  //     confidence_tier: string,
  //     historical_dispute_rate: float | null,
  //     prevention_signal: string,
  //     is_showstopper: boolean,  // match_score > 0.8 AND tier VALIDATED
  //   }
  // ]
}
```

### Scoring logic
```
For each active pattern in pid_patterns:
  matched = features that are present in plotAttributes
  match_score = matched.length / pattern.features.length

  Apply feature weights if defined (default weight = 1):
  weighted_score = sum(matched_weights) / sum(all_weights)

  If weighted_score >= MATCH_COMMENTARY_THRESHOLD (0.6):
    include in results

  If weighted_score >= MATCH_SHOWSTOPPER_THRESHOLD (0.8)
     AND confidence_tier = 'VALIDATED':
    is_showstopper = TRUE
```

### Commentary generation (commentary_generator.js)
- Only called when a match is above threshold
- Input: pattern record + matched_features + plotAttributes
- Prompt must be in prompt_templates.js
- Output: 2-3 sentence narrative connecting matched features to causal mechanism
- Must always include: (a) the matched feature count, (b) historical rate with tier qualifier,
  (c) prevention signal
- Must never: name a place as the risk signal; use the word "fraudulent" without qualifier;
  claim certainty ("this plot is..." vs "this plot matches features of...")

---

## 10. Sample Validation Gate

> ⚠️ This gate is mandatory before running any bulk scrape.
> The scraper infrastructure must be tested on 5-8 known cases before bulk execution.

### Step 1 — Select test cases
Before running any scraper at scale, identify 5-8 RCCMS cases in Khordha with:
- Known outcomes (from public court records)
- A mix of case types (at least 3 different categories)
- At least 1 case with an available order PDF

Record case numbers here in PID_TRACK.md before proceeding.

### Step 2 — Run single-case mode
Each scraper must support a `--case-id` or `--test-mode` flag that runs a single case
and prints the structured output without writing to the database.

```bash
node cli/run_scraper.js --source rccms --test-mode --case-id CASE123
```

### Step 3 — Validate output manually
For each test case, manually verify:
```
□ case_source correctly identified
□ district and tahasil correctly extracted
□ petitioner_raw and respondent_raw match the actual parties
□ case_type correctly classified
□ order_pdf_url resolves to the correct document (if available)
□ No fields that should have content are empty
□ No fields are hallucinated (invented by the scraper)
```

### Step 4 — Run NLP on test cases
Run extraction on the 5-8 test cases through the NLP pipeline.
Manually compare extraction output against order text.

```
□ dispute_type correctly identified
□ root_cause_category correctly assigned
□ plot_features_mentioned are actually mentioned in the text
□ legal_provisions_cited are correct
□ confidence score is reasonable (high for clear orders, low for ambiguous)
```

### Step 5 — Pass criteria
All 5-8 test cases must pass all checklist items.
If any fail: fix the relevant scraper or NLP prompt, re-run, re-validate.
**Do not proceed to bulk scrape until all test cases pass.**

Record outcome in PID_TRACK.md before proceeding.

---

## 11. CLI Commands Reference

All CLIs must print `--help` when called without arguments.

```bash
# Load seed patterns into database
node cli/load_seed.js

# Run a scraper (district from config.js by default)
node cli/run_scraper.js --source rccms
node cli/run_scraper.js --source ecourts
node cli/run_scraper.js --source igr
node cli/run_scraper.js --source cersai
node cli/run_scraper.js --source rccms --district Cuttack
# (district override; config.js DISTRICT_SCOPE is default)

# Test mode — single case, no DB write
node cli/run_scraper.js --source rccms --test-mode --case-id CASE123

# Run NLP extraction batch
node cli/run_nlp_batch.js --count 50
# Processes 50 items from NLP queue

# Review low-confidence extractions
node cli/review_extractions.js

# Recompute pattern rates from case library
node cli/update_pattern_rates.js

# Test pattern matching on a plot
node cli/test_match.js --plot-id PLOTID123
node cli/test_match.js --attributes '{"kisam_raw":"Anabadi","owner_count":2}'
# prints match results without logging to pid_match_log
```

---

## 12. Environment Variables

```
# Supabase (same instance as main app)
SUPABASE_URL=
SUPABASE_SERVICE_KEY=       # service role — NOT anon key

# Claude API (for NLP extraction and commentary)
ANTHROPIC_API_KEY=

# Scraping config (all have defaults in config.js)
PID_DISTRICT_SCOPE=Khordha
PID_SCRAPE_DELAY_MS=1500
PID_NLP_BATCH_SIZE=10
PID_NLP_CONFIDENCE_THRESHOLD=0.7
```

---

## 13. Guard Rails — Read Before Every Session

1. **Do not touch `/app`.** The Next.js product is off-limits for this build.
2. **Do not rewrite the existing Bhulekh fetcher.** Wrap it. Never modify it.
3. **Do not start Phase 2 (Cuttack, Puri, Ganjam, Sambalpur) until Phase 1 passes
   the sample validation gate and produces ≥15 validated cases for at least 3 patterns.**
4. **Do not render patterns with confidence_tier = 'STUB' anywhere.** Not in tests,
   not in CLI output presented as real data. STUB is internal only.
5. **Do not hardcode district names, thresholds, or delay values.** Everything goes
   through config.js.
6. **All prompts go in prompt_templates.js.** Never inline LLM prompts in pipeline code.
7. **Every failure is logged, not swallowed.** No silent catch blocks. Failed scrapes
   and failed extractions are written to the database with error_message populated.
8. **No new npm packages without checking what's already in the repo.**
9. **One stage at a time.** Complete and validate each stage before starting the next.
10. **Update PID_TRACK.md after every milestone.** This is not optional.

---

## 14. Milestones (copy these to PID_TRACK.md)

| # | Milestone | Status |
|---|---|---|
| P-001 | Schema migrations run (all 5) | PENDING |
| P-002 | Seed patterns loaded (15 patterns, all STUB tier) | PENDING |
| P-003 | RCCMS scraper: test mode passes on 5 known cases | PENDING |
| P-004 | eCourts scraper: test mode passes on 5 known cases | PENDING |
| P-005 | IGR scraper: test mode passes on 5 known cases | PENDING |
| P-006 | NLP pipeline: test extraction passes on 5 order PDFs | PENDING |
| P-007 | Sample validation gate passed (Section 10) | PENDING |
| P-008 | RCCMS bulk scrape: Khordha 2015–2025 complete | PENDING |
| P-009 | eCourts bulk scrape: Khordha civil suits complete | PENDING |
| P-010 | NLP bulk extraction: first 500 cases processed | PENDING |
| P-011 | Human review queue: first 50 cases reviewed | PENDING |
| P-012 | First pattern rate recomputation: ≥3 patterns promoted from STUB | PENDING |
| P-013 | Pattern matching engine: test_match CLI working | PENDING |
| P-014 | IGR bulk scrape: Khordha 2010–2025 complete | PENDING |
| P-015 | Entity resolution: aggregator scorer running | PENDING |
| P-016 | First report integration test: 10 test plots matched | PENDING |
| P-017 | Phase 1 complete: ≥15 validated cases for ≥3 patterns | PENDING |
| P-018 | Phase 2 start: Cuttack scrape begins | PENDING |

---

*Created: 2026-05-25. This document is the instruction set for the PID build.
Update PID_TRACK.md (not this file) as work progresses.
This file changes only when the build plan changes — not when tasks complete.*
