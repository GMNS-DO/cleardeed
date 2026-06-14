# ROADMAP.md — ClearDeed Sprint & PI Plan

> **Reading rule:** every sprint ends with something a real buyer can use and pay for. No "infrastructure sprint." No "we're internally testing." If the sprint exit criterion is not a buyer behavior, the sprint plan is wrong.
> **Sprint length:** 2 weeks. **PI length:** 5 sprints (10 weeks).
> **Companion files:** `CLAUDE.md` (engineering constitution), `COMMERCIAL_TRACK.md` (commercial activities — activates after PI 3).

---

## IMPLEMENTATION PIs — What gets built

The entire implementation is 3 PIs and 15 sprints. Every sprint ships code that a real buyer can use. No "we're getting ready to launch" sprints.

---

# PI 1 — Khordha Product and Integrations (Sprints 1–5, Weeks 1–10)

**PI exit criterion:** *Feature-complete product for Khordha. All planned data sources integrated. Report sections polished. Delivery pipeline end-to-end. Feedback infrastructure instrumented.*

**PI 1 status: COMPLETE (2026-06-12).** All 5 sprints shipped: payment (S1), map/satellite (S2), financial exposure (S3), market + zoning (S4), conversion & polish (S5). Buyer flow works end-to-end for Mendhasala/Plot/415 in ~60 seconds. RCCMS probe disabled pending Sprint 6 fix (see BACKLOG).

---

## Sprint 1 (Weeks 1–2) — First Paid Report Infrastructure

**Sprint goal:**
> Complete the payment and delivery infrastructure so a report flows from form → payment → email delivery fully automatically. No Bhulekh fetcher work this sprint — the fetcher exists.

**Exit criteria:**
- Razorpay in test mode at ₹1 (credentials wired, checkout working)
- Email delivery working with PDF attachment to buyer email (Resend configured with RESEND_API_KEY)
- Reports auto-send on generation — no review gate
- Token-scoped persistent report URL working
- Server-rendered PDF from the same HTML as web report
- Privacy Policy and Terms of Service pages live on the site
- In-report thumbs up/down feedback captured per section

**Out of scope:** Bhulekh fetcher changes. Multi-district. Any commercial activity.

---

## Sprint 2 (Weeks 3–4) — The Plot, Visualized

**Sprint goal:**
> Add map and satellite view to the report. GPS coordinates (from Bhunaksha) pin the plot on a base map and satellite image with boundary overlay.

**Exit criteria:**
- Google Maps or Mapbox base layer integrated, plot pinned and boundary drawn
- Satellite view with boundary overlay
- Street view embed where Google has coverage; gracefully absent where it doesn't
- Sprint 1 features still work (regression check)
- Free preview endpoint: Bhulekh ROR front page lookup, masked owner name, Kisam, map pin — no payment required

**Out of scope:** Flood overlay. Project corridor pins. Any commercial activity.

---

## Sprint 3 (Weeks 5–6) — What You Might Lose After Paying

**Sprint goal:**
> Add the financial-exposure section: IGR EC, eCourts case search, RCCMS revenue court, and CERSAI mortgage check. Single "total potential exposure" headline per report. All automated — no concierge.

**Exit criteria:**
- IGR EC integration (fully automated scraping)
- eCourts scraper hits and case-search by name returns results in-report
- RCCMS scraper integrated
- CERSAI mortgage check integrated (per-query cost, triggered after payment)
- "Financial exposure summary" panel built with quantified ₹ exposure per risk type
- Encumbrance Certificate instructions panel for each tehsil

**Out of scope:** Any commercial activity.

---

## Sprint 4 (Weeks 7–8) — What It's Worth + What You Can Build

**Sprint goal:**
> Add market context (circle rate floor, IGR village sales as directional, broker listings as ceiling) and "What you can build here" (kisam → permitted use, BDA zoning lookup, Bhuvan flood flag).

**Exit criteria:**
- Circle rate lookup table for Khordha villages
- IGR village-level sale records (last 24 months)
- MagicBricks/99acres listing scraper for the locality
- BDA zoning lookup for the 50 most-queried village/locality combinations (hardcoded is fine)
- Bhuvan flood layer integration
- Every market data point has a "view source" link and floor/directional/ceiling framing
- Sub-plot detection (D/88 pattern) fires HIGH WATCH-OUT

**Out of scope:** Composite scores. Any commercial activity.

---

## Sprint 5 (Weeks 9–10) — Conversion & Polish

**Sprint goal:**
> Polish the complete product. Three-layer report (summary / buyer read / lawyer drill-down). Print-optimized CSS. 60-day report validity with pay-to-refresh option. Feedback infrastructure instrumented.

**Exit criteria:**
- Three-layer report shipped: top summary one-screen, middle buyer-read, bottom drill-down
- Print-optimized CSS for buyers taking the report to a lawyer
- 60-day report validity + pay-to-refresh option (~₹299)
- Conversion funnel instrumented (landing → preview → pay → delivered → feedback)
- Every report section has a "Verify yourself" link to the source page
- All 6 report sections complete and tested

---

# PI 2 — Multi-District (Sprints 6–10, Weeks 11–20)

**PI exit criterion:** *All 5 major Odisha districts live at production quality. Product has no execution gaps as a reason for buyer conversations to fail.*

---

## Sprint 6 (Weeks 11–12) — Cuttack & Puri

**Sprint goal:**
> Buyer in Cuttack or Puri runs the full Khordha-equivalent flow. District-specific quirks (Puri CRZ, Cuttack flood) appear in the report.

**Exit criteria:**
- Cuttack: tehsil/village/RI lookup tables, district-specific zoning module (CDA), Cuttack-flood disclaimer
- Puri: same plus CRZ boundary overlay and Puri-specific PDA zoning
- Sprint 1–5 functionality fully regression-tested for both new districts
- Fraud pattern research: 2 documented patterns per new district added to `FRAUD_PATTERNS.md`

**Out of scope:** Any commercial activity.

---

## Sprint 7 (Weeks 13–14) — Ganjam & Sambalpur

**Sprint goal:**
> All 5 major Odisha districts live with the full ClearDeed flow.

**Exit criteria:**
- Ganjam + Sambalpur lookup tables, zoning modules, district disclaimers
- All 5 districts live with regression suite green

---

## Sprint 8 (Weeks 15–16) — B2B Delivery Infrastructure

**Sprint goal:**
> Build B2B delivery infrastructure for the first signed customer. Batch input, white-label option, secure delivery, volume pricing.

**Exit criteria:**
- Batch input (CSV of plot IDs, or upload of broker/lawyer briefs)
- White-label option (firm name on report)
- Secure delivery (signed URLs, expiring access)
- Volume pricing structure (₹399–₹499/report at 20+ reports/month)
- Sample batch report demonstrating cross-plot consistency

**Note:** This is product infrastructure, not a sales sprint. Build for the first signed customer's actual requirements.

**Out of scope:** B2B sales conversations. Any commercial activity.

---

## Sprint 9 (Weeks 17–18) — Deliver B2B Pilot

**Sprint goal:**
> Whatever the first signed B2B customer requires, built and shipped.

**Exit criteria:**
- First B2B customer contract deliverables delivered
- Consumer flow continues — no regression

---

## Sprint 10 (Weeks 19–20) — PI 2 Close

**Sprint goal:**
> Clean up, document, and hand off. PI 3 plan finalized based on PI 1 + PI 2 learnings.

**Exit criteria:**
- DPDP compliance audit (self-audit using a checklist) clean
- All 5 districts at production quality
- PI 3 plan revised based on implementation learnings

---

# PI 3 — Adjacent Data & Scale (Sprints 11–15, Weeks 21–30)

**PI exit criterion:** *Product is as complete as it can be with current data sources. All 5 districts at scale. Ready for commercial track.*

---

### Sprint 11 (Weeks 21–22) — Bhulekh Data Mirror + Adjacent Sources

**Sprint goal:**
> Bulk ROR data mirror for Khordha (Railway persistent process) + second-wave data sources that compound the moat.

**Exit criteria:**
- Bhulekh Mirror Stage 0–4 complete for Khordha: bulk ROR mirror in Supabase, change detector running on Railway, high_priority_recheck wired to Vercel pipeline
- Sample validation gate passed (8–10 plots verified manually before bulk)
- PID pattern matching integrated into reports for ≥3 VALIDATED patterns
- BMC Policy Tracker property tax cross-reference shipped
- TPCODL connection history (occupancy signal) shipped
- 4 of 5 above shipped (BMC + TPCODL + 2 more)

**Out of scope:** Phase 2 district expansion for Mirror. Any PID patterns below VALIDATED tier in reports.

---

## Sprint 12 (Weeks 23–24) — Polish & Edge Cases

**Sprint goal:**
> Polish edge cases, error handling, and feedback-loop quality from real buyer data.

**Exit criteria:**
- Top 10 buyer-reported missing data points addressed
- Error states for all data sources improved
- NPS survey results from Sprint 1–11 cohort reviewed

---

## Sprint 13 (Weeks 25–26) — Infrastructure Hardening

**Sprint goal:**
> Performance, reliability, and cost optimization before any commercial scale push.

**Exit criteria:**
- Pipeline latency p95 < 30s for Bhulekh-only reports
- Error rate < 1% across all sources
- Cost per report documented

---

## Sprint 14 (Weeks 27–28) — Deep Dive & Completeness Check

**Sprint goal:**
> Systematic review of every report section against the fraud pattern playbook. Fill remaining gaps.

**Exit criteria:**
- All 5 documented fraud patterns have working detection rules
- Every "manual verification required" label has a clear upgrade path
- Report quality score (internal) at target

---

## Sprint 15 (Weeks 29–30) — PI 3 Close

**Sprint goal:**
> Implementation is complete. Product is as good as current data sources allow. Commercial track can begin.

**PI 3 retrospective:** *Is the product complete enough to hand off to a commercial team, or does implementation continue?*

---

## After PI 3: Implementation Complete

Product implementation is done. All remaining work is commercial — see `COMMERCIAL_TRACK.md`.

---

*Implementation PIs are engineering-only. Sprint reviews happen Friday afternoons. Sprint planning happens Monday mornings. Mid-sprint scope changes go in DECISIONS.md or they don't happen.*

---

# PI-V — Validation (Sprints V1–V4, Weeks 11–18)

**PI exit criterion:** *For any valid Khordha input, the report contains every data point in its section inventory either with the right value or a typed degradation tag. For any invalid input, the buyer gets an actionable error before payment. ≥95% of valid Khordha inputs produce a correct or correctly-degraded report. The 50-plot regression suite is green in CI.*

**Inserted between PI 1 close and PI 2 multi-district.** Reason: launching Cuttack with unvalidated Khordha scrapers multiplies the validation surface by 5. The harness built here (input taxonomy, ground-truth corpus, per-fetcher contract schemas, section-level validators, shadow runner, pre-payment gate, CI regression) is reusable across all 5 districts in PI 2.

**This is unglamorous and load-bearing.** The 50-plot ground-truth corpus is the most expensive thing in this PI — realistically 15–20 hours of founder manual portal work over the four sprints. It is also the only thing that makes the other three sprints meaningful. Shortcut to 20 plots and V3/V4 lose statistical force; do not shortcut.

**Hard rules for PI-V:**
- No new features. Zero. Anyone proposing a new data source during PI-V files it in `BACKLOG.md`.
- No multi-district work. Cuttack waits.
- No PID integration. PID stays parallel.
- No refactoring. If a fetcher works correctly but is ugly, leave it.

---

## Sprint V1 (Weeks 11–12) — Input Taxonomy + Ground-Truth Corpus

**User behavior:** *A test runner can enumerate every valid Khordha input combination and the QA harness knows what the right answer is for 50 of them.*

**Build:**
- **Input taxonomy script** (`qa/scripts/enumerate_inputs.mjs`). Uses `KHRDHA_VILLAGES` (1,477 villages) from `packages/fetchers/bhulekh/src/villages.ts` to enumerate ~2,000 (tahasil, village, plot) combinations across all 10 tahasils. Sampled plot patterns: pure numeric, D-prefix sub-plots, fraction, alphanumeric. Output: `qa/khordha_inputs.json`. Deterministic (seeded LCG).
- **Ground-truth corpus scaffold** (`qa/ground_truth/P001/…/P050/`). 50 plot directories, each with `manifest.json` (typed schema) + `transcript.md` (manual verification steps for the founder) + `README.md`. 5 plots pre-filled with verified data; 45 empty scaffolds.
- **Coverage matrix** (`qa/ground_truth/_corpus_coverage.md`). 10 tahasils × 4 BDA zones × 4 kisam classes × 5 plot patterns. Each cell annotated with which plot IDs cover it.
- **Invalid input set** (`qa/invalid_inputs.json`). 24+ known-bad inputs with `expected_error` codes.

**Exit criteria:**
- [x] `qa/khordha_inputs.json` enumerates ≥1,500 valid (village, plot) combinations
- [x] 50 plots have full ground-truth scaffold on disk
- [x] 24+ invalid-input cases documented with expected error
- [x] Coverage matrix shows every (tahasil × BDA zone × kisam × plot-pattern) cell has ≥1 plot
- [ ] 50 plots have full ground-truth data populated (founder manual work)

**Status (2026-06-12):** Scaffold complete. 4,389 valid combinations enumerated. 50 manifests created (5 pre-filled). 617 tests pass. Manual corpus population is founder work spanning V1–V2.

---

## Sprint V2 (Weeks 13–14) — Per-Source Fetcher Contract Tests

**User behavior:** *Every fetcher returns either a typed-correct result matching ground truth, or a typed error — never a silent partial.*

**Build:**
- **Per-fetcher Zod contract schemas** in `apps/web/src/lib/pipeline/contracts/`. Discriminated union over 5 statuses: `ok | no_data | source_down | invalid_input | parse_error`. Carries `{status, data?, error?, fetchedAt, sourceUrl, latencyMs}`. 9 files: bhulekh, bhunaksha, ecourts, igr-ec, cersai, rccms, circle-rate, bda-zoning, nominatim.
- **Golden-path test files** in `qa/fetcher_tests/`. 9 test files, ~496 tests. Each: structural correctness, value correctness (50 plot IDs, SKIPs on missing manifest), negative cases (24 invalid inputs).
- **CERSAI OCR benchmark scaffold** (`qa/fetcher_tests/cersai_ocr/`). 30 captcha slots with manual transcription instructions. OCR accuracy target: ≥85%.
- **Known issues register** (`qa/known_issues.md`). 6 issues (KI-001…KI-006) — RCCMS pipeline stub vs fetcher reality (KI-001), RCCMS schema divergence (KI-002), IGR EC + CERSAI entries not passed to financial exposure (KI-004), LARR unwired, etc.

**Exit criteria:**
- [x] All 8 wired fetchers have Zod contract schemas
- [x] All 8 fetchers have golden-path test files (496 tests pass)
- [x] 9th fetcher (Bhunaksha Plot Report, plotreportOR.jsp) added 2026-06-14 (D-036) — 59 V2 contract tests, P051 live-verified ground truth, ~8s end-to-end
- [x] Per-fetcher accuracy report: % plots where extracted value matches ground truth, by field
- [ ] CERSAI OCR ≥85% captcha accuracy with retry logic
- [ ] All known issues in `qa/known_issues.md` either fixed or have planned fix sprint

---

## Sprint V3 (Weeks 15–16) — Section-Level Pipeline Validation + Degradation Matrix

**User behavior:** *For any of the 50 ground-truth plots, the generated report contains every data point listed in your Section 1–7 inventory, with the right value, or a typed-degraded explanation.*

**Build:**
- **Section data-point inventories** (`qa/section_validators/_inventories.md`). 76 data points across 7 sections, each with HTML source, fetcher source, and degradation tag.
- **Degradation matrix** (`qa/degradation_matrix.json`). 10 fetchers × 4 failure modes = 40 cells. Each cell specifies the typed banner text shown in the report when that failure mode occurs.
- **Section validator tests** (`qa/section_validators/section-*.test.ts`). 7 test files, one per section. Run the pipeline, assert every data point in the section's inventory is either populated correctly or carries a typed degradation tag.
- **Cross-source consistency checks** (`qa/cross_source_validator.test.ts`). Bhulekh village == Bhunaksha village, owner name appears in eCourts, BDA zone matches kisam, etc.
- **LARR honesty analysis** (`qa/larr_honesty.md`). Documents that LARR is unwired in V1.1; recommends honest "not yet integrated" label over stub data.

**Exit criteria:**
- [x] All 7 sections have data-point inventory specs
- [x] Degradation matrix covers all (source × failure mode) combinations
- [x] LARR stub either replaced or honestly labeled
- [x] Cross-source validator surfaces ≥3 inconsistency types
- [ ] All 50 ground-truth plots produce reports where every Section 1–7 inventory data point is correctly populated or correctly degraded

---

## Sprint V4 (Weeks 17–18) — Scale Validation + Invalid-Input Hardening + Production Readiness

**User behavior:** *A buyer entering any valid Khordha input gets a correct report; any invalid input gets an actionable error before the ₹ paywall.*

**Build:**
- **Pre-payment validation gate** (`apps/web/src/lib/validation/pre-payment.ts` + route integration). Hardcoded against the 10 Khordha tahasils and `KHRDHA_VILLAGES` (1,477 villages). Rejects unknown tehsil, unknown village, bad searchMode, garbage plot number, malformed email. Returns HTTP 400 with actionable message.
- **Shadow-mode batch runner** (`qa/shadow_runner.mjs`). Reads `qa/khordha_inputs.json`, calls `/api/report/pregenerate` for each, writes `results.jsonl`. `--limit N` and `--concurrency N` flags. Companion `shadow_runner_report.mjs` produces `coverage_heatmap.md` + `failure_distribution.md` + `slow_plots.md`.
- **Invalid input gate test** (`qa/invalid_input_gate.test.ts`). 33 cases — 26 invalid, 6 valid, 1 corpus fallback. Asserts pre-payment gate returns the right error code per case.
- **CI regression suite** (`.github/workflows/qa.yml`). Runs on PR to main/master + manual dispatch. Two test layers (fetcher contract + section validators), posts single PR comment, uploads `qa-results` artifact on failure. Caches pnpm + node_modules.
- **Production monitoring spec** (`qa/production_monitoring.md`). Per-fetcher success rate, p50/p95 latency, error type distribution. 10pp-over-1h Discord alert. `report_fetcher_metrics` Supabase table + 1h/24h SQL views.

**Exit criteria:**
- [x] Pre-payment validation gate fires on all 24+ invalid inputs
- [x] Shadow runner executes without errors (mechanically complete; 2,000-plot run is founder work)
- [x] CI regression suite green on every PR
- [x] Per-fetcher production dashboards live, alerting configured
- [ ] ≥95% of valid Khordha inputs produce a report where every section either has correct data or typed degradation
- [ ] Held-out 10-plot re-validation: ≥9/10 fully correct

**Status (2026-06-12):** Scaffolding complete and runnable. 33/33 invalid-input gate tests pass. Shadow runner executes against dev server. CI workflow defined. The actual 2,000-plot run is founder work in V4.

---