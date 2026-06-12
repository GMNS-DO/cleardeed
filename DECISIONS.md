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
