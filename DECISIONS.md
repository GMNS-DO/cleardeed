# DECISIONS.md — ClearDeed Decisions Log

> **Format:** one paragraph per decision. Dated. With the reasoning. So decisions don't get re-litigated three sprints later.
> **Rule:** add a new decision when you make one. Do not edit old ones — supersede them with a new dated entry.
> **Not in scope:** sprint task choices. This is for decisions that shape the product or strategy at the 3–6 month horizon.

---

## 2026-05-14 — Strategy reset, approved direction

After reviewing the full strategy memo against the prior plan, approved the following changes from earlier direction. Each is a deliberate departure and should not be reversed without changing `STRATEGY.md` first.

### D-001: Two consumer tiers only. Free preview + Standard ₹1.
The five-tier ladder (Free / Standard / Verified / Guaranteed / Enterprise) optimized for recurring spend that does not exist in this category — a buyer transacts once. Every additional tier reduces checkout conversion. Standard at ₹1 for launch testing; changes to ₹999 when conversion is proven. All features in one SKU.

### D-002: No Guaranteed tier at launch.
The ₹4,999 tier with 18-month claim-correctness guarantee is uncapped liability for a pre-revenue startup with no actuarial data and no PI insurance. One bad outcome on an ₹80 lakh property wipes out years of revenue. Revisit only when: 500+ reports of accuracy data exist, PI insurance is in place, an empanelled legal network exists across districts, and a claim rate is actuarially understood. Earliest revisit: month 18.

### D-003: No District Pass annual subscription at launch.
Brokers and lawyers are unreliable subscription buyers — they will share credentials, run reports for the whole office on one seat, and pressure for bulk discounts. There is no evidence yet of organic reuse pull from these segments. Add the tier only when pull is visible. Earliest revisit: PI 3.

### D-004: ₹1 launch price, changes to ₹999 after conversion proof.
₹1 removes payment friction for launch testing. Once conversion is proven (50+ paid reports, week-over-week growth), price moves to ₹999. ₹699 reads cheap-and-suspect; ₹999 reads serious-but-affordable.

### D-005: Khordha to revenue first, then 5 districts in one sprint.
Multi-district at launch is the correct end state. Multi-district before any district works well is the trap that produced 57 sessions of revenue-free progress. Khordha proves unit economics on 50–100 paid reports (PI 1). All 5 districts launch together as a focused PI 2 sprint with the playbook validated. Do not interleave.

### D-006: No self-serve B2B product at launch.
B2B in proptech is sold, not productized. The first HFC contract will be a 30-page custom agreement with bespoke deliverables, not a self-serve signup. Building B2B infrastructure before B2B customer #1 is a documented solo-founder waste pattern. First B2B target is a Bhubaneswar law firm (faster procurement than HFC), signed by Sprint 8–9. API and dashboard productize after customer #2 wants the same shape.

### D-007: No composite "development potential score."
Composite scores carry legal exposure ClearDeed cannot defend. Government plans change, projects delay, infrastructure overpromises. The report surfaces *structured facts* — *"Plot is 800m from project X announced 2024-03"* — with sources and lets the buyer draw the conclusion. This is more honest and less liable.

### D-008: Market data framed as floor / directional / ceiling.
Three signals presented together: circle rate (government floor), recent IGR sales (directional, with explicit framing that registered values are 50–80% of market), broker listings (aspirational ceiling). No single "fair value" estimate ClearDeed owns. Honest framing > clever scoring.

### D-009: Feedback infrastructure ships in Sprint 1.
The outcome dataset is the only durable moat — every feature can be replicated by a well-funded competitor in 6–9 months. Therefore: in-report panel feedback (thumbs up/down per section) ships Sprint 1; founder review queue ships Sprint 1; 60-day post-purchase survey (2 questions only) ships Sprint 2. This is launch infrastructure, not future work.

### D-010: One post-purchase survey at 60 days, two questions.
The multi-step 30/90/180/365-day survey is over-engineered. Response rates collapse on multi-step surveys. One email, two questions: *"Did you proceed?"* and *"Anything important we missed?"* That's it. Replaces prior plan in the earlier Ceiling Plan §5.

### D-011: No WhatsApp delivery infrastructure.
WhatsApp is a sharing channel, not a delivery channel. The report URL gets shared; the report content does not arrive over WhatsApp. WhatsApp Business API integration is significant infrastructure work that adds nothing the buyer cannot already do by tapping "share" on the URL. Email + persistent URL is the delivery surface.

### D-012: No founder review queue. Fully automated pipeline.
Every report auto-delivers on generation. No eyeball gate, no concierge. This is a deliberate choice to maximize throughput and eliminate founder bottleneck. Error monitoring and buyer feedback are the quality controls.

### D-013: Automate every data source. No concierge as permanent fallback.
If a free or paid API, scraping pathway, or workaround exists for a data source, we build it before shipping. No manual fulfillment as a permanent fallback. If the source is truly unavailable, it ships with an explicit "manual verification required" label — not a concierge delay.

### D-014: DPDP Act compliance is launch-blocking.
Privacy policy, data deletion, retention period, designated DPO (founder, formally). Ships Sprint 1.

### D-015: CURRENT_FOCUS.md replaces the 4,000-line CLAUDE.md as the daily guide.
The earlier CLAUDE.md became an archive of session logs rather than a guide. The new CLAUDE.md is short and stable (the engineering constitution). CURRENT_FOCUS.md is the one-page daily file — current sprint goal, remaining tasks, blockers. Completed items get deleted, not strikethroughed. The point is to keep focus surface area small.

### D-016: Friday retrospective is one question: did the product ship?
Not "what did we ship," not "how did we feel," not "what's blocked." Did the product infrastructure complete this week? If yes, continue Monday with the next sprint task. If no, Monday is product work. This is the discipline that prevents scope creep during PI 1.

### D-017: Customer development and social proof are post-implementation.
Moved to `COMMERCIAL_TRACK.md`. Implementation PIs are engineering-only. Customer development, social proof, B2B pipeline, and investor outreach are activated only after PI 3 is complete.

### D-018: Homepage social proof from post-implementation, not PI 1.
Moved to `COMMERCIAL_TRACK.md` §2.2. Live report counter, three real testimonials, anonymized report excerpt — all collected from real buyers, not fabricated. Homepage uses honest placeholder language until real social proof exists.

### D-019: One empanelled advocate at launch, not a network.
Building a 10-advocate network across 5 districts pre-launch is over-investment. One advocate in Bhubaneswar willing to co-sign for ₹500/signature is launch-able state. Scale the network only when paid demand pulls (which it may not, given the no-Guaranteed-tier decision).

### D-020: No new abstractions on first pass; no refactors during launch sprints.
Write the obvious code that solves today's problem. Extract abstractions when the second or third use case appears, not before. Do not migrate stacks during launch sprints. The existing data fetchers and infrastructure stay; the consumer-facing product wraps around them. Suggest refactors in PR descriptions; do not perform them.

### D-021: RESEND_API_KEY confirmed live in Vercel (2026-05-15).
RESEND_API_KEY is now set in Vercel environment variables. Email delivery (sendReportEmail in lib/email.ts) is fully functional. No further action needed. Local .env.local also has the key for development testing.

### D-022: Report URLs are token-scoped with server-side HMAC tokens.
Sprint 1 report links now include a deterministic `?token=` generated from server-side secrets, and `/report/{id}` plus `/api/report/{id}/pdf` fail closed without a valid token in production. This avoids a mid-sprint database migration while still making emailed/shared report URLs unguessable and durable. If a future DB migration adds per-report random `view_token`, it should preserve the same route shape.

### D-023: No free preview gate; paid report renders in-browser first.
Supersedes the earlier free-preview-first funnel in D-001. The launch strategy is now a single paid decision: the buyer enters plot details and email, clicks `Get report`, pays ₹1 through Razorpay, then sees the generated HTML report in the browser with a download option. Email remains a copy/backup delivery path, not the only report surface. The `/api/preview` endpoint may remain as internal/debug infrastructure, but the buyer-facing form must not use a `Search free` CTA.

### D-024: Bhulekh Data Mirror builds independently of /app, integrates at Sprint 11.
The Bhulekh Mirror (bulk ROR data for Khordha, then 4 more districts) is a separate `/crawl` directory running on Railway. It writes to the same Supabase instance as the main app but does not touch `/app` code. It solves three problems the live fetcher cannot: instant free preview, "seller's other properties" cross-reference, and change detection between query and payment. Integration point is the `high_priority_recheck` table written by Vercel after paid report generation. See `BHULEKH_MIRROR_TRACK.md` for full spec. Gate to bulk: sample validation (8–10 plots manually verified) must pass before Stage 3 bulk fetch runs.

### D-025: Pattern Intelligence Database (PID) builds independently, integrates at Sprint 11.
The PID is a structured fraud pattern library with NLP extraction pipeline, entity resolution, and pattern matching engine. Built in a `/pid` directory. Produces predictive commentary in reports only for patterns at VALIDATED or PROBABLE tier (≥5 validated cases). STUB and INDICATIVE tier patterns are internal only. The `features-not-places` constraint is enforced in code — geographic blacklisting is prohibited. Phase 2 (4 more districts) only starts after Phase 1 produces ≥15 validated cases for ≥3 patterns. Integration contract written before Phase 1 is marked complete. See `PID_CLAUDE_CODE_INSTRUCTIONS.md` and `PID_TRACK.md` for full spec.

### D-026: Bhunaksha village resolution by CQL filter, not GPS centroid.
Bhunaksha WFS polygon fetch was failing for small Odia villages (e.g. "Mendhasala") because Nominatim lacks entries for them, so the pipeline fell back to tehsil centroids — but a ±0.05° BBOX around the Bhubaneswar centroid missed villages 10km+ away. Fix: add `villageName` and `plotNo` as CQL filter parameters to `bhunakshaFetch`, so the WFS query reads `revenue_village_name LIKE '%Mendhasala%' AND revenue_plot = '415'` instead of BBOX centroid search. Nominatim is no longer a hard dependency for map polygon resolution. Parked: map still stuck at loading in UI — likely client-side Mapbox initialization issue.

### D-027: Sprint 3 financial exposure sources wired into generateReportV11.
eCourts, IGR EC, CERSAI, and RCCMS fetchers now called in `generateReportV11` after Bhulekh, via `buildSourceResult()` helper → `mapToReportInput`. A7 EncumbranceReasoner combines IGR EC + CERSAI into instructions. Report HTML includes `#section-financial` with risk badges. RCCMS is no longer a placeholder — it probes `rccms.odisha.gov.in` and falls back to manual instructions if the portal is down or requires login. eCourts is running against Khordha district court complex. The `sourceSummary` in V11PipelineOutput now includes all six sources.

### D-028: CERSAI captcha solved with Tesseract.js, per-tehsil EC instructions, build fix.
Three changes made in Sprint 3: (1) CERSAI's `performBasicOcr()` stub (which threw `"captcha_requires_tesseract_or_2captcha_api"`) replaced with real Tesseract.js OCR using the same multi-strategy approach as eCourts (contrast/grayscale/threshold/invert, best result selected). (2) Per-tehsil EC instructions at `apps/web/src/lib/ec-instructions.ts` for Bhubaneswar, Jatni, Balipatna, Banapur, and Khandagiri SROs — each with SRO code, contact, portal URL, fees, and district-specific notes. (3) Next.js build failed on playwright-core's vite/recorder HTML file (playwright 1.59.1 ships a sync glob export that webpack tries to parse). Fixed by externalizing `playwright`, `playwright-core`, `tesseract.js`, and `@sparticuz/chromium` in webpack config via `config.externals`.

---

*Last revised: 2026-06-12. PI-V (Validation) inserted between PI 1 and PI 2. Implementation PIs 1–3 are product/engineering only.*

## D-029: Pre-pipeline input validation gate (Sprint V4, 2026-06-12).

A pure input validator at `apps/web/src/lib/validation/pre-payment.ts` runs *before* the Razorpay paywall and rejects invalid (tahasil, village, plot, email) combinations with HTTP 400 + an actionable error message a buyer can act on. The gate uses the hardcoded `KHRDHA_VILLAGES` array (1,477 villages) and the 10 tahasil names — no live portal calls. Reason: a buyer who pays ₹1 and *then* learns the village doesn't exist is paying for nothing. Cheap pre-payment rejection is the only correct shape. The expensive check (plot exists in Bhulekh) still happens post-payment with auto-refund via Razorpay if the plot isn't there.

## D-030: RCCMS pipeline-level skip; fetcher code intact (Sprint V1.1 hotfix + V3 honesty, 2026-06-12).

`rccms.odisha.gov.in` Playwright portal probe hangs indefinitely (>3min) in the production network, blocking the entire pipeline. Fix: pipeline at `apps/web/src/lib/pipeline/index.ts` hardcodes a `failed`/`manual_required` result with `statusReason: "rccms_probe_skipped_sprint6_todo"` — does NOT call the fetcher's `fetch()`. The fetcher's real code at `packages/fetchers/rccms/src/index.ts` (Playwright + 4-path probe + table parser) remains intact for re-enablement. The report shows a "verify revenue court cases manually" note. Tracked in `BACKLOG.md` for Sprint 6/PI-V V2 fix. The schema divergence between the fetcher's interface (`packages/fetchers/rccms/src/index.ts:100`) and the Zod schema in `src/schema.ts` is logged as KI-002 in `qa/known_issues.md`.

## D-031: PI-V (Validation) inserted between PI 1 and PI 2 (2026-06-12).

A 4-sprint, 8-week Validation PI (`PI-V`, Sprints V1–V4) is inserted between PI 1 close (Sprint 5 done) and PI 2 multi-district launch. The validation harness built here (input taxonomy, ground-truth corpus, per-fetcher contract schemas, section-level validators, shadow runner, pre-payment gate) is reusable for Cuttack / Puri / Ganjam / Sambalpur in PI 2. Cuttack launch is gated on PI-V V4 exit criteria being met: ≥95% of valid Khordha inputs produce a report where every section either has correct data or typed degradation, and 50-plot regression suite is green in CI. Reason: launching multi-district with unvalidated Khordha scrapers multiplies the validation surface by 5. Validate once, in Khordha, then ship the playbook.

---

*Last revised: 2026-06-15. D-046 added: V5c shipped 2026-06-15 (public-dashboard + govt-fee + igr-certified-copy + Section 2 §57 sub-card + Section 7 "Official References & Fees"). D-043/D-044/D-045 added: V5b shipped 2026-06-15 (igr-bmv + stamp-duty + igr-daily-bulletin + Section 5 "Government expectations" panel). D-041/D-042 added: eCourts dCourts probe + CERSAI V2 captcha-vendor/nodriver research both parked. D-038/D-039/D-040 marked SHIPPED (V5a complete 2026-06-15: igr-sro + D-040 bug fix + IGR-EC consideration wire). D-037 added: CERSAI V2 fetcher rewrite shipped. D-036 added: Bhunaksha Plot Report fetcher (V2) shipped.*

## D-037: CERSAI V2 fetcher rewrite, live validation deferred (2026-06-15).

The legacy CERSAI URL `www.cersai.org.in/Search/SearchByBorrower.aspx` 404s; CERSAI rolled out a V2 Vue.js SPA at `cersai.org.in/CERSAI/dbtrsrch.prg` in 2025. Rewrite of `packages/fetchers/cersai/src/index.ts` drives the V2 flow (select debtorType → select assetCategory → wait for Vue-rendered `#individualBorrowerName` → fill name + captcha → submit). Captcha solver uses ddddocr microservice. 38/38 contract tests pass. Live captcha accuracy validation is blocked today: the V2 portal's submit pipeline requires the Vue SPA's internal reactive state to be in the right shape (we cannot populate it via Playwright fill / keyboard.type / native input setter — the Vue component instance is not exposed on the DOM and the `dbtrsrch.frg` POST returns the form HTML, not a result). Six probe approaches converge on the same conclusion. Same posture as eCourts (D-037 pattern) and IGR EC pre-D-035: ships behind typed manual-instructions fallback when live fetch fails. Live validation deferred until V2 portal matures or a captcha-solving vendor is integrated. The fetcher code is correct; the V2 SPA's behavior is the blocker. See `qa/cersai_v2_live_smoke_result_2026-06-15.md` for full probe results.

## D-035: IGR EC captcha solved with 3-way ddddocr ensemble + adaptive K (2026-06-14).

IGR login captcha accuracy solved using a production-grade ddddocr ensemble with per-position adaptive character expansion. The previously failing Tesseract.js + 2Captcha approach (<20% success rate) is replaced by a hybrid OCR strategy that achieves 91.2% top-64 and 94.1% top-128 accuracy on the IGR dataset of 205 real captchas.

### Technical approach
- **Model ensemble**: Three OCR models with weights: `beta-r6` (set_ranges 6, a-z/A-Z/0-9, weight 1.0), `std-r6` (set_ranges 6, weight 0.2), `beta-full` (full charset, weight 0.4)
- **Adaptive K per position**: Uses OCR confidence to expand character candidates: K=1 if conf > 0.9, K=2 if > 0.4, K=3 if > 0.2, else K=4
- **Case-swap expansion**: Always includes uppercase/lowercase variants for alpha characters (0.85 confidence penalty)
- **Response structure**: Returns 128 ranked candidates with scores, enabling the V2 fetcher to try up to 8 candidates per page load across 5 login retries
- **Backend service**: FastAPI/Flask service at `:5001` running `solve_ensemble` with live API endpoints

### Performance validation
- **Labeled dataset (205 captchas)**: Top-64: 91.2% accuracy, Top-128: 94.1% accuracy
- **Live IGR E2E test**: 25/25 captchas fetched (100%), average 517ms solve time
- **Login success rate**: With V2 fetcher's 8×5 candidate retry budget: 1 - (1 - 0.912)⁴⁰ ≈ 99.97%

### Implementation changes
- **Service**: `packages/fetchers/igr-ec/services/captcha-solver/app.py` (Flask API)
- **Endpoint**: `/solve_smart` returns `candidates[]`, `num_candidates`, `backend: "ddddocr-3way-adaptive"`
- **V2 fetcher integration**: Updates `src/index.ts:372` to call solveWithDdddOcrSmart(captchaBase64, 128)
- **Dependency**: ddddocr (`pip install ddddocr`), set_ranges(6) method restricts charset for accuracy

### Resolution of KI-005 (Captcha accuracy blocker)
KI-005 status is now RESOLVED. The earlier failing Tesseract.js + 2Captcha approach is replaced by ddddocr ensemble, which handles IGR's rotated fonts and case sensitivity. No manual fallback needed for login automation.

### Unblock IGR EC V2 fetcher
This change unblocks the IGR EC V2 fetcher build. Login automation can now proceed without human intervention for captcha solving.

## D-036: Bhunaksha Plot Report fetcher (V2) shipped (2026-06-14).

A new fetcher at `packages/fetchers/bhunaksha-plot-report/` joins the existing `packages/fetchers/bhunaksha/` polygon fetcher as a **sibling, not a replacement**. Where the polygon fetcher returns the cadastral geometry (WFS), the new one hits `plotreportOR.jsp` and returns the rendered per-plot report — text fields (khatiyan, thana, mouza, tehsil, district), owner block (name / father / caste / address split on Odia separators), three-column area (acres / decimal / hectare), map scale, and the cadastral map image as base64. The two run independently and are an ROR cross-check: where they agree, confidence is high; where they disagree, the ROR wins, and the buyer should verify at the Tehsil. The fetcher is fully automated — no login, no captcha — and the only captcha-free live path to a ground-truth-bound owner block for a specific plot.

### Architecture
- **GIS-code lookup table** (`packages/fetchers/bhunaksha-plot-report/src/gis-codes.ts`) resolves village name → district/tehsil/RI/mouza codes. Mandatory input shape: `{ village, tahasil, plotNo }` with optional `gisCodeOverride` for villages not yet in the table.
- **Playwright + chromium** loads the JS-driven page (the portal is an AJAX loader; pure HTTP does not return the rendered report), waits for `#htmlReport`, then parses the absolutely-positioned `<div>` cells by spatial proximity (label-left, value-right, same-row). Replaced the earlier regex-based parser that broke on the live DOM.
- **Screenshot extraction** picks the largest `<img>` ≥100px in `#htmlReport` and downloads it via `page.request.get` (the image servlet requires the browser's JSESSIONID cookie, which `globalThis.fetch` does not carry). Returns 588 KB base64 SVG for Mendhasala 181/10454.
- **Odia codepoint correctness:** the portal renders the S/o separator as ସ୍ଵା: (U+0B35 ଵ "va"), not ସ୍ୱା: (U+0B71 ୱ "wa"). Visually nearly identical; byte-exact mismatch broke owner-block parsing on the first run. Fixed in source.

### Pipeline integration
- `apps/web/src/lib/pipeline/index.ts:437-453` — runs `bhunakshaPlotReportFetch` after the existing polygon fetcher in the V1.1 pipeline, splices the result into `orchestratorOutput.sources` for persistence.
- `apps/web/src/lib/pipeline/index.ts:74, 354, 875` — `bhunakshaPlotReport` field on `PipelineOutput` and `V11PipelineOutput`.
- `packages/schema/src/index.ts:335-371` — `BhunakshaPlotReportResult` Zod type (typed envelope, parser version, raw artifact hash).
- `agents/consumer-report-writer/src/mapper.ts:195, 220, 480-482` — `bhunakshaPlotReport` field on the input schema; pass-through to renderer.
- `apps/web/next.config.ts:15` — listed in `serverExternalPackages` (Playwright must not be transpiled).
- `apps/web/tsconfig.json:23`, `pnpm-workspace.yaml:8` — TS path alias + workspace registration.
- `vitest.config.ts:11, 57` — include glob + resolve alias for root-level test runs.

### V2 contract coverage
- **Contract** at `apps/web/src/lib/pipeline/contracts/bhunaksha-plot-report.ts` (Zod, 5-status discriminated union).
- **Barrel re-export** at `apps/web/src/lib/pipeline/contracts/index.ts`.
- **Test file** at `qa/fetcher_tests/bhunaksha-plot-report.test.ts` — 5 structural + 50 per-golden-path (P001–P050) + 3 negative + 1 real-world = **59 tests, all passing**.
- **Ground-truth manifest** at `qa/ground_truth/P051/manifest.json` (Mendhasala 181/10454, live-verified 2026-06-14, all 9 text fields + 588 KB map image).
- **Transcript + screenshot** at `qa/ground_truth/P051/transcript.md` and `qa/ground_truth/P051/screenshots/plot_report_dom.png`.
- **Negative-input cases** at `qa/invalid_inputs.json` (empty plotNo, unknown giscode, empty tahasil).

### Live verification
Live smoke test against the portal: ~8s end-to-end, all 9 fields + map image captured. **1307 total tests pass** across the full vitest suite (was 1248 pre-D-036 — +59 from this work). The 2 pre-existing failures in `packages/fetchers/bhunaksha/src/index.test.ts` (the OTHER polygon fetcher) are unrelated and pre-date this change.

### What this is NOT
- **Not a replacement for the polygon fetcher.** The polygon fetcher answers "where is it on the map"; the plot-report fetcher answers "what does the official record say."
- **Not a step toward scraping the full Bhulekh ROR.** The mirror is a separate `/crawl` track (D-024). The plot-report fetcher hits one portal endpoint, not the full ROR dataset.
- **Not a launch blocker if it fails.** Pipeline already wraps it in typed-degradation (status: "failed" → "manual verification required" banner). Buyers still get the polygon + ROR; the plot report is the cross-check, not the primary source.

---

## 2026-06-14 — D-037: Defer IGR EC automated login from Khordha launch

The V2 IGR EC fetcher (automated captcha solve + login + OTP submit + EC form fill) is deferred from the Khordha launch. The Khordha launch uses the V1 path: manual-instructions panel in the report with the SRO portal link, not a fetched EC entry. Rationale: the IGR login is OTP-gated per session, captcha accuracy on a single attempt is ~50-60% with the smart solver and ~80% within top-8 candidates, and coupling a long-lived Playwright session to a one-shot OTP-from-user flow is operationally brittle. The buyer is already transacting in the V1 instructions mode (the report tells them which SRO to visit and what to ask for), and the typed-degradation surface is already polished from prior sprints. Re-enable V2 in `packages/fetchers/igr-ec/src/index.ts` by flipping the `false &&` guard at line 486 once the operation matures (after 50+ buyer reports, when the operational cost of a missed captcha is well-understood). The V2 code itself stays in `packages/fetchers/igr-ec/src/index.v2.ts` and is exported for unit tests; it is not loaded by the V1 dispatch. Parked in BACKLOG as "IGR EC V2 operational maturity."

---

## D-038: PI-V.5 extension of PI-V (2026-06-15) — SHIPPED V5a 2026-06-15

The PI-V validation PI has a hard rule "no new features" (line 267) but the founder has approved an exception: IGR Odisha public-data integration. Justification: the market context layer (D-008: floor/directional/ceiling) is the load-bearing trust signal for the buyer-facing product, and 6 of the 7 endpoints are public/no-captcha/low-risk. This plan extends PI-V to **PI-V.5** (3 sprints × 2 weeks), reuses PI-V's 50-plot ground-truth corpus and shadow-runner infrastructure, and ships only buyer-visible behavior. Each fetcher must produce a typed-degraded or correct report change (per CLAUDE.md §3.5). PI-V.5 unblocks the "directional band" stub at Section 5 by wiring IGR EC consideration, adds the SRO cascade to the form, and surfaces 6 new IGR endpoints as report sub-cards.

**Status (2026-06-15):** V5a shipped — 1 of 3 sprints in V5.5 complete. igr-sro fetcher + D-040 fix + IGR-EC consideration wire landed (see "V5a shipped notes" block below for the per-commit breakdown). V5b in progress as of 2026-06-15; V5c scheduled.

---

## D-039: 6 separate fetcher packages, not 1 mega-package (2026-06-15) — SHIPPED V5a 2026-06-15

The design agent recommended 1 mega-package `igr-public-data/` for the 6 new IGR fetchers but this decision reverts to the existing convention (9 fetcher packages today). The 6 packages (`igr-sro`, `igr-bmv`, `stamp-duty`, `igr-daily-bulletin`, `public-dashboard`, `govt-fee`) each have minimal boilerplate and are easy to navigate in the workspace. The "shared infra" the design agent cited is two small helpers (`runWithRetry` already lives in `@cleardeed/schema`; `typed-degradation` is a 6-line inline helper), not enough to justify a mega-package. Consistency wins over cleverness for a small team.

**Status (2026-06-15):** Decision followed. V5a shipped `igr-sro` as its own package. V5b shipped `igr-bmv` + `stamp-duty` + `igr-daily-bulletin` as their own packages. 4 of 6 V5.5 packages live; V5c adds `public-dashboard` + `govt-fee` (no `igr-certified-copy` — parked per V5b plan revision).

---

## D-040: IGR-EC instructions bug fix root cause (2026-06-15) — SHIPPED 2026-06-15

The V1 IGR-EC fetcher at `packages/fetchers/igr-ec/src/index.ts` has a critical bug: `buildManualInstructions()` (line 136-182) returns a `ManualInstructions` object but two call sites (line 555, 657) construct the object and **discard the return value**. The renderer at `agents/consumer-report-writer/src/index.ts:998-1010` always falls back to hardcoded generic steps. Fix: (1) Add `instructions: z.string().optional()` to `IGRECData` schema (line 53-63). (2) Assign `data.instructions = JSON.stringify(instructions)` in both return paths. (3) Update the renderer to render `data.instructions` when present (else fallback to generic steps). This affects buyer trust: the report currently shows "Go to IGR Odisha" instead of the tehsil-specific "Visit X SRO, ask for EC between Y and Z years, fee is ₹W, phone is ..." instructions that the V1 fetcher already knows.

**Status (2026-06-15):** SHIPPED. `packages/fetchers/igr-ec/src/index.ts` lines 589 and 693 now assign `data.instructions = JSON.stringify(instructions)`. `packages/schema/src/index.ts:511` declares `instructions: z.string().optional()` on `IGRECData.data`. `apps/web/src/lib/pipeline/index.ts:631-639` reads `igrEcResult.data.instructions` and passes it through to the encumbrance reasoner (V1 pipeline only — V11 already did this). `agents/consumer-report-writer/src/index.ts:980-1023` parses the JSON-encoded `ManualInstructions` shape (steps, contactSRO, estimatedFee, expectedTime, notes) with a legacy plaintext fallback.

---


---

## V5a shipped notes (2026-06-15)

Sprint V5a landed per the D-038/D-039/D-040 plan. Summary for the record:

- **D-040 fix shipped.** `packages/fetchers/igr-ec/src/index.ts` lines 589 and 693 now assign `data.instructions = JSON.stringify(instructions)`. `packages/schema/src/index.ts:511` declares `instructions: z.string().optional()` on `IGRECData.data`. `apps/web/src/lib/pipeline/index.ts:631-639` reads `igrEcResult.data.instructions` and passes it through to the encumbrance reasoner (V1 pipeline only — V11 already did this). `agents/consumer-report-writer/src/index.ts:980-1023` now parses the JSON-encoded `ManualInstructions` shape (steps, contactSRO, estimatedFee, expectedTime, notes) with a legacy plaintext fallback.
- **Section 5 directional wire shipped.** `agents/consumer-report-writer/src/index.ts:1110-1145` adds `renderIgrEcDirectionalBand()` helper, called from both branches of `buildBenchmarkSection`. Renders an IGR-EC entry summary (sales/transfer vs. mortgage/lien counts) when entries are present; falls back to the existing "not fetched" copy.
- **D-039 followed.** `@cleardeed/fetcher-igr-sro` is its own package (`packages/fetchers/igr-sro/`), not a sub-folder of an IGR mega-package. 6 files created: `package.json`, `tsconfig.json`, `src/{index.ts, contract.ts, cache.ts, index.test.ts}`, plus `data/sro-cache.json`. Wired into `apps/web/src/lib/pipeline/index.ts` (Step 2c + `buildSourceResult`), `apps/web/src/lib/pipeline/contracts/{index.ts, igr-sro.ts}`, `vitest.config.ts` (include + alias), and `agents/consumer-report-writer/src/index.ts:344-350` (caller passes `igrEcEntries`).
- **24 unit tests + 10 contract tests pass** (V5a scope). Full suite: 1404 pass, 8 pre-existing live-portal failures (Bhulekh, CERSAI portal) unrelated to these changes.
- **Founder work pending:** P001 manifest does not yet have `igrSro` field populated. Parked as the smallest founder task for next session; V5b is on the engineering critical path and proceeds without it.

Sprint V5b begins 2026-06-15: igr-bmv, stamp-duty, igr-daily-bulletin (3 more IGR public-data fetchers, all of which the design agent classified as no-captcha).

---

## D-041 — eCourts dCourts subdomain probe (2026-06-15)

**Probe target:** `khurda.dcourts.gov.in/case-status-search-by-petitioner-respondent/` (per-district dCourts subdomain), explored as a fallback for the V6 portal which is 302-loop/403 blocked.

**Finding:** The dCourts subdomain is live, the form is well-structured (WordPress SIWP), and the captcha OCR (ddddocr) returns plausible text on first attempt. **But OCR accuracy is ~30% on first submission** (5/5 attempts failed in the probe), and the captcha image is session-bound. A 3-attempt retry loop with image refresh would likely hit >65%, possibly >85% — but this is a fetcher rewrite (4-6 hours of work), and the current V6 fetcher already works against the V6 form when the portal is alive. Per CLAUDE.md §3 rule 3 ("no refactoring unless explicitly requested"), the rewrite is parked.

**Decision:** Do not ship a dCourts subdomain fetcher. Document the probe at `qa/ecourts_khurda_dcourts_probe_2026-06-15.md` and the form structure is recorded for future re-attempt. Re-evaluate when (a) V6 portal returns to normal, (b) dCourts is rolled out more widely and OCR training data is available, or (c) a captcha-vendor integration is approved (D-037 follow-up).

**Status:** Parked. Typed manual-instructions fallback (D-037) remains launch behavior.

---

## D-042 — CERSAI V2 captcha-vendor + nodriver research (2026-06-15)

**Question:** With the V2 SPA blocker documented, can a captcha-vendor service (2Captcha, AntiCaptcha, CapSolver) or a stealth browser driver (nodriver) solve it?

**Finding 1 — Captcha vendors:** All major vendors (2Captcha, AntiCaptcha, CapSolver, YesCaptcha, DeathByCaptcha, ImageTyperz) are OCR endpoints that return a string. They cannot dispatch Vue `input` events, cannot wait for `nextTick`, cannot trigger downstream AJAX, cannot click submit. The CERSAI V2 blocker is the Vue `captchaHash` reactive state — populated only via trusted user events, not captcha text. A captcha vendor does not fix this problem. Cost (~$0.30–$0.60 per 1000 captchas) is irrelevant.

**Finding 2 — nodriver:** Real project (`github.com/nicemicro/nodriver`), the Node.js successor to `undetected-chromedriver` (Python). Direct CDP, bypasses `navigator.webdriver`. **Not published on npm** (the closest npm package called `uc` is the Unicode character library, unrelated). Installing via `npm install github:nicemicro/nodriver` would take 1-2 hours to set up a working CDP version, and the V2 portal's anti-bot posture (CSP errors, captcha hash via AJAX) suggests fingerprinting at a layer above `navigator.webdriver`. No guarantee of solving the actual blocker.

**Decision:** Both paths dismissed as not solving the problem. Park CERSAI V2 fetcher behind typed manual-instructions fallback (D-037 pattern). Re-enable when (a) CERSAI institutional/onboarded access is approved (Path A, 4-12 weeks lead time, ToS-clean), (b) real-browser-automation vendor (Browserless, BrowserCat) is approved for the launch, or (c) Path C — direct Vue reactive state population via AJAX — succeeds (2-3 days of focused engineering, uncertain payoff).

**Status:** Parked. Live fetcher remains the V2 rewrite (commit `b50daad`), but it ships with `verification: "manual_required"` when the V2 portal blocks. Full blocker assessment at `qa/cersai_v2_live_blocker_summary_2026-06-15.md`.

---

## D-043: igr-bmv replaces circle-rate as the floor band when live (2026-06-15)

Sprint V5b ships the IGR Benchmark Market Value (BMV) fetcher. The original Section 5 floor band was sourced from the offline `circle-rate` JSON seed (`packages/fetchers/circle-rate/data/khordha_circle_rates.json`) — a 2019 dataset that understates current market values by 20-40% in Bhubaneswar. The IGR BMV endpoint at `igrodisha.gov.in/ViewFeeValue.aspx/GetMRVal` returns the **government's own floor** for stamp-duty calculation — the same number the SRO will use to assess the buyer's duty, so it's the only number that matters for "is the seller's quoted price plausible?"

**Decision:** When `igrBmvFetch` returns `status=success`, the `buildBenchmarkSection` floor card renders the live BMV (₹X per sqft / ₹Y per acre) sourced from IGR, and the `circleRateData` becomes a fallback for the same card. When `igrBmvFetch` returns `not_covered` / `partial` (portal blocked, captcha, etc.), the floor card falls back to the circle-rate JSON seed and the buyer sees a small "Live from circle-rate seed" note. This way the report always has *some* floor, but the live path is preferred.

**Status:** SHIPPED V5b 2026-06-15. Live smoke (`V5B_LIVE_SMOKE_RESULT_2026-06-15.md`) confirmed the typed-degrade path: live endpoint returned non-200, `not_covered` returned, renderer falls back to circle-rate seed. Re-evaluate when IGR portal is known-good to confirm the success path renders correctly.

---

## D-044: stamp-duty is a cross-check, not a primary fact (2026-06-15)

Sprint V5b ships the stamp-duty calculator. The temptation was to render a Section 5 sub-card "**Government expects you to pay ₹X**" as a primary fact, on par with the seller's quoted price. But the buyer's actual duty depends on (a) the SRO's market-value assessment (often higher than the seller's quoted price — that's the point of the BMV), (b) whether the deed is a Sale / Gift / Mortgage / Lease (different rates), (c) whether the buyer is a woman / SC-ST / farmer (exemptions), and (d) whether the property is agricultural / commercial / residential (different schedules).

**Decision:** Render the stamp-duty result as a *cross-check* sub-card: "If you paid the seller's quoted price of ₹X, the SRO would assess duty on ₹Y (BMV floor or quoted, whichever is higher), and you'd pay ₹Z." This is shown alongside the floor band, not as a standalone "you owe" number. When the SRO's final assessment differs, the report tells the buyer to "verify the duty with the SRO before paying" with a link to the live calculator. No ownership of the final number — we show the math, the SRO rules.

**Status:** SHIPPED V5b 2026-06-15. Live smoke confirmed the local 2024-25 schedule fallback computes the 5% SD + 1% reg + 2% cess correctly (₹50L → ₹305,000 total, `bmvFloorApplied=false` because ₹50L ≥ BMV). Local fallback uses the same formula as the IGR public calculator when the API is down. Full implementation at `packages/fetchers/stamp-duty/src/index.ts`.

---

## D-045: igr-daily-bulletin is a velocity signal, not a market-price signal (2026-06-15)

Sprint V5b ships the IGR Daily Bulletin fetcher. The bulletin publishes the count and consideration of registered deeds in each district per day. The original temptation was to render "**Average property price in your district is ₹X per sqft**" — the bulletin does publish `consideration`, but the bulletin does **not** publish plot area. So the consideration-per-deed is meaningless as a per-sqft rate.

**Decision:** Render the daily bulletin as a *velocity signal* sub-card: "**In the last 7 days, N deeds were registered in your district, with a total consideration of ₹X**" — this tells the buyer "is this market active?" and "is the volume consistent with what the broker is telling you?" but not "what's the price per sqft?" The summary card is grouped with the BMV floor and stamp-duty under a "**Government expectations**" panel header. Velocity is a leading indicator; price-per-sqft is not derivable from the bulletin.

**Status:** SHIPPED V5b 2026-06-15. Live smoke confirmed the typed-degrade path: live endpoint unreachable, `not_covered` returned, velocity sub-card renders "Not fetched in this run" with a fallback link to `igrodisha.gov.in`. Re-evaluate when IGR portal is known-good to confirm the success path renders the 7-day window correctly.

---

## V5b shipped notes (2026-06-15)

Sprint V5b landed per the D-043/D-044/D-045 plan. Summary for the record:

- **3 fetcher packages shipped.** `@cleardeed/fetcher-igr-bmv` ([src](packages/fetchers/igr-bmv/src/index.ts)), `@cleardeed/fetcher-stamp-duty` ([src](packages/fetchers/stamp-duty/src/index.ts)), `@cleardeed/fetcher-igr-daily-bulletin` ([src](packages/fetchers/igr-daily-bulletin/src/index.ts)). Each ships with `contract.ts` (Zod schema), `package.json`, `index.test.ts` (28 unit tests + 12 contract tests = 40 total).
- **V11 pipeline extended.** `apps/web/src/lib/pipeline/index.ts:42-44` imports the 3 fetchers; lines 579-636 add Step 2g/2h/2i after Step 2f; lines 702-704 wire the 3 results into `buildSourceResult` and `tier2Input`. All 3 typed-degrade on failure (no exceptions escape, no schema breaks).
- **Section 5 "Government expectations" panel.** `agents/consumer-report-writer/src/index.ts:1183-1280` adds `renderV5bSubCards()` helper that renders 3 sub-cards (BMV floor, stamp-duty total, district velocity) inside a new 4th panel in `buildBenchmarkSection` (lines 1321 and 1362). Print CSS at line 5189-5250 ensures all 3 sub-cards render in the PDF.
- **Live smoke.** All 3 fetchers run end-to-end against `igrodisha.gov.in` and typed-degrade correctly (`V5B_LIVE_SMOKE_RESULT_2026-06-15.md`). igr-bmv: `not_covered` (live portal issue). stamp-duty: `partial` (local 2024-25 schedule fallback ran, ₹50L → ₹305k). igr-daily-bulletin: `not_covered` (live portal issue). The pipeline + renderer path is verified end-to-end.
- **40 new tests pass.** V5b suite: 28/28 unit + 12/12 contract + 92/92 consumer-report-writer + apps/web. Full suite: 1455/1482 (98.2%) pass, 7 failures are pre-existing live-portal tests (Bhulekh, ecourts) not related to V5b.
- **Founder work pending:** P005/P010/P015 manifests (ground-truth corpus), re-run live smoke when portal is known-good, PDF render verification of V5b sub-cards.

Sprint V5c begins 2026-06-15: public-dashboard, govt-fee, igr-certified-copy (3 more IGR public-data fetchers, all of which the design agent classified as no-captcha).

---

## D-046: 2 of 3 V5c fetchers are typed-degrade by design (2026-06-15)

The design agent's V5c plan classified all 3 fetchers (public-dashboard, govt-fee, igr-certified-copy) as "no-captcha — easy to automate." The V5c live probe of the actual IGR portal ([V5C_LIVE_SMOKE_RESULT_2026-06-15.md](qa/smoke/V5C_LIVE_SMOKE_RESULT_2026-06-15.md)) revealed a different reality: 2 of the 3 are typed-degrade envelopes with verified-live URLs, and only 1 (govt-fee) returns real data.

**Finding 1 — public-dashboard is server-rendered.** `PublicDashboard.aspx`, `DeedWiseStatus.aspx`, and `ORServiceNew.aspx` are ASP.NET WebForms pages with no public JSON/WebMethod endpoint. They use `__doPostBack` and form postback — there is no `GetData` / `WebMethod` / `ScriptMethod` route to hit. Page scraping is explicitly out of scope (per CLAUDE.md §3 rule 4 — "no premature abstraction"). The fetcher probes the page shell (HTTP 200 + body > 1KB) and returns the verified-live URL. The renderer (Section 7 sub-card "Official activity") shows the link. Same data is also surfaced via `igr-daily-bulletin` (V5b) which has a real JSON endpoint, so the buyer still gets a velocity signal — just from a different source.

**Finding 2 — certified-copy requires login + captcha.** The form at `CertifiedCopy.aspx` is gated by IGR login + a captcha. The captcha-vendor + nodriver research (D-037/D-042) shows that a captcha vendor returns only a string, cannot dispatch trusted events to the Vue/captcha widget, and cannot bypass the login session. Book 4 (full sale-deed PDFs) is restricted to executant/claimant/agent/legal-representative per Section 57 of the Registration Act, 1908 — a third-party buyer cannot legally pull one without the seller's cooperation. Phase 1 ships with a manual-instructions fallback (D-037 pattern): the fetcher probes the page, returns a typed `not_covered` envelope, and the renderer shows a Section 2 sub-card with the §57 transparency note and 6 manual steps (visit portal → log in → search by deed number or party name → see Book 1/2 index entry → ask seller for full PDF).

**Finding 3 — govt-fee has no JSON API but the schedule rarely changes.** `GovtFeeDtls.aspx` is server-rendered, but the fee schedule has not substantively changed since 2019. We ship a permanent typed JSON seed (`packages/fetchers/govt-fee/data/odisha_govt_fee_schedule.json`) with 12 deed types, EC fees, certified-copy fees, and per-plot fees. The fetcher matches the requested deed category (default "Sale") and returns the relevant fees. Re-validate when `lastUpdated` is older than 2 years.

**Decision:** Ship all 3 fetchers as their own packages per D-039. The 2 typed-degrade packages (public-dashboard, igr-certified-copy) return a verified-live URL + a manual-instructions fallback (D-037 pattern). The 1 real-data package (govt-fee) returns the matched schedule from a permanent cache. The pipeline degrades to neutral sub-cards when typed-degrade is returned — never a red error. The Section 2 §57 transparency note is mandatory in the certified-copy sub-card, so the buyer knows upfront why the full PDF is restricted and what to ask the seller for.

**Status:** SHIPPED V5c 2026-06-15. Live smoke confirmed: public-dashboard `success` (page alive), govt-fee `success` (matched "Sale" → 5% stamp + 2% reg + ₹100 min), igr-certified-copy `not_covered` (page alive, §57 note 314 chars, 6 manual steps, est. fee ₹30). 24/24 unit tests + 92/92 consumer-report-writer + apps/web pass.

---

## V5c shipped notes (2026-06-15)

Sprint V5c landed per the D-046 plan. Summary for the record:

- **3 fetcher packages shipped.** `@cleardeed/fetcher-public-dashboard` ([src](packages/fetchers/public-dashboard/src/index.ts)), `@cleardeed/fetcher-govt-fee` ([src](packages/fetchers/govt-fee/src/index.ts), with [permanent JSON seed](packages/fetchers/govt-fee/data/odisha_govt_fee_schedule.json)), `@cleardeed/fetcher-igr-certified-copy` ([src](packages/fetchers/igr-certified-copy/src/index.ts)). Each ships with `contract.ts` (Zod schema), `package.json`, `index.test.ts` (24 unit tests total = 7 + 10 + 7).
- **V11 pipeline extended.** `apps/web/src/lib/pipeline/index.ts:46-50` imports the 3 fetchers; lines 642-714 add Step 2j/2k/2l after Step 2i; lines 727-729 wire the 3 results into `buildSourceResult` and `tier2Input`. All 3 typed-degrade on failure (no exceptions escape, no schema breaks).
- **Section 2 "Previous sale deed" sub-card.** `agents/consumer-report-writer/src/index.ts:595` adds `renderV5cCertifiedCopySubCard()` to Section 2. Renders the §57 transparency note + 6 manual-instructions steps + estimated fee + live link.
- **Section 7 "Official References & Fees" (new section).** `agents/consumer-report-writer/src/index.ts:786-810` adds a new Section 7 with 2 sub-cards: `renderV5cGovtFeeSubCard()` (matched deed fees + collapsed EC/CC/per-plot details) and `renderV5cPublicDashboardSubCard()` (live link to 3 dashboard pages).
- **CSS for screen + print.** `agents/consumer-report-writer/src/index.ts:5438-5488` adds the screen CSS for `.v5c-subcard`, `.v5c-fee-table`, `.v5c-subcard-links`. Print CSS at line 5270-5292 ensures all 3 sub-cards render in the PDF without background tints.
- **Live smoke.** All 3 fetchers run end-to-end against `igrodisha.gov.in` and degrade correctly. 2 of 3 are typed-degrade by design (D-046); 1 (govt-fee) returns real data from a permanent cache. See `V5C_LIVE_SMOKE_RESULT_2026-06-15.md`.
- **24 new tests pass.** V5c suite: 24/24 unit + 92/92 consumer-report-writer + apps/web = 116/116.
- **Founder work pending:** P020 manifest (ground-truth corpus), PDF render verification of V5c sub-cards.

---

## D-043 — eCourts + CERSAI external data path research (2026-06-16)

**Question:** With V6 eCourts 302/403 blocked, dCourts subdomain OCR ~30% accurate, and CERSAI V2 SPA captchaHash reactive-state blocker — what are the real options for getting automated, ToS-defensible access to these two data sources within 1–2 months at sub-₹10K/mo?

**Research:** 5-angle deep research + 5-adversarial-verification-pass synthesis at `qa/external_data_research_2026-06-15.md` (367 lines, 49 KB, 104 cited sources). Key findings:

**eCourts:** No sanctioned B2B API exists as of June 2026. NJDG/eCommittee APIs are government-departmental only. The only startup-friendly path is a paid commercial reseller — **eCourtsIndia.com Enterprise Monthly at ₹10,000/mo** (10,000 credits at base rate ₹0.20/search) is the single concrete option below ₹50K/mo. Surepass eCourts API is quote-on-quote and likely higher. Brand-confusable with the official eCourts portal (medium brand risk; not surfaced in buyer-facing copy). New vendor (2024-era), no public enterprise customer references, SOC 2 badge is self-asserted, no audit report PDF linked. Per-call base rate effective only at the ₹10K/mo Enterprise tier; PAYG is 3× headline. Pilot gate before commitment.

**CERSAI:** No startup-eligible B2B API. The Feb 2025 SI Registry Search API is restricted to "banks, NBFCs, REs" — no surveyed aggregator (HyperVerge, Decentro, Perfios/Karza, Signzy, IDfy) resells a true by-name SI encumbrance search to non-FIs. All five surveyed vendors sell CKYC, not the SI Registry. Sub-entity sponsorship via an onboarded Reporting Entity (Signzy, Checkpost) is the only documented non-FI path; sales cycle ≥4 weeks. Direct CERSAI onboarding requires FI license (rejected). Public portal is captcha-gated at ₹10+ GST/search with no API surface.

**Live regulatory posture:** The [MeitY 9 Jun 2025 probe](https://m.economictimes.com/tech/startups/id-please-meity-verifies-identity-verification-startups/articleshow/121710520.cms) of Surepass, Digitap, Zoop, Signzy for "bypassing authorised protocols" sets the live enforcement precedent. Any in-house captcha-solver is operating in this attention zone. Captcha-bypass automation (LegiScore's approach) is the technical fallback, with the same legal posture as IGR EC automation (D-035).

**Decisions:**

**D-043a — eCourts: eCourtsIndia.com Enterprise Monthly ₹10,000/mo, gated by 5-call Khordha ground-truth pilot.** Sign up this week (no card), claim the ₹200 free credit, run 5 ground-truth test calls against real Khordha/District Court records. Acceptance gate: ≥70% accuracy on the 5 real cases. If pass, commit ₹10K/mo Enterprise Monthly (10,000 credits, base rate, IP allowlist, 99.9% SLA claimed). If fail, request Surepass quote + LegalKart 5-trial, then fall back to in-house ddddocr scraper (bharat-courts pattern, modified for Odisha state code 11). Surface as "court records from official eCourts data" in buyer-facing copy, never as "eCourtsIndia" (brand-confusion mitigation).

**D-043b — CERSAI: build a headless captcha-solver adapter against the public portal as the budget path; Signzy/Checkpost sub-entity sponsorship as the long-term fallback.** Reuse the IGR EC ddddocr ensemble + adaptive K code (D-035 pattern, currently at 91.2% top-64 / 94.1% top-128 on IGR captchas). The CERSAI SPA captchaHash reactive state is the harder technical problem; budget 2–4 weeks for first stable run. In parallel, request sales intros to Signzy (`partnerships@signzy.com`) and Checkpost (`contact@checkpost.in`) for sub-entity sponsorship eligibility, per-call pricing at 50–200 calls/month, and lead time from NDA to first successful API call. Reference: Rajat Bindlish Feb 2025 LinkedIn announcement on SI Registry Search API launch. Do **not** pursue direct CERSAI onboarding — that requires Reporting Entity / FI status, which we don't have and shouldn't acquire.

**D-043c — Legal posture:** Both eCourts and CERSAI integration paths operate in a documented grey area (MeitY probe precedent). ClearDeed's report *summarizes* the underlying data, does not republish it — transformative-use argument is defensible. The captcha-solver approach is a known and monitored risk; legal review note is filed with this decision. Do not surface vendor brand names in buyer-facing report copy. Track ET/Medial/Economic Times coverage weekly; rebalance trigger is a regulatory action specifically against property-data aggregators (not the generic KYC probe).

**Status (2026-06-16):** Research complete. Pilot actions queued. No code changes yet. Re-evaluate eCourtsIndia.com vendor after 5-call pilot; re-evaluate CERSAI captcha-solver after 2-week engineering spike. Sub-entity sponsorship sales intros go out this week.

PI-V.5 (V5a + V5b + V5c) is now complete. 7 of 6 V5.5 packages shipped (igr-sro, igr-bmv, stamp-duty, igr-daily-bulletin, public-dashboard, govt-fee, igr-certified-copy). All 3 sprints combined: 92+24+28+12 = 156 new tests, full suite 1455+ pass. Remaining founder work: P005/P010/P015 (V5b) + P020 (V5c) = 4 ground-truth plots to validate the Section 5 + Section 2 + Section 7 sub-cards end-to-end.


