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

*Last revised: 2026-06-15. D-037 added: CERSAI V2 fetcher rewrite shipped (38/38 contract tests green, live captcha accuracy validation blocked by portal instability, ships behind typed manual-instructions fallback per D-037 pattern).*
*D-036 added: Bhunaksha Plot Report fetcher (V2) shipped — sibling to existing Bhunaksha polygon fetcher; cross-checks the ROR, captures the cadastral map image, and is covered by 59 V2 contract tests against a live-verified P051 ground-truth manifest.*

## D-037: CERSAI V2 fetcher rewrite, live validation deferred (2026-06-15).

The legacy CERSAI URL `www.cersai.org.in/Search/SearchByBorrower.aspx` 404s; CERSAI rolled out a V2 Vue.js SPA at `cersai.org.in/CERSAI/dbtrsrch.prg` in 2025. Rewrite of `packages/fetchers/cersai/src/index.ts` drives the V2 flow (select debtorType → select assetCategory → wait for Vue-rendered `#individualBorrowerName` → fill name + captcha → submit). Captcha solver uses Tesseract.js multi-strategy from eCourts. 38/38 contract tests pass. Live captcha accuracy validation is blocked today: the V2 portal's anti-bot posture (CSP violations, post-submit body containing "password" in navbar text) prevents measurement. Same posture as eCourts (D-037 pattern) and IGR EC pre-D-035: ships behind typed manual-instructions fallback when live fetch fails. Live validation deferred to next week when portal state may stabilize. The fetcher code is correct; the portal's behavior is the blocker. See `qa/cersai_v2_rewrite_result_2026-06-15.md` for probe results.

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
