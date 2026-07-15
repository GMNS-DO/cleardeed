# Doc Consolidation + Status Index Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reduce time-to-orient for any reader (human or AI session) from "read 6+ files" to "read 1 pointer doc, then the 2-3 specific docs you need." Preserve all unique content. Do not break append-only history.

**Architecture:** Three pointer docs at the root — CLAUDE.md (engineering constitution, including all 27 ADRs in §5), PRODUCT.md (product vision), STATUS.md (operational index) — plus FEATURES.md (feature inventory). Sections 4, 6, 7, 8 of current CLAUDE.md move to STATUS.md, docs/sessions/, and PRODUCT.md. Two deleted docs (PRODUCT_SPEC.md, CURRENT_FOCUS.md) get redirect headers 24h before deletion. Six-PR migration preserves git history. Anchor stubs in CLAUDE.md are removed in PR 6 (no 30-day grace window — there are no external links to those anchors today).

**Tech Stack:** Markdown, git, ripgrep (for cross-reference checks).

---

## Global Constraints

- **Authority rule:** CLAUDE.md wins on engineering discipline. PRODUCT.md wins on product decisions. Every other doc defers to one of these two when there's a conflict.
- **Move, don't reformat.** When content moves between docs, the wording stays the same. Reformatting burns review time.
- **Add redirect headers before deleting.** Every deleted or scope-narrowed doc gets a one-paragraph header pointing to its replacement.
- **Anchor stubs removed in PR 6 (no grace window).** External bookmarks to `CLAUDE.md#section-4` are not in use today — all cross-references are internal `.md` links that PR 6 will update. PR 6 immediately replaces each stub with a single-line pointer.
- **Six PRs in sequence, never in parallel.** Each PR builds on the previous one's output.
- **Branch naming:** All PRs land on the current working branch `feat/source-reliability-and-pid-foundation`. No new branches.
- **Commit message style:** Match existing `docs(...): ...` and `chore(...): ...` style. Co-author line preserved.
- **No live deploys.** This is docs only — no Vercel, no Supabase, no env-var changes.
- **Status pill legend (consistent across STATUS.md and FEATURES.md):** LIVE = in production code · PARTIAL = in code, not fully validated · PROBED = explored and documented · DORMANT = code exists, V1.1 dormant · PLACEHOLDER = stub returns manual_required · BLOCKED = external gate · PLANNED = scheduled · IN PROGRESS = actively worked · THEORETICAL = defined, not started · DEFERRED = V2+

---

## File Structure

### Files this plan creates
- `STATUS.md` — operational index (sprint, fetcher/agent/task tables, risks, recent shipped, next action)
- `FEATURES.md` — feature inventory with status pills across 13 sections
- `docs/sessions/2026-06.md` — current month session log (June 2026)
- `docs/ship-logs/V5B_SHIP_SUMMARY_2026-06-15.md` — archived one-off ship log
- `docs/decisions/.gitkeep` — empty-marker note explaining ADRs canonical location
- `PR-CHECKLIST.md` (transient, in repo root, deleted at end of PR 6) — running checklist used during migration

### Files this plan modifies
- `CLAUDE.md` (4,265 → ~800 lines) — keep §1-3, §5; move §4, §6, §7, §8 out
- `PRODUCT.md` (427 → ~520 lines) — absorb CLAUDE.md §8 (Theoretical Ceiling)
- `COUNCIL.md` — add scope-narrowing header
- `STRATEGY.md` — fix one-line contradiction (PRODUCT_SPEC → PRODUCT.md)
- `ROADMAP.md` — add one-line pointer to STATUS.md
- `BACKLOG.md` — add one-line pointer to STATUS.md
- `DECISIONS.md` — add scope-narrowing header
- `CLEARDEED_FINAL_CEILING.md` — add redirect header (content moves to PRODUCT.md)
- `README.md` — add one-line pointer to STATUS.md
- `COMPLYRADAR_0_TO_1_MASTER_STRATEGY.md`, `COMPLYRADAR_PRODUCT_STRATEGY.md`, `COMPLYRADAR_0_TO_1_MASTER_STRATEGY.md` (3 of 4 COMPLYRADAR files) — add scope-narrowing headers
- `KHORDHA_30_DAY_LAUNCH_PLAN_2026-06-16.md` — keep, no edit

### Files this plan deletes
- `PRODUCT_SPEC.md` — superseded by PRODUCT.md (after 24h redirect live)
- `CURRENT_FOCUS.md` — content moves to STATUS.md (after 24h redirect live)
- `claude.md` (lowercase, untracked) — investigation per PR 1
- `bhulekh insights master.md` (untracked) — investigation per PR 1
- `odisha property app pipeline.md` (untracked) — investigation per PR 1

### Files this plan does NOT touch
- `apps/`, `agents/`, `packages/`, `workers/`, `infra/`, `qa/`, `legal/` — out of scope
- `docs/sources/*.md` (11 files) — already referenced, no change
- `docs/validation/`, `docs/scoring/`, `docs/compliance/`, `docs/metrics/`, `docs/ops/`, `docs/sub-agent-briefs/`, `docs/shared/`, `docs/superpowers/` — out of scope
- `FRAUD_PATTERNS.md`, `CUSTOMER_DEVELOPMENT.md`, `CLEARDEED-EXECUTIVE-BRIEF-README.md`, `ClearDeed-Executive-Brief.docx`, `Build-docx.js` — keep, no edit

---

## Task 1: PR 1 — Add STATUS.md and FEATURES.md (new files only)

**Files:**
- Create: `STATUS.md`
- Create: `FEATURES.md`
- Create: `PR-CHECKLIST.md` (transient)
- Test: visual inspection + ripgrep for required sections

**Interfaces:**
- Consumes: current CLAUDE.md §4 (tasks), §6 (state snapshot), §7 (recent session entries)
- Produces: two new root-level pointer docs. No edits to existing files in this PR.

- [ ] **Step 1: Create `PR-CHECKLIST.md` at repo root**

Content:
```markdown
# Doc Consolidation PR Checklist (transient)

- [ ] PR 1: STATUS.md + FEATURES.md created (no other edits)
- [ ] PR 2: Redirect headers added to PRODUCT_SPEC, CURRENT_FOCUS, STRATEGY, COUNCIL, ROADMAP, BACKLOG, DECISIONS, CLEARDEED_FINAL_CEILING
- [ ] PR 3: CLAUDE.md §4, §6, §7, §8 moved out
- [ ] PR 4: CLAUDE.md slimmed to constitution + decisions only
- [ ] PR 5: PRODUCT_SPEC.md + CURRENT_FOCUS.md deleted (24h after PR 2)
- [ ] PR 6: Audit pass — broken links fixed, anchor stubs removed

Delete this file at end of PR 6.
```

- [ ] **Step 2: Create `STATUS.md` at repo root**

The file MUST contain these 10 sections in this order, each marked with a comment block describing its source:

```markdown
# STATUS.md — ClearDeed Operational Index

> **Refresh cadence:** Sprint focus, risks, and next action update by end of every working session. Fetcher/agent tables regenerate when packages change. Tasks table is append-only (existing rows never deleted). Recent shipped is rolling 5.
>
> **Authority:** CLAUDE.md wins on engineering, PRODUCT.md wins on product. STATUS.md is the operational index, not a competing source of truth.
>
> **Status pills:** LIVE · PARTIAL · PROBED · DORMANT · PLACEHOLDER · BLOCKED · PLANNED · IN PROGRESS · THEORETICAL · DEFERRED

---

## 1. Header

| Field | Value |
|---|---|
| Date | 2026-06-18 |
| Sprint | (fill at refresh) |
| Next step | (fill at refresh) |

## 2. Sprint focus

> One paragraph: which sprint, day N of N, exit criteria. Source: ROADMAP.md sprint headers.

<!-- TODO at refresh time -->

## 3. Fetcher status

| # | Fetcher | Package | Status | Last-verified | Source doc | Blocker |
|---|---|---|---|---|---|---|
| 1 | bhulekh | `packages/fetchers/bhulekh/` | LIVE | (fill) | docs/sources/bhulekh.md | — |
| 2 | bhunaksha | `packages/fetchers/bhunaksha/` | LIVE | (fill) | (none) | — |
| 3 | bhunaksha-plot-report | `packages/fetchers/bhunaksha-plot-report/` | LIVE | 2026-06-14 | (none) | — |
| 4 | nominatim | `packages/fetchers/nominatim/` | LIVE | (fill) | (none) | — |
| 5 | ecourts | `packages/fetchers/ecourts/` | LIVE (after D-035 captcha fix) | (fill) | docs/sources/ecourts.md | — |
| 6 | rccms | `packages/fetchers/rccms/` | LIVE (D-035 captcha fix) | (fill) | docs/sources/rccms.md | — |
| 7 | high-court | `packages/fetchers/high-court/` | DORMANT | — | docs/sources/high-court.md | live validation pending |
| 8 | drt | `packages/fetchers/drt/` | DORMANT | — | docs/sources/drt.md | live validation pending |
| 9 | igr-ec | `packages/fetchers/igr-ec/` | LIVE (V2 captcha 91.2% top-64) | (fill) | docs/sources/igr-ec.md | — |
| 10 | igr-ec-v3 | `packages/fetchers/igr-ec-v3/` | LIVE | (fill) | (none) | — |
| 11 | igr-bmv | `packages/fetchers/igr-bmv/` | PROBED | (fill) | (none) | — |
| 12 | igr-certified-copy | `packages/fetchers/igr-certified-copy/` | PROBED | (fill) | (none) | — |
| 13 | igr-sro | `packages/fetchers/igr-sro/` | PROBED | (fill) | (none) | — |
| 14 | igr-daily-bulletin | `packages/fetchers/igr-daily-bulletin/` | PROBED | (fill) | (none) | — |
| 15 | cersai | `packages/fetchers/cersai/` | LIVE (D-035 captcha fix; "no charges" = success) | (fill) | docs/sources/cersai.md | — |
| 16 | bda-zoning | `packages/fetchers/bda-zoning/` | LIVE (out_of_scope status) | (fill) | (none) | — |
| 17 | bhuvan-flood | `packages/fetchers/bhuvan-flood/` | PLACEHOLDER | — | (none) | NRSC licensing |
| 18 | circle-rate | `packages/fetchers/circle-rate/` | PLACEHOLDER | — | docs/sources/circle-rate.md | no API |
| 19 | rera | `packages/fetchers/rera/` | PROBED | (fill) | docs/sources/rera.md | — |
| 20 | larr | `packages/fetchers/larr/` | DORMANT | — | (none) | layered approach |
| 21 | stamp-duty | `packages/fetchers/stamp-duty/` | PLACEHOLDER | — | (none) | — |
| 22 | civic-dues | `packages/fetchers/civic-dues/` | DORMANT | — | (none) | per BMC/TPCODL/PHED |
| 23 | govt-fee | `packages/fetchers/govt-fee/` | PLACEHOLDER | — | (none) | — |
| 24 | public-dashboard | `packages/fetchers/public-dashboard/` | PLACEHOLDER | — | (none) | — |
| 25 | orsac-kyl | `packages/fetchers/orsac-kyl/` | BLOCKED | — | (none) | bearer token required |

> Source for this table: `ls packages/fetchers/` and `docs/sources/*.md`. Regenerate on package changes.

## 4. Agent status

| # | Agent | Package | Status | Tests passing | Source |
|---|---|---|---|---|---|
| 1 | consumer-report-writer | `agents/consumer-report-writer/` | LIVE | 391 (Session 056) | PRODUCT.md §3 |
| 2 | ownership-reasoner | `agents/ownership-reasoner/` | LIVE | (fill) | — |
| 3 | land-classifier | `agents/land-classifier/` | LIVE | (fill) | ADR-022 |
| 4 | encumbrance-reasoner | `agents/encumbrance-reasoner/` | LIVE | (fill) | — |
| 5 | regulatory-screener | `agents/regulatory-screener/` | LIVE | (fill) | — |
| 6 | output-auditor | `agents/output-auditor/` | LIVE | (fill) | A11 liability gate |

## 5. Pipeline status

| Component | Package | Status | Notes |
|---|---|---|---|
| Orchestrator | `packages/orchestrator/` | LIVE | V1.1 Bhulekh-only input contract |
| Schema | `packages/schema/` | LIVE | Zod-first, 1,669 villages in location graph |
| Captcha-breaker | `packages/captcha-breaker/` | LIVE (ONNX) | ddddocr ensemble + adaptive K |
| PDF renderer | `packages/pdf-renderer/` | LIVE | Playwright-based |

## 6. Tasks

> Source: current CLAUDE.md §4. Append-only. Never delete a row. Mark SUPERSEDED with a date when replacing a task.

| ID | Status | Priority | Title | Source | Last touch |
|---|---|---|---|---|---|
| T-001 | DONE | P0 | Monorepo skeleton | CLAUDE.md §4 | 2026-04-16 |
| T-015 | DONE | P0 | Bhulekh live-validated | CLAUDE.md §4 | 2026-05-13 |
| T-032 | DONE | P0 | High Court + DRT stub | CLAUDE.md §4 | 2026-05-02 |
| ... (continue with all T-IDs from current CLAUDE.md §4) |

<!-- TODO: copy T-IDs from CLAUDE.md §4 in PR 3. For PR 1, leave table empty except for 2-3 examples above. -->

## 7. Active risks

| # | Risk | Owner | Mitigation |
|---|---|---|---|
| 1 | (copy from current CLAUDE.md §6 risks section, max 10) | | |

<!-- TODO in PR 3 -->

## 8. Recent shipped

| Date | Deploy | URL | Highlights |
|---|---|---|---|
| 2026-06-15 | V5B ship | (URL) | (fill) |

## 9. Next action

> One concrete task ID + one-sentence reason.

<!-- TODO in PR 3 — copy from CLAUDE.md §6 "Single highest-leverage next step" -->

## 10. Deeper docs

| If you want | Read |
|---|---|
| Current sprint plan | ROADMAP.md |
| Backlog | BACKLOG.md |
| Full feature inventory | FEATURES.md |
| Theoretical ceiling | PRODUCT.md §8 |
| Fraud patterns | FRAUD_PATTERNS.md |
| Source docs (per source) | docs/sources/*.md |
| Source roadmap | docs/sources/source-roadmap.md |
| Validation framework | docs/validation/validation-framework.md |
| Data-point reliability | docs/validation/data-point-reliability.md |
| Production launch ops | docs/ops/production-launch.md |
| Customer development | CUSTOMER_DEVELOPMENT.md |
| Multi-cohort future | COUNCIL.md |
| Engineering ADRs | CLAUDE.md §5 |

## 11. Pointer to CLAUDE.md and PRODUCT.md

> Status does not replace CLAUDE.md or PRODUCT.md. Status answers "what is the current state?" CLAUDE.md answers "what is the engineering constitution?" PRODUCT.md answers "what are we building and why?"
```

- [ ] **Step 3: Create `FEATURES.md` at repo root**

```markdown
# FEATURES.md — ClearDeed Feature Inventory

> **Status pills:** LIVE = in production code · PARTIAL = in code, not fully validated · PROBED = explored and documented · DORMANT = code exists, V1.1 dormant · PLACEHOLDER = stub returns manual_required · BLOCKED = external gate · PLANNED = scheduled · IN PROGRESS = actively worked · THEORETICAL = defined, not started · DEFERRED = V2+
>
> **Authority:** PRODUCT.md owns the "what" and "why." FEATURES.md is the operational inventory of "what's actually in code, in roadmap, or in theory."

---

## 1. Core data acquisition

| Feature | One-line | Status | Source |
|---|---|---|---|
| Bhulekh RoR (Front + Back Page) | GPS-via-plot → owner/kisam/mutation/encumbrance | LIVE | ADR-020, T-015 |
| Bhunaksha WFS | GPS → revenue plot polygon | LIVE | ADR-006 |
| Bhunaksha Plot Report | GPS → SVG map image with polygon + satellite + cadastral | LIVE | D-036 (2026-06-14) |
| eCourts party-name search | owner name → court cases (with captcha) | LIVE | D-035 (2026-06-14) |
| RCCMS revenue court | revenue case status (with captcha) | LIVE | D-035 |
| IGR EC V2 | 1-year encumbrance search (3-way ddddocr ensemble) | LIVE | D-035 (2026-06-14) |
| IGR EC V3 | (latest) | LIVE | recent commit 02af3df |
| IGR BMV / Certified Copy / SRO / Daily Bulletin | (multiple IGR sub-sources) | PROBED | — |
| CERSAI | "no charges found" = success | LIVE | D-035 (d943f59) |
| BDA zoning | (out_of_scope status) | LIVE | D-035 (cdffdb8) |
| High Court (Orissa) | hcservices.ecourts.gov.in | DORMANT | T-032 |
| DRT | cis.drt.gov.in | DORMANT | T-032 |
| Bhuvan flood | NRSC WMS | PLACEHOLDER | NRSC licensing required |
| Circle rate | IGR benchmark | PLACEHOLDER | no API — deep-link only |
| RERA Odisha | rera.odisha.gov.in | PROBED | docs/sources/rera.md |
| LARR | layered (eCourts + Revenue SIA + RTI) | DORMANT | T-042 |
| Stamp duty | (static) | PLACEHOLDER | — |
| Civic dues (BMC/TPCODL/PHED) | (per-source) | DORMANT | T-035 |
| Govt fee | (static) | PLACEHOLDER | — |
| Public dashboard | (placeholder) | PLACEHOLDER | — |
| ORSAC KYL | Bearer-token-protected | BLOCKED | T-003 |
| Nominatim | reverse geocode | LIVE | T-006 |
| Captcha-breaker (shared) | ONNX ensemble | LIVE | D-013, captcha-breaker package |
| Apify parseforge (ecourts) | (fallback) | LIVE | Layer 1.2 commit 278cbc2 |

## 2. Pipeline & orchestration

| Feature | One-line | Status | Source |
|---|---|---|---|
| Parallel fetchers | `Promise.allSettled` with 30s timeout | LIVE | T-007 |
| Retry with backoff | exponential + jitter | LIVE | DPR-INF-004 |
| Template hash drift | computeTemplateHash + detectTemplateDrift | LIVE | DPR-INF-005 |
| `isSourceFired` gate | typed "fire" per source | LIVE | task-0.1-brief.md |
| Source-status gating | per-source result `status` ∈ {ok, no_data, source_down, parse_error, manual_required} | LIVE | contracts/<source>.ts |
| Evidence bundle | source-attached raw + parser version + attempt metadata | LIVE | DPR-INF-001 |
| Cross-source validation | CS-01..CS-06 (GPS, village, area, plot, owner) | LIVE | T-020 |
| Pid (seller-name actor network) | hash + Jaccard + count≥2 surfaces "repeat seller" | LIVE | PID_TRACK.md, source-reliability spec |
| Khordha location graph | 1,669 villages | LIVE | packages/schema/src/data/odisha-location-graph.json |

## 3. Report generation

| Feature | One-line | Status | Source |
|---|---|---|---|
| Six-section report | Plot, Ownership, Land, Encumbrance, Regulatory, Action | LIVE | PRODUCT.md §3 |
| RoR risk intelligence engine | deterministic highlights (positive/watch-out) | LIVE | ADR-019, ADR-020, A10 |
| Complete RoR Audit | full parsed plot table, dues, screenshots, source dates | LIVE | ADR-018 |
| Line-by-line provenance | "Verify yourself" links (planned) | PLANNED | T-061, Mechanism 1 |
| Financial exposure layer | ₹ exposure per CRITICAL/HIGH insight | PLANNED | T-047, ADR-022 |
| Six buyer questions summary | Q1-Q6 mapping | PLANNED | T-048, ADR-023 |
| Buyer vs lawyer split | Layer 1 (5-10 screens) + Layer 2 (drill-down) | PLANNED | ADR-024 |
| Pricing tiers | Free / Standard ₹699 / Verified ₹1,999 / Guaranteed ₹4,999 / Enterprise | THEORETICAL | ADR-027 |
| Guaranteed tier mechanism | 18-month correctness guarantee | THEORETICAL | ADR-026 |
| In-report feedback widget | 👍/👎 per section → /api/feedback → report_feedback table | LIVE | CURRENT_FOCUS.md (2026-06-14) |

## 4. Identity & ownership

| Feature | One-line | Status | Source |
|---|---|---|---|
| RoR-first facts | display owner/kisam directly, no seller matching | LIVE | ADR-015 |
| Deterministic RoR insights | rule-based, not LLM | LIVE | ADR-019 |
| Confidence-tiered English names | Verified / High-confidence / Source / Machine-review | LIVE | ADR-017 |
| Back Page mutation/encumbrance rules | 5 issue lenses, 7 evidence-strength labels | LIVE (rules), THEORETICAL (renderer) | ADR-020 |
| Single-token owner claim | downgrade to ambiguous, no high confidence | LIVE | DPR-OWN-001 (Session 038) |
| Co-owner dedup | owner blocks (not plot rows) | LIVE | DPR-OWN-002 |
| Bhulekh RoR case references | extracted from special/plot remarks | LIVE | DPR-OWN-009 |

## 5. Land classification

| Feature | One-line | Status | Source |
|---|---|---|---|
| Odisha Kisam 2024-2026 | 22 standardized categories | LIVE | A6, ADR-022 |
| CLU fee estimation | ₹30K-3L/acre by zone | LIVE | A6 |
| Neyanjori / Anabadi mapping | recognized as government notified (prohibited) | LIVE | Session 050 |
| Buildable / conversion-required / prohibited | tri-state per plot row | LIVE | DPR-LAND-003 |
| Sarad variants (ଶାରଦ ଏକ/ଦୁଇ/ତିନି) | mapped to agricultural | LIVE | Session 051 |

## 6. Validation & reliability

| Feature | One-line | Status | Source |
|---|---|---|---|
| Data-point reliability matrix | L0-L4 readiness per report field | LIVE | docs/validation/data-point-reliability.md |
| Cross-source validation (CS-01..CS-06) | GPS, village, area, plot, owner, tahasil | LIVE | T-020 |
| Parser template hash drift | structural change → partial/failed | LIVE | DPR-INF-005 |
| Source audit panel | per-source status in report | LIVE | DPR-ACT-001 |
| Claim-state-to-copy mapping | verified/matched/discrepancy/unavailable/manual_required | LIVE | DPR-COPY-001 |
| A11 OutputAuditor | structural + source-state contradiction checks | LIVE | A11 |
| A11 false-positive fix | negated disclaimer language | LIVE | Session 032 |

## 7. Fraud detection (5 Khordha patterns + detection rules)

| Feature | One-line | Status | Source |
|---|---|---|---|
| Patia Industrial-Lease Scam (OGLS S.3B) | RLD-prefix on Sthitiban/Raiyati → CRITICAL | THEORETICAL (detection rule PLANNED) | ADR-021, T-050 |
| Surya Nirman Multi-Investor Fraud | EOW-attached properties | THEORETICAL (T-049 EOW blacklist PLANNED) | ADR-021 |
| Malipada Impersonation Scam | seller address far + no PoA | THEORETICAL (T-051 PLANNED) | ADR-021 |
| Industrial-Zone Plot Sold as Residential | BDA Master Plan cross-reference | THEORETICAL (T-065 PLANNED) | ADR-021 |
| Subdivided Plot Without BDA Layout | sub-plot indicator + no BDA approval | THEORETICAL (T-052 PLANNED) | ADR-021 |
| BDA layout approval check | OBPS portal query | PLANNED | T-052 |
| EOW Khordha blacklist | monthly scrape of eowodisha.gov.in | PLANNED | T-049 |
| Time-series trajectory rules | IGR benchmark, court lit, BDA extension | PLANNED | T-059 |

## 8. Pricing tiers (defined, not all shipped)

| Tier | Price | Status | Source |
|---|---|---|---|
| Free preview | ₹0 | THEORETICAL (landing page live, report gated) | ADR-027 |
| Standard | ₹699 | THEORETICAL | ADR-027 |
| Verified | ₹1,999 | THEORETICAL | ADR-027 |
| Guaranteed | ₹4,999 | THEORETICAL (actuarial data needed) | ADR-026, ADR-027 |
| Enterprise | ₹399/report | THEORETICAL | T-067 |

## 9. Trust mechanisms (sequential)

| Mechanism | One-line | Status | Source |
|---|---|---|---|
| Provenance "Verify yourself" | Bhulekh/eCourts/BDA direct links | PLANNED | T-061, ADR-026 Mechanism 1 |
| Lawyer co-sign | ₹1,999 add-on, panel advocate | THEORETICAL (month 2+) | T-062, ADR-026 Mechanism 2 |
| 18-month guarantee | refund + lawyer if verified-clear claim wrong | THEORETICAL (month 3+) | T-063, ADR-026 Mechanism 3 |
| Buyer follow-up survey | 30/90/180/365 days | PLANNED | T-060, ADR-025 |
| B2B lawyer feedback | expert labels | THEORETICAL | ADR-025 |

## 10. Moat / compound assets (theoeretical until data accumulates)

| Asset | One-line | Status | Source |
|---|---|---|---|
| Khordha kisam-to-buildability lookup | more reports → fewer false positives | THEORETICAL (2 weeks to build) | Ceiling §8.6 |
| Khordha mouza transaction database | IGR benchmark time-series per village | THEORETICAL (ongoing from launch) | T-066, Ceiling §8.6 |
| EOW Khordha blacklist | monthly scrape, retroactive matching | THEORETICAL (T-049) | Ceiling §8.6 |
| Buyer outcome database | follow-up survey → rule weights | THEORETICAL (T-060) | ADR-025, Ceiling §8.6 |
| Lawyer feedback corpus | B2B expert labels | THEORETICAL | ADR-025, Ceiling §8.6 |
| Fraud pattern library | each detection teaches the next | THEORETICAL | Ceiling §8.6 |
| Parser robustness via fixture corpus | per ROR layout | LIVE (ongoing) | Ceiling §8.6 |
| Vernacular kisam translation memory | 7,797 → 12 canonical mapping | THEORETICAL (in progress) | Ceiling §8.6 |
| Adjacent plot graph | geo data across queried plots | PLANNED (T-056) | Ceiling §8.6 |
| Verified English name dictionary | name transliteration accuracy | LIVE (in progress) | Ceiling §8.6 |

## 11. Platforms & infra

| Component | Status | Source |
|---|---|---|
| Vercel production (https://v0-cleardeed.vercel.app) | LIVE | vercel.json |
| Supabase (Postgres + Auth + Storage) | LIVE | infra/supabase/migrations/ |
| captcha-breaker ONNX (in-house) | LIVE | packages/captcha-breaker/, D-013 |
| Apify parseforge (ecourts fallback) | LIVE | commit 278cbc2 |
| Playwright worker | LIVE | workers/playwright-worker/ |
| 2Captcha fallback (approved for novel anti-bot only) | LIVE | D-013 |
| ddddocr ensemble (adaptive K) | LIVE | D-035 |
| Tesseract.js fallback | LIVE | T-010 |

## 12. Compliance & legal

| Item | Status | Source |
|---|---|---|
| Consumer disclaimer draft | PARTIAL (awaiting counsel) | legal/disclaimers/consumer.md |
| Legal counsel review (₹50K-1.5L) | BLOCKED | T-022 |
| 10-report domain reviewer QA | BLOCKED | T-023 |
| Data residency | LIVE (Supabase region-locked) | infra/ |
| Consent flow (DPDP Act) | PARTIAL | legal/ |
| Domain reviewer sign-off (3 reviewers × 10 reports) | BLOCKED | T-023 |

## 13. Future cohorts (V2+)

| Cohort | Status | Source |
|---|---|---|
| V1.5 brokers/builders (acquisition channel) | DEFERRED | ADR-009, ADR-013 |
| V2 NBFC/bank scoring | DEFERRED | ADR-011, COUNCIL.md |
| V2 builder analytics | DEFERRED | COUNCIL.md |
| V3 enterprise B2B (API access, white-label, batch upload) | DEFERRED | T-067, ADR-027 |
| Multi-state expansion (Cuttack, Berhampur, Rourkela) | DEFERRED | T-045 |
| ComplyRadar platform (broader than land due diligence) | DEFERRED | COMPLYRADAR_*.md, COUNCIL.md |
```

- [ ] **Step 4: Verify both files exist and have the expected sections**

Run:
```bash
ls -la STATUS.md FEATURES.md
echo "---STATUS.md sections---"
grep -E "^## [0-9]+\." STATUS.md
echo "---FEATURES.md sections---"
grep -E "^## [0-9]+\." FEATURES.md
echo "---required FEATURES.md sections (must be 13)---"
grep -cE "^## [0-9]+\." FEATURES.md
echo "---required STATUS.md sections (must be 11)---"
grep -cE "^## [0-9]+\." STATUS.md
```

Expected:
- Both files exist
- STATUS.md has 11 numbered sections
- FEATURES.md has 13 numbered sections

- [ ] **Step 5: Commit**

```bash
git add STATUS.md FEATURES.md PR-CHECKLIST.md
git commit -m "$(cat <<'EOF'
docs(status): add STATUS.md (operational index) + FEATURES.md (feature inventory)

New root-level pointer docs, no edits to existing files.

STATUS.md (11 sections): header, sprint focus, fetcher/agent/pipeline/task
tables, active risks, recent shipped, next action, deeper docs pointer.
Append-only for tasks. Refresh by end of every working session.

FEATURES.md (13 sections): full feature inventory with status pills (LIVE,
PARTIAL, PROBED, DORMANT, PLACEHOLDER, BLOCKED, PLANNED, IN PROGRESS,
THEORETICAL, DEFERRED). Each row links to source (ADR, plan, fetcher
package, document).

PR-CHECKLIST.md is a transient 6-PR migration checklist, deleted at end
of PR 6.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

Expected: 1 commit on `feat/source-reliability-and-pid-foundation` adding 3 files.

---

## Task 2: PR 2 — Add redirect headers to existing docs

**Files:**
- Modify: `PRODUCT_SPEC.md` (prepend redirect)
- Modify: `CURRENT_FOCUS.md` (prepend redirect)
- Modify: `STRATEGY.md` (one-line fix)
- Modify: `COUNCIL.md` (prepend scope-narrowing header)
- Modify: `ROADMAP.md` (prepend one-line pointer)
- Modify: `BACKLOG.md` (prepend one-line pointer)
- Modify: `DECISIONS.md` (prepend scope-narrowing header)
- Modify: `CLEARDEED_FINAL_CEILING.md` (prepend redirect)
- Modify: `COMPLYRADAR_0_TO_1_MASTER_STRATEGY.md` (prepend scope-narrowing header)
- Modify: `COMPLYRADAR_PRODUCT_STRATEGY.md` (prepend scope-narrowing header)
- Modify: `README.md` (prepend one-line pointer)
- Test: ripgrep for redirect banners, ripgrep for "PRODUCT_SPEC" in STRATEGY.md

**Interfaces:**
- Consumes: each doc's current first line / first paragraph
- Produces: a redirect banner at the top of each modified doc. No content deletions.

- [ ] **Step 1: Prepend redirect banner to `PRODUCT_SPEC.md`**

Add to the very top of the file (before any existing content):
```markdown
> **DEPRECATED — 2026-06-18:** This doc is superseded by [PRODUCT.md](PRODUCT.md) per CLAUDE.md authority rule. Content here may be out of date. This file will be deleted in PR 5 (≥24h after this banner).

```

- [ ] **Step 2: Prepend redirect banner to `CURRENT_FOCUS.md`**

Add to the very top of the file:
```markdown
> **DEPRECATED — 2026-06-18:** This doc is superseded by [STATUS.md](STATUS.md). The "today" content moved to STATUS.md §1, §2, §8, §9. This file will be deleted in PR 5.

```

- [ ] **Step 3: Fix contradiction in `STRATEGY.md`**

Locate the line: `**Companion files:** \`CLAUDE.md\` (engineering constitution), \`PRODUCT_SPEC.md\` (product details), \`ROADMAP.md\` (sprint plan), \`DECISIONS.md\` (decisions log).`

Replace with: `**Companion files:** \`CLAUDE.md\` (engineering constitution), \`PRODUCT.md\` (product vision, source of truth for product decisions), \`STATUS.md\` (operational index), \`ROADMAP.md\` (sprint plan), \`DECISIONS.md\` (supplementary operational decisions).`

Add a one-line note below: `> Note: \`PRODUCT_SPEC.md\` is deprecated as of 2026-06-18 — see redirect banner in that file. \`CLAUDE.md\` is the authority on engineering discipline; \`PRODUCT.md\` is the authority on product decisions.`

- [ ] **Step 4: Add scope-narrowing header to `COUNCIL.md`**

Add to the very top of the file:
```markdown
> **Scope clarification — 2026-06-18:** This doc describes the future-state multi-cohort architecture (V2+). For the V1 consumer product (current focus), see [PRODUCT.md](PRODUCT.md). For operational status, see [STATUS.md](STATUS.md). For engineering constitution, see [CLAUDE.md](CLAUDE.md).

```

- [ ] **Step 5: Add one-line pointer to `ROADMAP.md`**

Add to the very top of the file:
```markdown
> **Pointer — 2026-06-18:** For current operational status (what's live, what's blocked, what's next), see [STATUS.md](STATUS.md). This file owns the sprint plan; STATUS.md owns "where we are right now."

```

- [ ] **Step 6: Add one-line pointer to `BACKLOG.md`**

Add to the very top of the file:
```markdown
> **Pointer — 2026-06-18:** For current operational status, see [STATUS.md](STATUS.md). This file owns the backlog of ideas; STATUS.md owns "what's actively being worked on."

```

- [ ] **Step 7: Add scope-narrowing header to `DECISIONS.md`**

Add to the very top of the file:
```markdown
> **Scope clarification — 2026-06-18:** This file holds supplementary operational decisions made outside the formal ADR process. **Canonical ADRs (001-027) live in [CLAUDE.md §5](CLAUDE.md#section-5--decision-log).** If there's a conflict, CLAUDE.md §5 wins.

```

- [ ] **Step 8: Prepend redirect banner to `CLEARDEED_FINAL_CEILING.md`**

Add to the very top of the file:
```markdown
> **DEPRECATED — 2026-06-18:** This content has been absorbed into [PRODUCT.md](PRODUCT.md) §8 (Theoretical Ceiling). This file will be deleted once the absorption is confirmed (PR 6 audit pass).

```

- [ ] **Step 9: Add scope-narrowing header to `COMPLYRADAR_*.md` files**

For each of `COMPLYRADAR_0_TO_1_MASTER_STRATEGY.md` and `COMPLYRADAR_PRODUCT_STRATEGY.md`, prepend:
```markdown
> **Scope clarification — 2026-06-18:** This doc covers the ComplyRadar V2+ platform expansion (beyond land due diligence). For the current V1 consumer product, see [PRODUCT.md](PRODUCT.md). For the multi-cohort future state, see [COUNCIL.md](COUNCIL.md).

```

- [ ] **Step 10: Add pointer to `README.md`**

Add to the very top of the file:
```markdown
> **Current state:** See [STATUS.md](STATUS.md) for what's live, what's blocked, and what's next.

```

- [ ] **Step 11: Verify all redirects are present**

Run:
```bash
for f in PRODUCT_SPEC.md CURRENT_FOCUS.md STRATEGY.md COUNCIL.md ROADMAP.md BACKLOG.md DECISIONS.md CLEARDEED_FINAL_CEILING.md COMPLYRADAR_0_TO_1_MASTER_STRATEGY.md COMPLYRADAR_PRODUCT_STRATEGY.md README.md; do
  echo "=== $f ==="
  head -3 "$f" | grep -E "(DEPRECATED|Scope clarification|Pointer|2026-06-18)" || echo "MISSING REDIRECT BANNER"
done
```

Expected: every file shows a redirect banner in the first 3 lines. Any "MISSING REDIRECT BANNER" line is a failure.

- [ ] **Step 12: Verify STRATEGY.md contradiction is fixed**

Run:
```bash
grep -n "PRODUCT_SPEC" STRATEGY.md
```

Expected: no output. (Or: only the deprecation note line that mentions `PRODUCT_SPEC.md` is deprecated.)

- [ ] **Step 13: Commit**

```bash
git add PRODUCT_SPEC.md CURRENT_FOCUS.md STRATEGY.md COUNCIL.md ROADMAP.md BACKLOG.md DECISIONS.md CLEARDEED_FINAL_CEILING.md COMPLYRADAR_0_TO_1_MASTER_STRATEGY.md COMPLYRADAR_PRODUCT_STRATEGY.md README.md
git commit -m "$(cat <<'EOF'
chore(docs): add redirect headers to 11 docs pointing to canonical sources

PRODUCT_SPEC.md → PRODUCT.md (deprecated, delete in PR 5)
CURRENT_FOCUS.md → STATUS.md (deprecated, delete in PR 5)
STRATEGY.md contradiction fixed (PRODUCT_SPEC → PRODUCT.md)
COUNCIL.md → scope-narrowed to V2+ multi-cohort
DECISIONS.md → scope-narrowed to non-ADR operational decisions
CLEARDEED_FINAL_CEILING.md → content absorbed into PRODUCT.md §8
COMPLYRADAR_*.md → scope-narrowed to V2+ platform expansion
ROADMAP.md, BACKLOG.md, README.md → one-line pointer to STATUS.md

Per CLAUDE.md authority: CLAUDE.md wins on engineering, PRODUCT.md on product.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

Expected: 1 commit modifying 11 files.

---

## Task 3: PR 3 — Move CLAUDE.md §4, §6, §7, §8 out

**Files:**
- Modify: `CLAUDE.md` (mark sections 4, 6, 7, 8 as "moved")
- Create: `docs/sessions/2026-06.md` (current month session log)
- Modify: `STATUS.md` (populate §3, §6, §7, §9 with moved content)
- Modify: `PRODUCT.md` (absorb §8 Theoretical Ceiling)
- Test: ripgrep for empty moved sections, line-count check

**Interfaces:**
- Consumes: CLAUDE.md §4 (tasks T-001..T-067), §6 (state snapshot), §7 (recent session entries), §8 (theoretical ceiling)
- Produces: STATUS.md populated with the moved content. PRODUCT.md grows by ~95 lines (theoretical ceiling content).

- [ ] **Step 1: Create `docs/sessions/2026-06.md` with current month's session log**

The file MUST have this header:
```markdown
# ClearDeed Session Log — June 2026

> Append-only. Newest at top. Daily entries (or per-session if multiple per day). Use the template from [CLAUDE.md §7](CLAUDE.md#section-7--session-log-template).
>
> Earlier sessions (2026-04 to 2026-05) live in git history pre-consolidation commit (search for the file deleted by PR 4 of the doc-consolidation plan).

---

## Session 2026-06-18 (Doc consolidation)

Mode: execution
Duration: ~3 hours
Focus: Doc consolidation + status index. Six-PR migration.

Tasks worked:
  - [T-DOC-1] DONE — Add STATUS.md and FEATURES.md (new root files)
  - [T-DOC-2] DONE — Add redirect headers to 11 existing docs
  - [T-DOC-3] IN PROGRESS — Move CLAUDE.md §4, §6, §7, §8 to STATUS.md / docs/sessions/ / PRODUCT.md

Decisions made:
  - [ADR-028] Doc consolidation — pointer docs at root, content split between CLAUDE.md, PRODUCT.md, STATUS.md.

Code changes (high-level):
  - STATUS.md, FEATURES.md created
  - 11 docs got redirect headers
  - CLAUDE.md §4, §6, §7, §8 marked as moved (anchor stubs remain for 30 days)

What is pending:
  - T-DOC-4: Slim CLAUDE.md
  - T-DOC-5: Delete deprecated docs (after 24h with redirects live)
  - T-DOC-6: Audit pass
```

Then add one entry per recent session that was in CLAUDE.md §7 (Sessions 050-057, the May 2026 sessions). The exact text of each session is preserved verbatim from CLAUDE.md §7 — DO NOT reformat.

- [ ] **Step 2: Populate `STATUS.md` §3 (fetchers) with current data**

Read `ls packages/fetchers/` and `docs/sources/*.md` and fill the `(fill)` placeholders in the fetcher table created in PR 1 with the actual last-verified dates and source-doc paths. For sources that don't have a `docs/sources/<name>.md` file, set `Source doc` to `(none)`.

- [ ] **Step 3: Populate `STATUS.md` §6 (tasks) by copying CLAUDE.md §4**

Open CLAUDE.md, locate Section 4 (Task List), and copy the full task table into STATUS.md §6. Mark the table header with a comment:
```markdown
<!-- Source: CLAUDE.md §4 (pre-PR-3) -->
```

- [ ] **Step 4: Populate `STATUS.md` §7 (active risks) by copying CLAUDE.md §6 risks section**

Open CLAUDE.md, locate Section 6 "Risks currently tracking" or equivalent, and copy the risk bullets into STATUS.md §7.

- [ ] **Step 5: Populate `STATUS.md` §9 (next action) by copying CLAUDE.md §6 single highest-leverage next step**

Copy the line "Single highest-leverage next step:" from CLAUDE.md §6 into STATUS.md §9.

- [ ] **Step 6: Mark CLAUDE.md §4, §6, §7, §8 as "moved" with anchor stubs**

For each of §4, §6, §7, §8, replace the section content with a stub:
```markdown
## Section 4: Task List
> **MOVED 2026-06-18 to [STATUS.md §6](STATUS.md#6-tasks).** Anchor stub retained for 30 days (until 2026-07-18). PR 6 removes the stub.
> If a tool or doc links to `CLAUDE.md#section-4`, it now resolves to this notice.

(original §4 content was: T-001 through T-067 task list, see git history pre-PR-3)
```

Repeat for §6, §7, §8 (point to STATUS.md §7, docs/sessions/2026-06.md, PRODUCT.md §8 respectively).

- [ ] **Step 7: Absorb CLAUDE.md §8 into PRODUCT.md**

Open CLAUDE.md, locate Section 8 (Theoretical Ceiling Reference). Copy the full section content into PRODUCT.md as a new section at the end, titled "## Section 8: Theoretical Ceiling Reference (canonical)". Add a one-line attribution: `> Absorbed from CLAUDE.md §8 on 2026-06-18.`

- [ ] **Step 8: Verify the move**

Run:
```bash
echo "---CLAUDE.md line count (was 4265)---"
wc -l CLAUDE.md
echo "---STATUS.md has populated §6---"
grep -c "T-001\|T-015\|T-032" STATUS.md
echo "---PRODUCT.md has §8 absorbed---"
grep -c "Section 8: Theoretical Ceiling" PRODUCT.md
echo "---docs/sessions/2026-06.md exists---"
ls -la docs/sessions/2026-06.md
echo "---CLAUDE.md §4/§6/§7/§8 stubs present---"
grep -E "^## Section (4|6|7|8):" CLAUDE.md
```

Expected:
- CLAUDE.md line count: roughly 4,265 minus the moved content (~3,500 lines, will be further reduced in PR 4)
- STATUS.md: at least 3 hits for T-IDs
- PRODUCT.md: 1 hit for "Section 8: Theoretical Ceiling"
- docs/sessions/2026-06.md: exists
- CLAUDE.md: 4 hits for section headers (the stubs)

- [ ] **Step 9: Commit**

```bash
git add CLAUDE.md STATUS.md PRODUCT.md docs/sessions/2026-06.md
git commit -m "$(cat <<'EOF'
docs(structure): move CLAUDE.md §4/§6/§7/§8 to canonical homes

§4 Task List → STATUS.md §6 (append-only, all T-IDs preserved)
§6 State Snapshot → STATUS.md §3 (fetchers), §6 (tasks), §7 (risks), §9 (next action)
§7 Session Log → docs/sessions/2026-06.md (recent sessions) + git history (older)
§8 Theoretical Ceiling → PRODUCT.md (new last section, attributed)

CLAUDE.md sections retained as anchor stubs for 30 days (removed in PR 6).
No content reformatting. No content deleted from git history.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

Expected: 1 commit, ~5 files modified, CLAUDE.md roughly halved.

---

## Task 4: PR 4 — Slim CLAUDE.md to constitution + decisions only

**Files:**
- Modify: `CLAUDE.md` (remove non-stub content from §1-3, §5; rewrite to ~800 lines)
- Test: line count, all 27 ADRs present, pointer table present

**Interfaces:**
- Consumes: current CLAUDE.md §1, §2, §3, §5
- Produces: a CLAUDE.md of ~800 lines with the new §1 pointer table, the kept §2-4, the kept §5 decision log, and the §4-7 stub banner at the bottom

- [ ] **Step 1: Build the new CLAUDE.md**

Construct the new CLAUDE.md by assembling in this order:
1. New §1 pointer table (from PR 1 spec)
2. Existing §2 Product definition (current CLAUDE.md §1) — preserved verbatim
3. Existing §3 Architecture view (current CLAUDE.md §2) — preserved verbatim
4. Existing §4 Operating principles (current CLAUDE.md §3) — preserved verbatim
5. Existing §5 Decision Log (current CLAUDE.md §5) — all 27 ADRs preserved verbatim
6. Bottom note: pointer to git history for moved content + link to current month session log

- [ ] **Step 2: Write the new CLAUDE.md**

Use the Write tool to overwrite CLAUDE.md with the new content. The file MUST end with:
```markdown
---

> **Pre-2026-06-18 content of Sections 4, 6, 7, 8 is preserved verbatim in git history** (search commits prior to PR 4 of the doc-consolidation plan, dated 2026-06-18).
>
> **Current session log:** [docs/sessions/2026-06.md](docs/sessions/2026-06.md)
>
> **Anchor stubs for §4, §6, §7, §8 above are retained until 2026-07-18.** PR 6 removes them.
```

- [ ] **Step 3: Verify CLAUDE.md structure**

Run:
```bash
echo "---CLAUDE.md line count (target ~800)---"
wc -l CLAUDE.md
echo "---All 27 ADRs present---"
grep -c "^\[ADR-" CLAUDE.md
echo "---Pointer table present---"
grep -c "^| If you want" CLAUDE.md
echo "---Operating principles section header---"
grep "^## Section 4: Operating principles" CLAUDE.md
echo "---Bottom pointer present---"
grep "Pre-2026-06-18 content" CLAUDE.md
```

Expected:
- Line count: 700-900
- ADR count: 27
- Pointer table: at least 12 rows
- Section 4 header: 1 hit (renamed from "Section 3" to "Section 4" because §1 pointer table is new)
- Bottom pointer: 1 hit

- [ ] **Step 4: Verify no content was lost**

Cross-check: every ADR (001-027) from the current CLAUDE.md §5 is present. Run:
```bash
for n in 001 002 003 004 005 006 007 008 009 010 011 012 013 014 015 016 017 018 019 020 021 022 023 024 025 026 027; do
  if grep -q "\[ADR-$n\]" CLAUDE.md; then
    echo "ADR-$n: present"
  else
    echo "ADR-$n: MISSING"
  fi
done
```

Expected: all 27 ADRs present, no "MISSING" lines.

- [ ] **Step 5: Commit**

```bash
git add CLAUDE.md
git commit -m "$(cat <<'EOF'
docs(claude): slim to constitution + decisions only (~800 lines)

Removed Sections 4 (Task List), 6 (State Snapshot), 7 (Session Log), 8
(Theoretical Ceiling) — content moved to STATUS.md, docs/sessions/,
PRODUCT.md respectively (PR 3).

New Section 1: pointer table — 12-row index of "if you want X, read Y"
covering STATUS.md, FEATURES.md, PRODUCT.md, ROADMAP.md, etc.

Preserved verbatim: Section 2 (Product Definition), Section 3 (Architecture
View, renamed from old §2), Section 4 (Operating Principles, renamed from
old §3), Section 5 (Decision Log — all 27 ADRs).

Bottom note: pointer to git history for moved content + link to current
month session log.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

Expected: 1 commit, CLAUDE.md now ~800 lines.

---

## Task 5: PR 5 — Delete deprecated docs (≥24h after PR 2)

**Files:**
- Delete: `PRODUCT_SPEC.md`
- Delete: `CURRENT_FOCUS.md`
- Test: ripgrep for references to deleted files

**Interfaces:**
- Consumes: deprecated docs with ≥24h-old redirect banners (PR 2)
- Produces: cleaner root. STATUS.md and PRODUCT.md are the canonical replacements.

- [ ] **Step 1: Confirm the 24h window has passed**

Run:
```bash
echo "PR 2 timestamp:"
git log --format=%cI --grep="redirect headers" -1
echo "Current time:"
date -u +"%Y-%m-%dT%H:%M:%SZ"
```

Expected: PR 2 timestamp is at least 24h before current time. If not, wait.

- [ ] **Step 2: Check for any remaining references to the deleted files**

Run:
```bash
echo "---PRODUCT_SPEC.md references (excluding the doc itself and the deletion log)---"
grep -rn "PRODUCT_SPEC" --include="*.md" --include="*.ts" --include="*.tsx" . 2>/dev/null | grep -v "PRODUCT_SPEC.md" | grep -v "node_modules" | grep -v ".next"
echo "---CURRENT_FOCUS.md references---"
grep -rn "CURRENT_FOCUS" --include="*.md" --include="*.ts" --include="*.tsx" . 2>/dev/null | grep -v "CURRENT_FOCUS.md" | grep -v "node_modules" | grep -v ".next"
```

Expected: only references in redirect banners, FEATURES.md, and STATUS.md pointers. Any code reference is a bug — fix it before deleting.

- [ ] **Step 3: Delete the files**

Run:
```bash
git rm PRODUCT_SPEC.md CURRENT_FOCUS.md
```

- [ ] **Step 4: Commit**

```bash
git commit -m "$(cat <<'EOF'
chore(docs): delete deprecated PRODUCT_SPEC.md and CURRENT_FOCUS.md

Both files had redirect banners live for >24h (PR 2 on 2026-06-18).

PRODUCT_SPEC.md → superseded by PRODUCT.md (CLAUDE.md authority).
CURRENT_FOCUS.md → content moved to STATUS.md §1/§2/§8/§9.

No code references to either file. STATUS.md and FEATURES.md are the
canonical replacements.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

Expected: 1 commit deleting 2 files.

---

## Task 6: PR 6 — Audit pass (broken links, anchor stubs removal)

**Files:**
- Modify: `CLAUDE.md` (replace §4-7 anchor stubs with single-line pointers)
- Modify: `STATUS.md` (correct any links found by audit)
- Modify: `PRODUCT.md` (correct any links found by audit)
- Modify: `COUNCIL.md` (if scope-narrowing header needs polish)
- Modify: `STRATEGY.md` (if deprecation note needs polish)
- Modify: `README.md` (final polish)
- Delete: `PR-CHECKLIST.md`
- Test: ripgrep-based link audit

**Interfaces:**
- Consumes: the full repo state after PR 5
- Produces: a clean repo where the three pointer docs (CLAUDE.md, PRODUCT.md, STATUS.md) are the canonical sources, FEATURES.md is the inventory, and no broken cross-references remain.

- [ ] **Step 1: Run a full link audit**

Run:
```bash
echo "---Files referencing PRODUCT_SPEC (should be 0)---"
grep -rn "PRODUCT_SPEC" --include="*.md" . 2>/dev/null | grep -v "node_modules" | grep -v ".next"
echo "---Files referencing CURRENT_FOCUS (should be 0)---"
grep -rn "CURRENT_FOCUS" --include="*.md" . 2>/dev/null | grep -v "node_modules" | grep -v ".next"
echo "---All cross-doc links in CLAUDE.md---"
grep -oE "\[.*\]\([^)]+\.md[^)]*\)" CLAUDE.md | sort -u
echo "---All cross-doc links in STATUS.md---"
grep -oE "\[.*\]\([^)]+\.md[^)]*\)" STATUS.md | sort -u
echo "---All cross-doc links in FEATURES.md---"
grep -oE "\[.*\]\([^)]+\.md[^)]*\)" FEATURES.md | sort -u
echo "---All cross-doc links in PRODUCT.md---"
grep -oE "\[.*\]\([^)]+\.md[^)]*\)" PRODUCT.md | sort -u
```

Expected: zero `PRODUCT_SPEC` or `CURRENT_FOCUS` references in `*.md` files. All cross-doc links resolve to existing files.

- [ ] **Step 2: Verify each link target exists**

For each link found in step 1, verify the target file exists. If any don't, fix the link in the source file.

- [ ] **Step 3: Remove the 30-day anchor stubs from CLAUDE.md**

Open CLAUDE.md, locate the §4, §6, §7, §8 anchor stubs (the "MOVED 2026-06-18" banners). Replace each stub with a single line:
```markdown
## Section 4: [moved to STATUS.md](STATUS.md#6-tasks) on 2026-06-18
```

Repeat for §6, §7, §8.

- [ ] **Step 4: Verify anchor stubs are minimal**

Run:
```bash
echo "---Section header lines in CLAUDE.md---"
grep "^## Section" CLAUDE.md
echo "---Total lines (should still be ~800)---"
wc -l CLAUDE.md
```

Expected: 4 section headers (each one a single line, not a stub block). Line count: roughly 750-850.

- [ ] **Step 5: Final spot-check of the three pointer docs**

For each of CLAUDE.md, STATUS.md, FEATURES.md, PRODUCT.md:
- Run: `head -20 <file>` and verify the header is clear and points to the other canonical docs.
- Run: `tail -10 <file>` and verify the footer is intact.

- [ ] **Step 6: Delete the transient PR-CHECKLIST.md**

Run:
```bash
git rm PR-CHECKLIST.md
```

- [ ] **Step 7: Final commit**

```bash
git add CLAUDE.md STATUS.md FEATURES.md PRODUCT.md COUNCIL.md STRATEGY.md README.md PR-CHECKLIST.md
git commit -m "$(cat <<'EOF'
chore(docs): final audit pass — fix broken links, remove 30-day stubs

After >24h with redirect banners live and >30 days since the move:
- Removed anchor stubs from CLAUDE.md §4/§6/§7/§8 (now single-line pointers)
- Verified all cross-doc links resolve to existing files
- Deleted transient PR-CHECKLIST.md
- Polished scope-narrowing headers in COUNCIL.md, STRATEGY.md, README.md

Final state: CLAUDE.md (~800 lines, engineering constitution + 27 ADRs),
PRODUCT.md (product vision + absorbed theoretical ceiling), STATUS.md
(operational index, 11 sections), FEATURES.md (feature inventory, 13
sections), docs/sessions/ (per-month session log).

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

Expected: 1 final commit, repo state matches the spec.

- [ ] **Step 8: Update todo list to reflect completion**

Run (this is a literal reminder — don't actually run bash, just mentally note):
- All 6 PRs complete
- Doc consolidation is done
- Future work is feature work, not doc work

---

## Self-Review

**1. Spec coverage:** Skim each section of [the spec](../specs/2026-06-18-doc-consolidation-and-status-index-design.md):
- Section "The new structure" → covered by Tasks 1, 2, 3, 4
- Section "File-by-file migration plan" → every row covered: STATUS.md and FEATURES.md (Task 1), all the redirect headers (Task 2), the moves (Task 3), the CLAUDE.md slim (Task 4), the deletions (Task 5), the audit (Task 6)
- Section "Migration mechanics" → all three principles enforced (move-don't-reformat in every task, redirect-before-delete in Task 2, six-PR sequence)
- Section "Risks" → all four risks have mitigations in the relevant tasks (anchor stub retention in Task 4, content drift covered by per-PR reviews, cross-references in Task 6 audit, STRATEGY.md contradiction in Task 2 Step 3)
- Section "Success criteria" → Tasks 1, 3, 4, 6 verify these

**2. Placeholder scan:** Searched for "TBD", "TODO", "implement later", "similar to", "appropriate", "handle edge cases". The `<!-- TODO -->` comments in STATUS.md are explicit in-task instructions (the engineer fills them in during Step 2/3/4/5 of Task 3), not placeholders. No vague requirements.

**3. Type/identifier consistency:** `STATUS.md`, `FEATURES.md`, `PR-CHECKLIST.md`, `docs/sessions/2026-06.md`, `docs/ship-logs/V5B_SHIP_SUMMARY_2026-06-15.md`, `docs/decisions/.gitkeep` referenced consistently. The `<!-- TODO at refresh time -->` comment in STATUS.md §2 is consistent with the "refresh cadence" header note. The 30-day stub-removal date (`2026-07-18`) is consistent throughout.

**4. Self-review fixes:** None needed. Plan is complete and consistent.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-06-18-doc-consolidation-and-status-index.md`.

Two execution options:

1. **Subagent-Driven (recommended)** — I dispatch a fresh subagent per PR, review between PRs, fast iteration. This plan has 6 PRs / 6 tasks; each is small enough to be one subagent's work.

2. **Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints for review.

Which approach?