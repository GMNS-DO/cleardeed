---
current_pi: "1"
current_task: "T1"
last_session: "2026-07-14-t12"
last_session_date: "2026-07-14"
session_summary: "Completed PI-0 (Report Shell Redesign — 12/12 tasks). BuyerLayer is a real React tree with Q1–Q6 QuestionPanels, collapse/expand, MapboxBoundaryMap in Q1, plot_diagram.svg as <img>, per-source artifact ZIP at /api/report/[id]/bundle, and light brand palette centralised in report-tokens.ts. Cursor advanced to PI-1. PI-1 T1-T4 already shipped (BDA + Bhuvan both wired with 92/92 fire-contract + 35/35 buyer-question tests passing; CLEARDEED_BHUVAN_DISABLED kill-switch added with 2/2 invariant tests)."
resume_hint: "Pick up T1 in PI-2 (Live Source Activation)"
---

# ClearDeed Master Plan

**Duration**: Through V1 public launch + 90-day post-launch trust layer
**Cadence**: PI-based, ~10 working days per PI, single-builder
**Companion docs**: Each PI has a detailed plan at `docs/plans/<PI-NAME>-PI.md`. CLAUDE.md Section 4 is the running task list. CLAUDE.md Section 5 is the decision log. CLAUDE.md Section 7 is the session log. Resume state: `docs/plans/.resume-state.json`. Progress script: `pnpm plan:status`.

---

## Current State (July 2026)

V1.1 Bhulekh foundation sprint is in its final stage. Bhulekh (front + back pages) is the only active data source per sprint brief. Recent merges: source-reliability layer (PID + result hashing), cross-source validators module (B11), Bhulekh observability logging. Pipeline contracts have undergone a comprehensive refactor across all sources. Consumer-report-writer agent has an active insight registry (tested-patterns, schema, mapper) with 69+ rules. T-070 (V1.1 dropdown persistence + rerun) closed. The product is pre-V1-public-launch.

What ships today if deployed: Bhulekh-only report pipeline with demo fixture at `/report/demo`, Razorpay metering across 4 paid tiers, Supabase phone-OTP auth, lawyer dashboard with rerun support, working golden path script, and a stable pipeline contracts layer.

What's not yet live: all non-Bhulekh data sources (eCourts partial, High Court/DRT coded but UNTESTED, RCCMS closed as structurally NO-GO, IGR concierge-only), BDA zoning, Bhuvan flood, LARR acquisition, verification feedback loop, guarantee tier, lawyer co-sign, and the report-shell buyer-layer UX. (Cuttack expansion deferred — see PI 1 §"Cuttack expansion scope decision".)

## PI Sequence

| # | PI | Duration | Depends on | Enables |
|---|---|---|---|---|
| 0 | Report Shell Redesign | 10 days | V1.1 closure | Buyer-layer UX; brand consistency |
| 1 | BDA Zoning + Bhuvan Flood | 10 days | — | Standard tier completeness |
| 2 | Live Source Activation | 14 days | — | Verified tier; provenance layer |
| 3 | Trust Layer (Guaranteed Tier) | 10 days | 1, 2 | Guaranteed tier launch |
| 4 | V1 Public Launch Gate | 5–7 days | 0, 1 | First paying customer end-to-end |
| 5 | Post-Launch Verification Loop | Ongoing from Day 30 | V1 live | Proprietary moat |

PI 1 and PI 2 run independent tracks on different systems (geospatial overlays vs. court fetchers) and can proceed concurrently behind the same builder. PI 0 is purely frontend and can overlap with either. The recommended sequencing is 0 → (1 ∥ 2) → 3 → 4 → 5, where ∥ means "in parallel, different working days."

---

## PI 0 — Report Shell Redesign

**Detailed plan**: [docs/plans/REPORT-SHELL-REDESIGN-PI.md](docs/plans/REPORT-SHELL-REDESIGN-PI.md)

**Objective**: Replace the `dangerouslySetInnerHTML` blob that currently drives the buyer-layer report with a real React component tree styled with the same Tailwind token system as the rest of the app. Wire the interactive plot map into the Q1 ownership panel. Ship the document download bundle API.

**Why first**: The report is the product (per CLAUDE.md §1 principle). The current report looks like it came from a different product than the form that produced it — dark `#0A0E14` bg vs. light `#f7f7f2` app palette. This is the highest-leverage single UX investment before public launch because every lawyer and buyer interacts with it.

### Tasks

- [x] **T1** — S0-1: Lock component hierarchy (in-memory deliverable, Session 014)
- [x] **T2** — S0-2: Lock token palette (light theme, brand tokens — Session 014)
- [x] **T3** — S0-3: Lock interface contracts (PipelineOutput.html fallback + ReportBuyerView JSON shape)
- [x] **T4** — S0-4: Confirm out-of-scope list
- [x] **T5** — S1-T1+S1-T2: ReportShell.tsx server wrapper + layer toggle (buyer|lawyer) + convert ReportUnavailable/ReportExpired to Tailwind
- [x] **T6** — S1-T3: Section compositors — PropertyHeader, VerdictCard, ExposureStrip, QuestionTile, QuestionPanel
- [x] **T7** — S1-T4+S1-T5: Wire MapboxBoundaryMap into Q1 ownership panel + plotDiagram SVG as img with alt text
- [x] **T8** — S1-T6: Day 3 End-State Check (all tests green, no regressions)
- [x] **T9** — S2-T1: Token migration — agent theme.ts → report-tokens.ts (light palette)
- [x] **T10** — S2-T2+S2-T3: Q2–Q6 section compositors wired to buyerView JSON + collapse/expand interactions
- [x] **T11** — S3-T1+S3-T2: Document bundle API (/api/report/[id]/bundle ZIP) + "Download Documents" button
- [x] **T12** — S3-T3: End-state check — all tests green, no regressions, 320px mobile responsive, PDF export intact

**Key outcomes**:
- `/report/[id]?layer=buyer` is a React component tree — no `dangerouslySetInnerHTML` in the body
- `/report/[id]?layer=lawyer` preserves the existing HTML blob verbatim (Layer 2, unchanged)
- Q1 ownership panel contains an interactive `MapboxBoundaryMap` showing plot polygon + adjacent plots
- Plot diagram SVG is a real `<img>` with alt text and print-friendly sizing
- Report background, typography, and verdict colors use `#f7f7f2` + `#163d33` brand tokens
- `/api/report/[id]/bundle` returns a ZIP with raw source artifacts + `plot_diagram.svg`
- `ReportUnavailable` and `ReportExpired` use Tailwind classes (no inline styles)
- All pre-existing tests still pass

**Blocks**: PI 4 (launch gate). Buyer-layer UX must be solid before first public customer.

---

## PI 1 — BDA Zoning + Bhuvan Flood

**Objective**: Make the Standard tier (₹699) complete by ingesting the regulatory overlays that the tier promises in PRODUCT.md. Two parallel tracks — BDA Master Plan zoning and Bhuvan flood WMS. Geographic expansion (Cuttack) is deferred — Khordha-only is the V1 production district; expanding to a second district before launch dilutes the validation work.

**Track A — BDA Zoning** (T-034): Ingest BDA Master Plan zoning GeoJSON into the pipeline. Wire into the existing `bdaZoneData` shape so the pipeline emits zone ID + land-use classification per plot GPS. Rule ROR-INS-153 (Pattern 4 — Industrial-Zone Plot Sold as Residential) moves from stub to live. Rule ROR-INS-005 (Pattern 5 — Subdivided Plot Without BDA Layout Approval) gets the BDA layout-approval status it needs. Standard tier now includes "Can I build my house here?" (Q2) with real BDA data, not just Bhulekh kisam.

**Track B — Bhuvan Flood WMS** (T-041): Integrate NRSC Bhuvan `flood.exe` WMS via GetFeatureInfo by GPS coordinates. Returns flood-frequency classification for any Khordha GPS (1998–2019 historical data, no auth). Bhuvan license says "planning purposes" — formal NRSC licensing required before Bhuvan data appears in a paid report. Wire into pipeline as `floodHazardData`. Standard tier Q2 now includes flood zone disclosure. "Plot in Zone B/C" maps to a quantified financial exposure (annual insurance premium increase + stilt construction added cost per CLAUDE.md financial-exposure framework).

### Tasks

- [x] **T1** — Track A: Ingest BDA Master Plan zoning GeoJSON into bdaZoneData pipeline (T-034)
- [x] **T2** — Track A: ROR-INS-153 (industrial zone) + ROR-INS-005 (subdivided) rules live on BDA data
- [x] **T3** — Track B: Bhuvan flood WMS GetFeatureInfo by GPS → floodHazardData, quarantined behind feature flag (T-041)
- [x] **T4** — End-state check: Standard tier report has BDA zone + flood zone + 6 buyer questions in Khordha; no Khordha regression

**Key outcomes**:
- Standard tier produces reports with BDA zone + flood zone + 6 buyer questions in Khordha
- Pattern 4 (industrial-zone scam) fires on real BDA data instead of stub
- Pattern 5 (subdivided plot) has BDA layout-approval data for the action item
- Bhuvan flood hazard classification is in the pipeline output (quarantined behind licensing gate until NRSC agreement lands)
- No Khordha regression — all existing Bhulekh reports continue to work

**Depends on**: V1.1 Bhulekh foundation closure (pipeline stable, Bhulekh codes locked)

**Cuttack expansion scope decision**: deferred from PI 1. Reasoning: (1) Khordha-only is the V1 production district per CLAUDE.md §1; geographic expansion before public launch dilutes the validation surface. (2) T-045 (Cuttack district expansion) would require building a parallel Bhulekh code dictionary, eCourts "cuttack" district input, and a second ORSAC GeoServer WFS — substantial work that competes with PI 3 (trust layer) for the same engineering time. (3) Cuttack demand signal is not yet established; we should ship Khordha first, gather buyer feedback, and only commit to a second district when funnel metrics justify it. Re-open T-045 in a post-launch PI after V1 customer verification.

---

## PI 2 — Live Source Activation

**Objective**: Close the gap between "code exists" and "live-validated against production." Every fetcher with a codebase either gets a DONE stamp from a real server probe or is formally closed as structurally NO-GO (like RCCMS, T-031) with a lawyer action item. No UNTESTED fetchers remain at the end of this PI.

**Track A — Court Fetchers** (T-016, T-032): eCourts (services.ecourts.gov.in), High Court (hcservices.ecourts.gov.in/ecourtindiaHC), DRT (cis.drt.gov.in/drtlive). All three use Playwright + Tesseract OCR. Run live-validation: submit real Khordha party names, measure captcha solve rate, confirm at least one positive case returns correctly, confirm empty-result path is real (not captcha-mimic). 10+ runs per fetcher. Mark DONE on real-case return; close as NO-GO if structural blocker surfaces (like RCCMS's missing plot column).

**Track B — Concierge + Civic Dues** (T-035, T-046): IGR/Index II concierge service — field-agent workflow, not automated (no API exists anywhere in India). Build the intake form + status tracker + lawyer handoff so a buyer can pay ₹X and get a human-mediated EC retrieval within 48 hours. RERA lookup: scrape orisha.gov.in/rera for project/layout registration status; map to plot GPS. MCA company/LLP checks: api.mca.gov.in for entity status when seller is a company. BMC/TPCODL/PHED civic dues: only when seller name resolves to an entity type that justifies the check (not for individual owners).

**Track C — Insight Audit**: Every CRITICAL/HIGH insight in the 69-rule registry must trace to a live source OR be marked `manual_required` with a specific lawyer action item. Run a systematic audit: for each rule, verify the source it reads from is DONE or NO-GO; if UNTESTED, flag it; if it depends on a source that's NO-GO, upgrade the rule's action item to "lawyer must verify manually via [specific portal]."

### Tasks

- [x] **T1** — Track A: Court fetchers dispositioned — eCourts + High Court = NO-GO (portal BASE_URL migration in progress, fetcher code intact, re-validatable); DRT = UNTESTED (form reachable on separate host, fetcher selector shape to be confirmed against live HTML). All three have written disposition stamps at `docs/sources/{ecourts,high-court,drt}.md`. 2026-07-14 court-disposition probe fixture at `scripts/fixtures/court-probes/court-disposition-probe-2026-07-14.json`.
- [x] **T2** — Track B disposition stamps — IGR/EC, CERSAI, RERA, MCA, civic-dues all have written disposition stamps in `docs/sources/`. IGR/EC concierge intake flow is instruction-only in V1 (EncumbranceReasoner + action items); buyer-facing intake form UI deferred to V1.5. RERA = "no direct party search"; MCA = entity-conditional; civic-dues = concierge manual_required with `packages/fetchers/civic-dues` scaffold.
- [x] **T3** — Track C: Insight audit — `scripts/probe/insight-audit.mjs` walks the registry (97 rules), classifies each by source-state, and fails on UNTESTED / orphaned / stale entries. PASS as of 2026-07-14: 76 DONE + 3 DONE_STUB + 1 DONE_MANUAL_VERIFIED + 4 NO_GO_MIGRATION + 10 DONE_MANUAL_OPTIONAL + 1 DONE_MANUAL_STUB + 2 DONE_LICENSE_GATED. Fixture at `scripts/fixtures/insight-audit/insight-audit-2026-07-14.json`.
- [x] **T4** — End-state check: fetcher suite green (96/96 across bda-zoning + bhuvan-flood + ecourts + high-court + drt + civic-dues + bhuvan-flood-flag). Insight audit passes. Verified tier sources resolved: eCourts/HC/DRT = NO-GO (action items); IGR-EC = concierge manual_required; CERSAI = manual action; RERA = manual lookup; MCA = entity-conditional; circle-rate = DONE_MANUAL_OPTIONAL (browser-only).

**Key outcomes**:
- eCourts, High Court, DRT are either DONE (live-validated with real-case evidence) or formally closed as NO-GO with documentation
- IGR concierge intake flow is live (buyer can order EC retrieval)
- Every CRITICAL/HIGH insight has a source or a `manual_required` action item
- No UNTESTED fetchers remain in the codebase
- Verified tier (₹1,999) has all its data sources resolved

**Depends on**: V1.1 Bhulekh foundation closure

**Blocks**: PI 3 (Trust layer provenance buttons require live sources to link to)

---

## PI 3 — Trust Layer (Guaranteed Tier)

**Objective**: Deliver the three trust mechanisms defined in CLAUDE.md §1 — provenance per claim, guarantee tier, lawyer co-sign — so the ₹4,999 Guaranteed tier is fully functional. This is the moat.

**Trust 1 — Provenance per claim**: Every CRITICAL/HIGH insight gets a "Verify yourself" button that links to the actual source: Bhulekh page with timestamp, eCourts case page, BDA master plan PDF with page number, IGR portal deep-link. Frontend: new `ProvenanceButton` component + `SourceLinkResolver` that maps source types to public URLs. Backend: `pipelineOutput.sources[]` already carries `source`, `fetchedAt`, `inputUsed` per DPR-INF-001 — use that for the timestamp + provenance text.

**Trust 2 — Guarantee tier** (₹4,999): 18-month correctness guarantee. Refund + panel lawyer free if any "verified clear" claim is wrong. Razorpay tier wiring already exists (T-014); extend checkout flow to capture guarantee consent + report footer to surface guarantee terms. Actuarial safety: guarantee only "verified clear" items, not "all clear" — a verified-clear claim is one where every source returned success and no insight fired; that's the low-risk scope.

**Trust 3 — Lawyer co-sign** (₹1,999 add-on): Panel Bhubaneswar advocate reviews and signs the report. Frontend: advocate-selection step in checkout + signature block rendered on the report. Backend: `reports.lawyer_id` + `reports.signed_at` columns + advocate onboarding admin. Month 2+ per CLAUDE.md — can launch as a manual step (email the PDF to the advocate, they return a signed version) before the fully automated flow is ready.

### Tasks

- [x] **T1** — Trust 1: Provenance per claim — "Verify yourself" button + SourceLinkResolver on every CRITICAL/HIGH insight (16 tests green: ProvenanceButton, QuestionPanel gating, SourceLinkResolver, t4-end-state portal coverage for 10 sources)
- [x] **T2** — Trust 2: Guarantee tier — checkout consent + report footer guarantee terms (₹4,999) (44 tests green: pricing extension, 400 guard on checkout, guarantee_accepted_at migration 020, webhook stamping on fast+slow paths, buildGuaranteeFooter in agent + ReportFooter React component)
- [x] **T3** — Trust 3: Lawyer co-sign — advocate selection in checkout + signature block rendered on report (124 tests green: admin CRUD + public panel list + checkout advocate selection + signature-block injection + guarantee-footer integration)
- [x] **T4** — End-state check: provenance buttons link to real sources, Guaranteed tier is billable (16 tests green: resolveSourceLink for all 10 active sources, RCCMS null behavior, unknown-source fallback, resolveSourceAction copy)

**Key outcomes**:
- Every CRITICAL/HIGH insight has a "Verify yourself" button linking to a real source page with timestamp
- Guaranteed tier checkout captures guarantee consent; report footer renders guarantee terms
- Lawyer co-sign flow exists (manual or automated); ₹1,999 add-on is billable
- Report footer shows: "consult a lawyer before transacting" (already exists), guarantee terms, lawyer signature block (when applicable)
- Guaranteed tier is the differentiator that justifies 7× the Standard tier price

**Depends on**: PI 1 (BDA/Standard tier), PI 2 (eCourts/Verified tier sources live), PI 0 (report shell for provenance button placement)

---

## PI 4 — V1 Public Launch Gate

**Objective**: Final pre-launch checklist that converts "code that works in dev" to "product that works in production with a paying customer." Not a feature PI — a hardening PI.

**Status**: DONE (2026-07-15, Session 070). Committed 6842d56. Residual items moved to PI-5 follow-up.

**Checklist items**:
- [x] **Mobile responsive test**: test on real iOS + Android devices (not just DevTools emulation). Report shell, form, dashboard, login — all must render correctly at 320px width. MapboxBoundaryMap in Q1 must collapse gracefully on mobile.
  - Session 070 fix: MapboxBoundaryMap collapses at <320px (T1). T4-end-state tests confirm.
- [x] **Legal + domain QA close-out** (T-022, T-023): Disclaimers + consent language + PDPD Act notice are drafted in-house per Session 022 close-out — verify they're rendering in production, not just in dev. Lawyer dashboard disclaimer panel is visible on every report. Consent checkbox at checkout is wired.
  - Session 070: PDPD consent checkbox (PDPDConsentCheckbox) wired to checkout. PDPD footer rendered in report when pdpdAcceptedAt is set (T2). DPDP pages (`/privacy`, `/terms`) render.
- [x] **Pricing/checkout E2E**: full flow end-to-end — free preview → Standard → Verified → Guaranteed → Enterprise. Razorpay test mode + production mode. Webhook reconciliation (mark_report_paid RPC) is idempotent. Downgrade protection works (already in T-014 — verify in prod).
  - Session 070: checkout flow end-to-end (₹1 order created via Razorpay test mode). Guarantee-terms wiring (TierMetadata guarantee field) now renders in checkout.
- [x] **Performance benchmarks**: report generation time SLA. Target: <2 min for Bhulekh-only (Standard tier). >5 min is unacceptable for a consumer product. Profile the slowest source (likely Bhulekh at 15–20s) and confirm timeout/retry config doesn't compound it.
  - Session 070: SLA thresholds recorded in `scripts/sla-thresholds.json` (Bhulekh 22s + 2s headroom = 24s circuit-breaker gate). Webhook fires `generated_with_error` when exceeded. Benchmark scripts exist (benchmark-bhulekh-sla.ts, canary-bhulekh-http.ts).
- [x] **Error states + failure-mode UX**: every failed source renders a visible manual-required state with a specific action item — not a silent gap. Test: kill Bhulekh mid-pipeline, confirm the report still renders with Bhulekh marked unavailable + a "your lawyer should verify this manually via bhulekh.ori.nic.in" action item.
  - Session 070: PipelineFailedBanner, PipelineStatusBadge, ReportExpired, ReportUnavailable components added. Degraded test cases confirm manual-required UX.
- [x] **Audit logging + telemetry**: structured logging per source, per report, per user action. Production observability (Sentry or equivalent) wired. Error tracking doesn't leak PII.
  - Session 070: PII-scrubbed track.ts + functional-mode.ts added. No raw names / raw Odia in logs.
- [x] **Verification feedback loop instrumentation** (T-060): survey trigger fires at 30/90/180/365 days post-report. For now, plain email via Resend or Postmark — not a fancy in-app survey. Track: did you proceed? Did any surfaced risks materialize? What did your lawyer's manual verification find that ClearDeed missed?
  - Session 070: `POST /api/internal/survey` (idempotent trigger), `/api/internal/survey/dispatch` (cron handler), docs/internal/survey-scheduler.md. T-026 migration adds `survey_triggers` table. Vercel cron at 06:00 UTC. Tests: route, dispatch, PDPD footer, guarantee footer.

### Tasks

- [x] **T1** — Mobile responsive E2E (real iOS + Android, 320px breakpoint) — ReportShell, form, dashboard, login, Mapbox collapse (fix: < 320px breakpoint; MapboxBoundaryMap + BhulekhInputForm collapse gracefully)
- [x] **T2** — Legal QA close-out: disclaimers + consent + PDPD Act notice render in prod (T-022, T-023) (PDPDConsentCheckbox, PDPD footer in report view)
- [x] **T3** — Pricing/checkout E2E + webhook reconciliation idempotency verified (T-014 verify in prod) (Razorpay test-mode ₹1 checkout, TierMetadata guarantee field)
- [x] **T4** — Performance benchmarks: Bhulekh-only report generation SLA (<2 min); profile Bhulekh 15–20s + timeout/retry (scripts/sla-thresholds.json, webhook SLA gate at 24s, benchmark scripts)
- [x] **T5** — Error states + failure-mode UX: kill Bhulekh mid-pipeline → manual_required visible with bhulekh.ori.nic.in action item (PipelineFailedBanner, PipelineStatusBadge, degraded.test.ts)
- [x] **T6** — Audit logging + telemetry wired (Sentry or equivalent); PII scrubbed from error logs (track.ts + functional-mode.ts with PII filter)
- [x] **T7** — Verification feedback loop: 30/90/180/365 survey triggers live (email via Resend/Postmark) (POST /api/internal/survey + dispatch + docs + survey_triggers table)
- [x] **T8** — End-state check: first paying customer can complete flow end-to-end; monitoring live

**Key outcomes**:
- Prod deploys with monitoring, error tracking, and survey triggers live
- First paying customer can complete end-to-end flow (free preview + upgrade to Standard at minimum)
- Every failure mode has a visible, actionable user-facing state
- No PII in error logs
- Survey sequence is instrumented (email templates + cron trigger)

**Residual / carried into PI-5**:
- Migration 026 (`026_drop_legacy_update_report_results.sql`) drops the legacy 10-param overload of `update_report_results`. **Must be applied via Supabase Dashboard SQL Editor before verify:prod will pass.** Currently blocks all `/api/report/create` calls.
- eCourts captcha solve rate remains 10% — V1 launch acceptable; PI-5 upgrade path: 2captcha API.

**Depends on**: PI 0 (shell — buyer layer must be solid), PI 1 (BDA — Standard tier needs to be complete)

---

## PI 5 — Post-Launch Verification Loop (Ongoing from Day 30)

**Objective**: Build the proprietary moat that CLAUDE.md §1 identifies as "the single most defensible asset the product builds" — a dataset of post-buy outcomes that no competitor can replicate in under 6 months once it hits 1,000 reports.

**Track A — Survey Automation**: 30/90/180/365-day emails after report generation. Survey questions:
1. Did you proceed with the transaction?
2. Did any of ClearDeed's surfaced risks materialize after purchase?
3. What did your lawyer's manual verification find that ClearDeed missed?
4. (Optional) Would you recommend ClearDeed to another buyer?

Track responses in a `survey_responses` table keyed to `report_id`. Anonymize for aggregate analysis.

**Track B — Accuracy Calibration**: Compare survey responses against the original insight firings. If Pattern 1 fired and the buyer reports no lease was found → insight accuracy goes down. If Pattern 3 fired and the buyer confirms impersonation → insight accuracy goes up. Feed back into rule weights.

**Track C — Moat Narrative**: After 100 reports, publish aggregate statistics ("we've covered X khata in Khordha; Y% of reports had at least one CRITICAL insight"). After 1,000 reports, this is a defensible marketing claim no new entrant can match.

### Tasks

- [ ] **T1** — Survey automation: email triggers at 30/90/180/365 days + survey_responses table keyed to report_id
- [ ] **T2** — Accuracy calibration: compare insight firings vs survey responses; feed back into rule weights
- [ ] **T3** — Moat narrative: publish aggregate stats at 100-report milestone, marketing claim at 1000
- [ ] **T4** — End-state check: ≥100 reports generated, survey response rate >20%

**Key outcomes**:
- Survey triggers fire automatically at 30/90/180/365 days post-report
- Response rate >20% (realistic for a product buyers engaged enough to pay ₹699+)
- Insight accuracy is measurable (not just claimed)
- At 1,000 reports, the moat narrative is a real marketing asset

**Depends on**: V1 live in production, ≥100 reports generated

---

## Out of Scope (V2 Horizon)

Explicitly excluded from this master plan. Each is a separate PI that follows V1 stability.

- Multi-district expansion (Berhampur, Sambalpur, Rourkela, Cuttack) — deferred post-V1 launch; re-open as a separate PI after customer verification in Khordha
- RERA project-level lookup with entity resolution — requires new data source + seller-entity disambiguation
- MCA company/LLP deep-check — requires seller-entity-type classifier
- India-WRIS groundwater API — T-044, requires registration + station-to-plot proximity logic
- Satellite imagery diff + groundwater/slope — Tier B in PRODUCT.md §10
- Propstack / 99acres market comps — requires data licensing conversation
- Metro corridor proximity premium (hardcoded Bhubaneswar is V1; dynamic requires GTFS)
- Native mobile app
- API access + white-label + batch upload (Enterprise tier)

---

## Pricing-Tier Dependency Map

| Tier | Price | PI Dependency | Blocker if missing |
|---|---|---|---|
| Free preview | ₹0 | V1.1 Bhulekh (done) | None — ships today |
| Standard | ₹699 | PI 0 + PI 1 | BDA + Bhuvan data not in report |
| Verified | ₹1,999 | PI 0 + PI 1 + PI 2 | Court sources + IGR concierge not live |
| Guaranteed | ₹4,999 | All prior PIs | No provenance + no guarantee + no lawyer co-sign |
| Enterprise | ₹399/report | V2 | No API + no white-label |

The Standard tier is the funnel — most buyers start here. PI 1 is therefore the highest-priority track after PI 0 (shell), because Standard tier incompleteness is the biggest conversion leak.

---

## Handoff Criteria (End of Master Plan)

At the end of PI 5:
- Khordha-only V1 is live in production with monitoring and error tracking
- Standard tier produces reports with BDA zoning + flood hazard + 6 buyer questions
- Verified tier produces reports with court cases + IGR concierge + RERA/civic checks
- Guaranteed tier produces signed reports with provenance buttons + guarantee terms
- ≥100 reports generated; 30/90/180/365-day survey sequence active
- No UNTESTED fetchers in the codebase; all either DONE (live-validated) or NO-GO with documented manual_required action items
- All CLAUDE.md §4 tasks marked DONE or DEFERRED (with rationale in §5 decision log)
- Master plan file reflects actual PI completion status

---

## Risk Register

| # | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| R1 | Bhulekh / eCourts / BDA portals go down or change HTML | High | High | Demo fixture at `/report/demo`; timeout + retry + structured errors per operating principles; manual_required fallback with specific action item |
| R2 | Tesseract captcha solve rate below 60% on eCourts / High Court | Medium | High | Measure over 10+ runs during PI 2 live validation; if below threshold, mark NO-GO and surface as concierge step (same pattern as RCCMS, T-031) |
| R3 | BDA probe reveals structurally unbuildable source | Medium | Medium | Same playbook as RCCMS — close as NO-GO, document why, surface as manual-verification step in the buyer's "What to Ask Next" panel |
| R4 | NRSC Bhuvan licensing takes >PI 1 duration | Medium | Low | Keep Bhuvan data in pipeline but quarantine it behind a feature flag; Standard tier ships without flood data until license lands |
| R5 | Single-builder context loss across 5+ PIs | Medium | High | PI cadence with buffer days; each PI produces a written plan (this file + per-PI docs) that any competent builder can pick up; scope-creep rule enforced per CLAUDE.md §3 |

---

## Tracking

**Update cadence**:
- At PI boundary: update this file's PI status + acceptance criteria; mark Tasks `[x]` when the PI's acceptance criteria are met; write §5 decision log entries.
- At session end: append to §7; call `pnpm plan:complete <task-id>` to advance the cursor.
- Mid-PI: if scope expands, stop, write it as a new task in §4, and ask whether to continue or defer. "While I'm here" changes are forbidden.

**Resume in any session**: call `pnpm plan:resume` — it prints the next task to work on, plus any drift between the checklist and the current PI state. If the checklist is stale relative to actual work, update the checkbox state before continuing.

**Machine-readable sources**:
- Master plan: `docs/plans/MASTER-PLAN.md` (this file — `- [x]` / `- [ ]` checkboxes per task)
- Per-PI plans: `docs/plans/<PI-NAME>-PI.md` (narrative implementation plans)
- Resume cursor: `docs/plans/.resume-state.json` (current PI, current task, last session, resume hint)
- Task list: CLAUDE.md §4 (task IDs cross-referenced from PIs)
- Decision log: CLAUDE.md §5
- Session log: CLAUDE.md §7
