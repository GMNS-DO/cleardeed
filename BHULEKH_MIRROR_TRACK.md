# BHULEKH_MIRROR_TRACK.md — ClearDeed Data Mirror Tracking & Handoff Doc

> **Purpose:** This file is the single source of truth for the Bhulekh ROR mirror build.
> It tracks every decision made, every milestone reached, every sample validated, and every
> blocker encountered. If this session hits a context limit, paste this file into the next
> Codex session as the first message. The next session picks up exactly where this one left off.
>
> **Update rule:** Every time a stage completes, a sample is validated, or a decision is made —
> update the relevant section immediately. Do not batch updates.
>
> **Companion files in repo:**
> - `CLAUDE.md` — engineering constitution (do not deviate)
> - `DECISIONS.md` — product decisions log
> - `CURRENT_FOCUS.md` — active sprint focus
> - `ROADMAP.md` — sprint and PI plan

---

## 1. What This Build Is

A structured data mirror of Bhulekh ROR (Record of Rights) records for 5 priority Odisha
districts: **Khordha first, then Cuttack, Puri, Ganjam, Sambalpur.**

It is a **separate background system** — a `/crawl` directory in the repo, running on Railway,
writing to the existing Supabase database. It does **not touch** the Next.js app, the existing
Bhulekh fetcher logic, or the report generation pipeline.

### Why it exists
The live fetcher works for one known plot on demand. It cannot:
- Return a free preview instantly (15s live fetch is too slow)
- Surface "seller's other properties" without a multi-minute crawl
- Detect ownership changes between a buyer's query and their payment

The mirror solves all three.

### What it stores
Every field from ROR front page + back page, **raw Odia strings exactly as they appear —
no translation, no transliteration, no normalisation** (except whitespace stripping for
change-detection hashing and owner name key generation only).

---

## 2. Architecture Decision Log

| # | Decision | Reasoning | Date |
|---|---|---|---|
| A-001 | Store all ROR fields as raw Odia strings | Translation layer comes later at product integration time | 2026-05-25 |
| A-002 | Use combination-walking approach for enumeration | More robust than relying on portal dropdown enumerability; uses already-stored district/tahasil/village lists | 2026-05-25 |
| A-003 | 3-worker concurrent fetcher for bulk crawl, 1-2s delay per worker | ~3x faster than sequential; safe for NIC portal traffic levels | 2026-05-25 |
| A-004 | Railway container for crawl process, not Vercel or GitHub Actions | Vercel: 300s timeout limit. GitHub Actions: 6hr job limit + 2000 min/month. Khordha alone ~42hrs. Railway $5/month persistent container is correct | 2026-05-25 |
| A-005 | Supabase (existing DB) for all mirror tables | No new infrastructure. Same DB, new tables, service role key for bulk writes | 2026-05-25 |
| A-006 | Layer 2 derived tables deferred to Sprint 4 | No user-visible behaviour needs them before Sprint 4 "seller's other properties" section. Per CLAUDE.md §3 rule 4: no abstractions on first pass | 2026-05-25 |
| A-007 | Tenant name search is enrichment pass, not part of bulk crawl | Tenant search is fuzzy/reverse lookup — not enumerable. Runs after mirror is built, using owner_name_raw values already extracted | 2026-05-25 |
| A-008 | owner_name_key field alongside owner_name_raw | Raw Odia owner strings cannot be reliably deduplicated for cross-plot lookup without a stripped key. Key = whitespace + punctuation stripped only, still Odia | 2026-05-25 |
| A-009 | Claude API for change_type classification on hash mismatch | Solves "you know something changed but not why" gap. Small JSONB payload, cheap inference. Returns: ownership / mutation / area / kisam / unknown | 2026-05-25 |
| A-010 | high_priority_recheck table written by Vercel, read by Railway | Paid report generation triggers immediate re-fetch of that plot. Ensures report is never built on stale data without the buyer knowing | 2026-05-25 |
| A-011 | Sample validation gate: 8-10 plots must pass before bulk proceeds | Catches parser errors, encoding issues, field mapping mistakes before they corrupt 75,000 rows | 2026-05-25 |
| A-012 | Khordha only for first crawl, 5 districts at PI 2 | Per STRATEGY.md and ROADMAP.md geography sequencing discipline | 2026-05-25 |

---

## 3. File & Repo Structure

```
/crawl/                         ← new directory, separate from /app
  stage0_generate.js            ← one-time: generates combination list from stored village data
  stage1_ri_discovery.js        ← discovers RI circles per village combination
  stage2_khatiyan_enum.js       ← enumerates Khatiyan + Plot numbers per RI circle
  stage3_ror_fetch.js           ← bulk ROR fetcher (wraps existing fetcher, 3 workers)
  stage4_tenant_search.js       ← cross-ownership enrichment pass
  change_detector.js            ← continuous change detection loop (cron on Railway)
  lib/
    supabase_client.js          ← service role Supabase client for bulk writes
    hasher.js                   ← SHA-256 content hash computation
    rate_limiter.js             ← request delay + exponential backoff
    change_classifier.js        ← Claude API call for change_type on hash mismatch
  config.js                     ← WORKER_COUNT, DELAY_MS, DISTRICTS scope
  README.md                     ← how to run each stage

/app/                           ← UNTOUCHED. Next.js product. Vercel only.
```

**One addition to existing app code only:**
After a paid report is generated, write to `high_priority_recheck` table.
Location: wherever `report_status` is set to `completed` in the existing pipeline.
One INSERT. Nothing else changes.

---

## 4. Database Schema

All tables in existing Supabase instance. Run migrations in this order.

### Migration 1 — plot_enumeration_index
```sql
CREATE TABLE plot_enumeration_index (
  id                    BIGSERIAL PRIMARY KEY,
  district_code         TEXT NOT NULL,
  district_name_raw     TEXT,
  tahasil_code          TEXT NOT NULL,
  tahasil_name_raw      TEXT,
  village_code          TEXT NOT NULL,
  village_name_raw      TEXT,
  ri_circle_code        TEXT,
  ri_circle_name_raw    TEXT,
  khatiyan_number       TEXT,
  plot_number           TEXT,
  unique_plot_id        TEXT,
  status                TEXT DEFAULT 'pending_ri_discovery',
  -- Status flow:
  -- pending_ri_discovery → pending_khatiyan_discovery → pending_fetch → mirrored | failed
  error_message         TEXT,
  attempt_count         INTEGER DEFAULT 0,
  last_attempted_at     TIMESTAMPTZ,
  created_at            TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_enumeration_status
  ON plot_enumeration_index(status);
CREATE INDEX idx_enumeration_location
  ON plot_enumeration_index(district_code, tahasil_code, village_code);
```

### Migration 2 — plot_ror_mirror
```sql
CREATE TABLE plot_ror_mirror (
  unique_plot_id          TEXT PRIMARY KEY,

  -- Location (raw Odia)
  district_code           TEXT,
  district_name_raw       TEXT,
  tahasil_code            TEXT,
  tahasil_name_raw        TEXT,
  village_code            TEXT,
  village_name_raw        TEXT,
  ri_circle_code          TEXT,
  ri_circle_name_raw      TEXT,

  -- Plot identifiers
  khatiyan_number         TEXT,
  plot_number             TEXT,

  -- Land classification (raw Odia, do not translate)
  kisam_raw               TEXT,
  sub_kisam_raw           TEXT,

  -- Area (raw Odia strings, do not parse to float)
  total_area_raw          TEXT,
  chak_wise_area_raw      JSONB,   -- [{chak: "...", area: "..."}, ...] all raw Odia

  -- Ownership (raw Odia arrays)
  tenant_names_raw        JSONB,   -- ["ନାମ ୧", "ନାମ ୨"]
  tenant_shares_raw       JSONB,   -- ["୧/୨", "୧/୨"]
  tenant_father_names_raw JSONB,
  tenant_addresses_raw    JSONB,
  owner_name_keys         JSONB,   -- whitespace+punct stripped Odia, for matching only

  -- Revenue (raw)
  annual_revenue_raw      TEXT,
  land_revenue_status_raw TEXT,

  -- Mutation history (raw Odia, back page)
  mutation_entries_raw    JSONB,
  -- [{no: "...", date: "...", nature: "...", parties: "..."}, ...]
  mutation_count          INTEGER, -- derived: array length only
  last_mutation_date_raw  TEXT,

  -- Encumbrance (raw)
  satwa_status_raw        TEXT,
  encumbrance_notes_raw   TEXT,

  -- Change detection
  content_hash            TEXT,    -- SHA-256 of whitespace-stripped raw field concat
  previous_hash           TEXT,
  change_count            INTEGER DEFAULT 0,
  last_fetched_at         TIMESTAMPTZ,
  last_changed_at         TIMESTAMPTZ,

  -- Scrape metadata
  scrape_status           TEXT,    -- 'success' | 'partial' | 'failed'
  scrape_error            TEXT,
  ror_front_fetched_at    TIMESTAMPTZ,
  ror_back_fetched_at     TIMESTAMPTZ,
  created_at              TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_mirror_last_fetched ON plot_ror_mirror(last_fetched_at);
CREATE INDEX idx_mirror_tahasil ON plot_ror_mirror(tahasil_code);
CREATE INDEX idx_mirror_district ON plot_ror_mirror(district_code);
```

### Migration 3 — plot_ror_history
```sql
CREATE TABLE plot_ror_history (
  id                BIGSERIAL PRIMARY KEY,
  unique_plot_id    TEXT NOT NULL,
  snapshot          JSONB NOT NULL,  -- full plot_ror_mirror row at time of change
  content_hash      TEXT,
  previous_hash     TEXT,
  change_type       TEXT,
  -- 'ownership' | 'mutation' | 'area' | 'kisam' | 'unknown'
  detected_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_history_plot ON plot_ror_history(unique_plot_id, detected_at DESC);
```

### Migration 4 — owner_plot_index
```sql
CREATE TABLE owner_plot_index (
  id                BIGSERIAL PRIMARY KEY,
  owner_name_raw    TEXT,        -- raw Odia as extracted, never modified
  owner_name_key    TEXT,        -- whitespace+punct stripped Odia, for matching
  district_code     TEXT,
  tahasil_code      TEXT,
  unique_plot_id    TEXT,
  khatiyan_number   TEXT,
  plot_number       TEXT,
  share_raw         TEXT,        -- raw Odia fraction string
  source            TEXT,        -- 'ror_mirror' | 'tenant_search'
  indexed_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_owner_key ON owner_plot_index(owner_name_key, district_code);
CREATE INDEX idx_owner_plot ON owner_plot_index(unique_plot_id);
```

### Migration 5 — high_priority_recheck
```sql
CREATE TABLE high_priority_recheck (
  id                BIGSERIAL PRIMARY KEY,
  unique_plot_id    TEXT NOT NULL,
  triggered_by      TEXT,        -- 'paid_report' | 'free_preview'
  triggered_at      TIMESTAMPTZ DEFAULT NOW(),
  processed_at      TIMESTAMPTZ,
  status            TEXT DEFAULT 'pending'  -- 'pending' | 'done' | 'failed'
);

CREATE INDEX idx_priority_status ON high_priority_recheck(status, triggered_at);
```

---

## 5. Crawl Pipeline — Stage by Stage

### Stage 0 — Generate Combination List
**Script:** `stage0_generate.js`
**Run:** Once, manually, before anything else
**Input:** Existing stored district/tahasil/village data for Khordha
**Output:** Rows in `plot_enumeration_index` with `status = 'pending_ri_discovery'`
**Expected row count:** ~500 for Khordha
**Done when:** Row count matches known Khordha village count. Verify manually.

---

### Stage 1 — RI Circle Discovery
**Script:** `stage1_ri_discovery.js`
**Run:** After Stage 0 completes
**Input:** Rows where `status = 'pending_ri_discovery'`
**Action:** Submit (district, tahasil, village) to portal → record RI circles returned
**Output:** Rows expanded with ri_circle fields, `status = 'pending_khatiyan_discovery'`
**Rate:** 1 worker, 1.5s delay (lightweight)
**Done when:** No rows remain at `pending_ri_discovery`

---

### Stage 2 — Khatiyan + Plot Enumeration
**Script:** `stage2_khatiyan_enum.js`
**Run:** After Stage 1 completes
**Input:** Rows where `status = 'pending_khatiyan_discovery'`
**Action:** Submit (district, tahasil, village, ri_circle) → record all Khatiyan + Plot numbers
**Output:** Rows expanded to individual plots, `status = 'pending_fetch'`
**Expected row count:** ~75,000 for Khordha
**Done when:** No rows remain at `pending_khatiyan_discovery`

---

### Stage 3 — Bulk ROR Fetch
**Script:** `stage3_ror_fetch.js`
**Run:** After Stage 2. This is the long-running stage (~14-16 hours for Khordha).
**Input:** Rows where `status = 'pending_fetch'`
**Action:**
  - Fetch ROR front page → extract all raw fields → store as-is
  - Fetch ROR back page → extract mutation entries → store as-is
  - Compute content_hash (SHA-256 of whitespace-stripped raw field values concatenated)
  - Write to `plot_ror_mirror`
  - Update enumeration row → `status = 'mirrored'` or `'failed'`
**Rate:** 3 concurrent workers, 1s delay per worker
**Resumable:** Yes — restarts from `status = 'pending_fetch'` rows
**Done when:** No rows remain at `pending_fetch`. Check failed count.

---

### Stage 4 — Tenant Cross-Search Enrichment
**Script:** `stage4_tenant_search.js`
**Run:** After Stage 3 completes
**Input:** Unique `owner_name_raw` values from `plot_ror_mirror`
**Action:**
  - Compute `owner_name_key` (strip whitespace + punctuation, keep Odia)
  - Run tenant name search on Bhulekh for each unique key per tahasil
  - Write linkages to `owner_plot_index`
  - Deduplicate by (owner_name_key, unique_plot_id)
**Rate:** 1 worker, 2s delay (search endpoint, be conservative)
**Done when:** All unique owner_name_keys processed

---

### Change Detector (Continuous)
**Script:** `change_detector.js`
**Run:** Always-on cron on Railway, every N hours (configurable)
**Order of operations each run:**
  1. Process all `high_priority_recheck` rows with `status = 'pending'` first
  2. Then sweep `plot_ror_mirror` ordered by `last_fetched_at ASC` (oldest first)
  3. For each: re-fetch, recompute hash, compare
  4. On mismatch:
     - Copy current row to `plot_ror_history` as JSONB snapshot
     - Call Claude API → get change_type
     - Update `plot_ror_mirror` with new values, new hash, increment change_count
  5. Mark `high_priority_recheck` row as `done`
**Rate:** 1 worker, 1.5s delay

---

## 6. Sample Validation Gate

> ⚠️ **This gate is mandatory. Stage 3 bulk fetch does not proceed until this passes.**

After Stage 2 enumeration is complete, before running Stage 3 at full scale:

**Step 1 — Pick 8-10 sample plots manually**
Select from `plot_enumeration_index` where status = 'pending_fetch':
- At least 2 different tahasils within Khordha
- At least 1 plot with known multiple owners (if identifiable)
- At least 1 plot with known mutation history (if identifiable)
- Mix of agricultural and non-agricultural kisam if possible

Record the sample plot_ids here:
```
Sample set:
  1. unique_plot_id: _____________ tahasil: _____________
  2. unique_plot_id: _____________ tahasil: _____________
  3. unique_plot_id: _____________ tahasil: _____________
  4. unique_plot_id: _____________ tahasil: _____________
  5. unique_plot_id: _____________ tahasil: _____________
  6. unique_plot_id: _____________ tahasil: _____________
  7. unique_plot_id: _____________ tahasil: _____________
  8. unique_plot_id: _____________ tahasil: _____________
  9. unique_plot_id: _____________ tahasil: _____________
  10. unique_plot_id: _____________ tahasil: _____________
```

**Step 2 — Run Stage 3 on sample only**
Add a `--sample-only` flag to stage3_ror_fetch.js that accepts a list of plot_ids.
Run it. Check output in plot_ror_mirror.

**Step 3 — Manually validate each sample output against the live Bhulekh portal**
For each sample plot, open the actual Bhulekh page and compare field by field.

Validation checklist per plot:
```
□ unique_plot_id matches portal
□ khatiyan_number matches portal
□ plot_number matches portal
□ kisam_raw matches portal (Odia string, exact)
□ total_area_raw matches portal (Odia string, exact)
□ tenant_names_raw — correct count, correct Odia strings
□ tenant_shares_raw — correct fractions
□ tenant_father_names_raw — present and correct
□ mutation_count matches number of entries on back page
□ mutation_entries_raw — at least first and last entry correct
□ content_hash present and non-null
□ ror_front_fetched_at and ror_back_fetched_at both populated
□ scrape_status = 'success'
□ No fields that should have Odia content are empty or showing garbled encoding
```

**Step 4 — Pass criteria**
All 8-10 plots must pass all checklist items.
If any fail: fix the parser, re-run sample, re-validate. Do not proceed to bulk until clean.

**Step 5 — Record outcome here**
```
Sample validation status: PENDING / PASSED / FAILED
Date validated: ____________
Failures found: ____________
Fix applied: ____________
Re-validated: ____________
Approved to proceed to bulk: YES / NO
Approved by: ____________
```

---

## 7. Milestones & Status Tracker

| # | Milestone | Status | Date | Notes |
|---|---|---|---|---|
| M-001 | Schema migrations run on Supabase | PENDING | | All 5 migrations |
| M-002 | Railway container provisioned | PENDING | | ~$5/month, env vars set |
| M-003 | Stage 0 complete — combination list generated | PENDING | | Record row count |
| M-004 | Stage 1 complete — RI circles discovered | PENDING | | Record row count |
| M-005 | Stage 2 complete — Khatiyan/Plot enumeration | PENDING | | Record row count |
| M-006 | Sample set selected (8-10 plots) | PENDING | | Fill Section 6 |
| M-007 | Sample fetch run (Stage 3, sample-only mode) | PENDING | | |
| M-008 | Sample validation passed (all 8-10 clean) | PENDING | | Gate to bulk |
| M-009 | Stage 3 bulk fetch started | PENDING | | Record start time |
| M-010 | Stage 3 bulk fetch complete — Khordha | PENDING | | Record row count, failed count |
| M-011 | Stage 4 tenant enrichment complete | PENDING | | Record owner_plot_index row count |
| M-012 | Change detector deployed and running on Railway | PENDING | | |
| M-013 | high_priority_recheck write added to Vercel pipeline | PENDING | | One INSERT, nothing else |
| M-014 | Khordha mirror validated end-to-end | PENDING | | Spot check 20 random plots |
| M-015 | Cuttack enumeration started | PENDING | | PI 2 |
| M-016 | Puri enumeration started | PENDING | | PI 2 |
| M-017 | Ganjam enumeration started | PENDING | | PI 2 |
| M-018 | Sambalpur enumeration started | PENDING | | PI 2 |
| M-019 | All 5 districts mirrored | PENDING | | PI 2 complete |

---

## 8. Known Risks & Mitigations

| Risk | Likelihood | Mitigation |
|---|---|---|
| Portal HTML structure changes mid-crawl | Medium | Daily health check: scrape one known plot, diff against stored record, alert on mismatch |
| NIC rate limiting / IP block | Low-Medium | 3 workers max, 1s delay per worker, exponential backoff. If blocked: reduce to 1 worker, increase delay to 3s |
| Odia encoding inconsistency across villages | Medium | Store exactly as received. Do not normalise. Hash on whitespace-stripped raw. Encoding issues surface at translation layer, not here |
| Stage 3 dies mid-crawl | Expected | Fully resumable by design — restarts from pending_fetch rows |
| RI circle dropdown not enumerable | Low (mitigated by combination-walking approach) | Combination walking doesn't require dropdown enumerability — submits known location combos and records what comes back |
| Owner name deduplication false positives | Medium | owner_name_key is stripped Odia only — not romanised. Deduplication is conservative. False negatives (missed links) safer than false positives (wrong links) |

---

## 9. Codex Session Guard Rails

These rules apply to every Codex session working on this build.
They exist because the failure mode of Codex is confident execution on the wrong problem.

1. **Read this file first, before any code.** If your proposed work is not in a milestone above, stop and ask.
2. **Do not touch `/app`.** The Next.js product is off-limits. The only exception is the single INSERT to `high_priority_recheck` after report generation (M-013).
3. **Do not rewrite the existing Bhulekh fetcher.** Wrap it. Call it. Never modify it.
4. **Do not translate or normalise Odia strings.** Store exactly as received. The only allowed transformations are: (a) whitespace stripping for content_hash, (b) whitespace + punctuation stripping for owner_name_key.
5. **Do not proceed past M-008 without explicit human approval.** Sample validation is a human gate, not an automated check.
6. **Do not build Layer 2 derived tables.** owner_plot_index is the limit. plot_owners and query materialised views are deferred to Sprint 4.
7. **One stage at a time.** Complete and verify each stage before starting the next.
8. **Config lives in config.js, not hardcoded.** WORKER_COUNT, DELAY_MS, DISTRICT_SCOPE must be configurable without code changes.
9. **Every failure is logged, not swallowed.** No silent catches. Failed rows get error_message populated and status = 'failed'. The crawl continues past failures.
10. **No new npm packages without checking.** Use what's already in the repo where possible.

---

## 10. Environment Variables Required

### Railway (new)
```
SUPABASE_URL=                    # same as Vercel
SUPABASE_SERVICE_KEY=            # service role key — NOT the anon key
ANTHROPIC_API_KEY=               # for change_classifier.js (Claude API)
BHULEKH_DELAY_MS=1000            # configurable delay between requests
BHULEKH_WORKER_COUNT=3           # for bulk fetch; set to 1 for change detector
CRAWL_DISTRICT_SCOPE=Khordha     # comma-separated when expanding to 5 districts
```

### Vercel (addition only)
```
# No new variables needed — Supabase connection already present
# Only code change: one INSERT to high_priority_recheck after report generation
```

---

## 11. Handoff State (update before passing to next session)

```
Last updated: 2026-05-25
Last completed milestone: —
Currently in progress: —
Next action for Codex: Run schema migrations (M-001)
Blockers: None

Row counts (fill as stages complete):
  plot_enumeration_index after Stage 0: —
  plot_enumeration_index after Stage 1: —
  plot_enumeration_index after Stage 2 (= plot count): —
  plot_ror_mirror after Stage 3: —
  plot_ror_mirror failed rows: —
  owner_plot_index after Stage 4: —

Open questions:
  - Confirm existing fetcher file path in repo so Stage 3 wraps it correctly
  - Confirm Supabase service role key is accessible or needs to be generated

Notes for next session:
  —
```

---

*Created: 2026-05-25. Update this file after every milestone, every decision, every blocker.*
*Do not delete sections — add to them. This file is the memory of this build.*
