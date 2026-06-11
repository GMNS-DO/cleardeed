# Shared Running Log
## Gemini Code Assist — Session 039

### Completed Tasks
- [x] **TASK 1: T-033 — IGR/EC Concierge Service**: Added IGR Odisha step-by-step instructions, fees, and requirements in `agents/encumbrance-reasoner` and `agents/consumer-report-writer`.
- [x] **TASK 2: T-043 — Circle Rate Deep-Link + Benchmark Valuation**: Created `docs/sources/circle-rate.md` and added "Market Benchmark" panel to the HTML report.
- [x] **TASK 3: A10 — Wire LARR into Consumer Report Writer**: Updated mapper and A10 to include `larrRiskAssessment` and display the LARR acquisition risk with RTI instructions in the final HTML report.
- [x] **TASK 4: T-039 — Probe RERA Portal Structure**: Wrote a probe script and documented RERA Odisha at `docs/sources/rera.md`. It has an online project list but is difficult to search by builder or location programmatically without a complex scraper. Party search is not supported.
- [x] **TASK 5: T-021 — Fetcher Resilience Audit**: Audited all fetchers. The orchestrator now implements a global circuit breaker via `runFetcher` in `packages/orchestrator/src/index.ts`. `runWithRetry` logic added where missing.
- [x] **TASK 6: T-035 — Civic Dues Stubs + MCA Check**: Built `fetchCivicDues` fetcher stub and integrated it into the orchestrator pipeline when a company/LLP seller is detected.

### Schema Notes
- Modified `CourtCaseResult` source field to be an enum including `"ecourts", "high_court", "drt", "larr", "rti", "revenue_odisha_sia"` to accommodate multiple case fetchers returning `CourtCaseResult`.
- Allowed `searchMetadata` in `CourtCaseResult` to accept `.catchall(z.unknown())` to gracefully accept extra tracking metadata (like `doubleFetchAttempt`).

### Blockers / Unblocked
- Unblocked Claude for live probe tasks by ensuring the orchestrator and schemas are tolerant to missing or partial results from new fetchers (e.g. `larr`). Types are fixed across the workspace.

## Gemini Code Assist — Session 040

### Completed Tasks
- [x] **TASK 1: A10 — LARR Fixture Wiring**: Added `larrRiskAssessment` to `agents/consumer-report-writer/fixtures/golden-path.ts` so the "Land Acquisition Risk" section correctly renders in `/report/demo`. (Mapper and HTML rendering were already completed in Session 039).
- [x] **TASK 2: T-033 — IGR/EC Concierge Service**: Expanded the EC instructions panel in `agents/consumer-report-writer/src/index.ts` to include expected fees (₹100-500), required docs, and SRO visit guidance. Created `docs/sources/igr.md` documenting the portal constraints.
- [x] **TASK 3: T-043 — Circle Rate Deep-Link**: Verified `docs/sources/circle-rate.md` and "Market Benchmark" panel in A10 are present and correct. Marked T-043 as DONE in `claude.md`.
- [x] **TASK 4: T-039 — Probe RERA Portal**: Verified `scripts/probe/rera-probe.mjs` and `docs/sources/rera.md`. Marked T-039 as DONE in `claude.md`.

### Blockers / Unblocked
- Unblocked demo rendering of LARR section.
- Closed out multiple P1 research/probe tasks (IGR, RERA, Circle Rate) by documenting their manual/concierge workflows.

## Codex — Session 041

### Completed Tasks
- [x] Closed Sprint 1 deployment blockers: fixed the Vercel frozen-lockfile issue by verifying `pnpm-lock.yaml` against `package.json`, added server-side fallback from `RAZORPAY_KEY_ID` to `NEXT_PUBLIC_RAZORPAY_KEY_ID`, and hardened `/api/payment/success` to require Razorpay signatures when the secret is configured.
- [x] Added token-scoped report delivery: signed report URLs in API responses and report emails, tokenized PDF links, production lockout for missing/invalid report tokens, and demo-mode exemption.
- [x] Updated production smoke coverage: home, DPDP pages, Razorpay ₹1 order creation, lead write, durable report creation, signed report URL, no-token lockout, PDF generation, and report feedback capture.
- [x] Deployed production: `https://v0-cleardeed.vercel.app` → `dpl_HM6MnjciSGK4YqHTUqqZttecCxkW`.

### Verification
- [x] `npm exec -- pnpm build`
- [x] `npm exec -- pnpm test -- --runInBand` — 23 files passed, 393 tests passed, 10 skipped.
- [x] `CLEARDEED_BASE_URL=https://v0-cleardeed.vercel.app node scripts/verify-production-launch.mjs` — all checks passed.
- [x] `agent-browser` production smoke — page loaded, no Next.js error overlay, content and Khordha form controls rendered.

## Codex — Session 042

### Completed Tasks
- [x] Fixed production free-preview timeout: `/api/preview` now uses a `previewOnly` Bhulekh fetch path that skips screenshots, back-page fetch, and retries.
- [x] Fixed preview mapping to read owner from `tenants[0].tenantName` and land class display from the parsed tenant row.
- [x] Fixed `Search free` UI state: button disables and shows `Searching...` while preview is in flight.
- [x] Deployed production: `https://v0-cleardeed.vercel.app` → `dpl_HSMxwmdRTw79jbeUeGAZzfvjoMi4`.

### Verification
- [x] Runtime logs showed prior root cause: `POST /api/preview` returning 504, then the 45s preview guard firing during cold-start before RoR navigation completed.
- [x] `npm exec -- pnpm build`
- [x] Live local preview smoke: Bhubaneswar / Mendhasala / Plot 128 returned success in ~14s.
- [x] Production preview smoke: `POST /api/preview` returned `plotFound: true` for Bhubaneswar / Mendhasala / Plot 128.
- [x] Browser interaction smoke: after clicking `Search free`, the button was disabled with text `Searching...`.

## Codex — Session 043

### Completed Tasks
- [x] Diagnosed the user-reported Plot 415 failure as a Bhulekh browser/session failure being mislabeled as "Plot not found."
- [x] Hardened preview-only Bhulekh fetches with fresh browser sessions, a real retry path, explicit browser close, and clearer "Could not check Bhulekh" UI for source failures.
- [x] Deployed production: `https://v0-cleardeed.vercel.app` → `dpl_BcypxpYvWC5YsaDdzeADvagq8jER`.

### Verification
- [x] `npm exec -- pnpm build`
- [x] Live local preview smoke: Bhubaneswar / Mendhasala / Plot 415 returned `success`.
- [x] Production preview smoke: `POST /api/preview` returned `plotFound: true` for Bhubaneswar / Mendhasala / Plot 415 in ~31s.

## Codex — Session 044

### Completed Tasks
- [x] Changed the launch funnel from preview-first to paid-report-first: removed the buyer-facing `Search free` path and made `Get report` the payment/report CTA.
- [x] Kept post-payment behavior aligned with strategy: report renders inline in the browser, the report HTML includes its PDF download action, and email remains a copy/backup.
- [x] Updated homepage, Terms, `CURRENT_FOCUS.md`, `CLAUDE.md`, `claude.md`, and `DECISIONS.md` so future work follows the no-free-preview strategy.
- [x] Deployed production: `https://v0-cleardeed.vercel.app` → `dpl_EfpWgn4Pj7KQPGf6W81Bc4t3Mmg7`.

### Verification
- [x] `npm exec -- pnpm build`
- [x] Production UI smoke: old `Search free` / "no payment required" copy absent, `Get report` enabled after valid details + email, and Razorpay checkout iframe opens from the CTA.

## Claude Code — Session 045 (2026-05-15)

### Problem
Post-payment success callback showed "Payment successful! Your report is ready." but no report HTML rendered. The report wasn't being generated or retrieved properly.

### Root Cause
1. Payment success flow used client-side callback to `/api/payment/success` which did on-demand Bhulekh fetch (45-60s wait)
2. Pre-generation was attempted but `preGeneratedReportId` wasn't stored server-side — lost between client and server
3. The checkout session stored in Supabase had `session_data` as JSONB but `preGeneratedReportId` wasn't included

### Fix Applied
1. Created `/api/report/pregenerate` endpoint — generates report in background while buyer completes payment
2. Pre-generation result stored in DB immediately
3. Checkout session now stores `preGeneratedReportId` in `session_data` JSONB
4. Client updates checkout session with `preGeneratedReportId` after pre-generation starts
5. `/api/payment/success` now has fast path — retrieves pre-generated HTML from DB instead of re-running Bhulekh
6. `/api/webhook/razorpay` also updated with fast path
7. Better empty-HTML detection with user-friendly error message ("Report generation timed out. Your payment was successful — email us at support@cleardeed.in")

### Files Changed
- `apps/web/src/app/api/report/pregenerate/route.ts` — NEW
- `apps/web/src/app/api/payment/success/route.ts` — fast path + empty HTML detection
- `apps/web/src/app/api/checkout/route.ts` — stores preGeneratedReportId in JSONB
- `apps/web/src/app/api/webhook/razorpay/route.ts` — fast path
- `apps/web/src/components/BhulekhInputForm.tsx` — parallel pre-generation trigger
- `CURRENT_FOCUS.md` — updated with remaining tasks

### Deployments
- 2026-05-15: v0-cleardeed-feyma5bur-gmns-dos-projects.vercel.app

### Verification
- Build passes: `pnpm build` succeeds
- Route listing shows all new endpoints: /api/report/pregenerate, /api/checkout, /api/feedback, /api/preview
- End-to-end test pending — user to test with real Bhulekh data

## Codex — Session 046

### Problem
Post-payment reports were rendering, but most fields were missing, especially Bhulekh RoR owner/plot details.

### Root Cause
1. `/api/report/pregenerate` could fetch Bhulekh successfully, but A11 blocked the generated HTML because report copy still contained prohibited phrases: "clean title", "No encumbrances", and "no charges".
2. The client-side Razorpay success handler captured `preGeneratedReportId` as `null`, so `/api/payment/success` often skipped the pre-generated report and reran Bhulekh after payment.
3. The slow fallback reused a cached Chromium browser in serverless; production logs showed `browser.newPage: Target page, context or browser has been closed`.

### Fix Applied
- Reworded report copy to avoid prohibited legal-certainty phrases while preserving positive record signals.
- Kept `preGeneratedReportId` in refs/promise state through the Razorpay modal and made payment success recover it from `checkout_sessions` by order ID.
- Made serverless Bhulekh fetches use fresh browser sessions and close them after success.
- Fixed webhook fast-path ReferenceError caused by `persistenceEnabled` being referenced before declaration.

### Deployment
- Production deployed: `https://v0-cleardeed.vercel.app` → `dpl_EtP9wysXUUEr4ibwn6JKCcobLEyb`

### Verification
- [x] `npm exec -- pnpm build`
- [x] `npm exec -- pnpm test -- agents/consumer-report-writer/src/index.test.ts agents/output-auditor/src/index.test.ts --runInBand` — full suite passed: 23 files, 393 passed, 10 skipped.
- [x] `npm exec -- pnpm --filter @cleardeed/fetcher-bhulekh test -- --runInBand` — Bhulekh live fetcher passed, including front page, screenshots, and back page.
- [x] Production `/api/report/pregenerate` for Bhubaneswar / Mendhasala / Plot 415 returned `status: generated` in ~27s.
- [x] Supabase report `589da2d1-eac3-4e41-a7b7-3a33852fe9e8` has `sourceSummary.bhulekh = "1 tenant(s) under Khatiyan #415; Mendhasala"`, ~69 KB HTML, Plot 415, Khatiyan text, Bhulekh source text, PDF download, and no owner-unavailable fallback.

## Codex — Session 047

### Problem
The same RoR-missing behavior reappeared after payment. Production had generated report `b8d4ed42-1d6e-4dc8-9fc5-3c227c83f692` as `complete` even though `bhulekh_status = "failed"` and the HTML contained the owner-unavailable fallback.

### Root Cause
1. The pipeline allowed A10 report writing to continue when Bhulekh returned a failed source result.
2. The checkout flow still opened Razorpay before proving that a usable Bhulekh-backed report existed.
3. Payment success/webhook fast paths could return stored pre-generated HTML without rejecting hollow Bhulekh output.

### Fix Applied
- Added a hard `generateReportV11` gate: Bhulekh must have `status: success` and at least one tenant/owner record, or report generation throws.
- Changed the buyer CTA so `Get report` pre-generates the report first; Razorpay order creation happens only after a usable `preGeneratedReportId` exists.
- Added reusable hollow-report checks in payment success and Razorpay webhook paths: empty HTML, owner-unavailable fallback, `bhulekh: failed/error/not_covered/unknown`, or missing RoR markers are refused.
- Tightened webhook slow-path behavior so failed Bhulekh generation returns `status: failed` and does not email a hollow report.

### Deployment
- Production deployed: `https://v0-cleardeed.vercel.app` → `dpl_GGdp8sfy2QZxk1h9gJrQ46y49v9e`

### Verification
- [x] `npm exec -- pnpm build`
- [x] `npm exec -- pnpm test -- agents/consumer-report-writer/src/index.test.ts agents/output-auditor/src/index.test.ts --runInBand` — 23 files, 393 passed, 10 skipped.
- [x] `npm exec -- pnpm --filter @cleardeed/fetcher-bhulekh test -- --runInBand` — Bhulekh live fetcher passed, including RoR front page and back page.
- [x] Production `/api/report/pregenerate` for Bhubaneswar / Mendhasala / Plot 415 returned `status: generated` in 27.8s.
- [x] Supabase report `1e3d175b-c676-4b4d-9c53-c412775f44ec` is `complete`, has `bhulekh_status = "1 tenant(s) under Khatiyan #415; Mendhasala"`, ~69 KB HTML, Plot 415, Khatiyan text, Bhulekh source text, download action, and no owner-unavailable fallback.
- [x] Production negative smoke for invalid plots returns `status: failed`, stores `report_status: failed`, stores empty HTML, and does not call `/api/order` or `/api/checkout`.
- [x] Browser smoke confirmed `Get report` disables/greys out as `Preparing...` immediately after click.
