# CURRENT_FOCUS.md

> **One page. Updated daily. Delete completed items rather than marking them done.**
> If this file is longer than what fits on one screen without scrolling, you are using it wrong.
> Today is the only thing that matters.
> **Implementation sprints only. Commercial activities begin after PI 3. See `COMMERCIAL_TRACK.md`.**

---

## This week's user behavior (the only thing that ships)

**Sprint 6 — Week 9 — SHIPPED**

> **A buyer in Khordha can pay ₹1 and get a report where at most 1 of 6 sections ends in a hard `failed` status.** Typed degradation (RCCMS timeout, BDA out of scope, CERSAI "no charges found") is acceptable; silent failure is not.

**Sprint 6 exit criteria (all done):**
- [x] RCCMS re-enabled in pipeline with 5s timeout (replaces D-030 hardcoded stub) — `ad6c66a`
- [x] CERSAI "no charges found" returns `status: "success"` with `data.total = 0` (positive signal, not failure) — `d943f59`
- [x] BDA-zoning distinguishes "out of BDA jurisdiction" from "no_match" (neutral, not failure) — `cdffdb8`
- [x] eCourts district code fix (`8` not `561`) shipped — `23268cd`
- [x] All four fixes gated by tests in `qa/fetcher_tests/`; 1231 tests pass (2 pre-existing bhunaksha failures unrelated)

**Still open from Sprint 6 scope:**
- [ ] IGR EC query range: 5 years → 1 year (1-line edit at `apps/web/src/lib/pipeline/index.ts:443`)
- [ ] Founder registers operational IGR citizen account at `Admin/Login/NEW/NewUser.aspx` (15 min, blocking IGR EC V2 build per D-034)
- [ ] Credentials stored in Vercel: `IGR_CITIZEN_LOGIN_ID`, `IGR_CITIZEN_PASSWORD`

**Next: PI-V Sprint V2 (per-fetcher contract tests).** See `BLOCKER3_PLAN_2026-06-12.md` for context.

---

## Sprint 3 exit criteria

- [x] eCourts wired into pipeline (owner name search against Khordha court complex)
- [x] IGR EC wired into pipeline (Encumbrance Certificate search)
- [x] CERSAI wired into pipeline (mortgage/charge check by owner name)
- [x] RCCMS wired into pipeline (revenue court cases) — now probes live portal
- [x] Financial exposure summary panel in report HTML (#section-financial)
- [x] Per-tehsil EC instructions panel (Bhubaneswar, Jatni, Balipatna, Banapur, Khandagiri)
- [x] CERSAI captcha solver: real Tesseract.js OCR (was stub throwing error)
- [x] Next.js build fixed: playwright packages externalized to resolve vite/recorder HTML parse error
- [x] Sprint 1–3 regression: build passes ✓

## Sprint 5 exit criteria

- [x] Print-optimized CSS in report HTML (`@media print` rules, 12pt minimum, page-break-inside avoid, footer with page numbers + source URLs)
- [x] Verify-yourself source links inline in 5 sections (Bhulekh, IGR EC, CERSAI, eCourts, Bhunaksha) — 8 anchors added
- [x] Conversion funnel instrumentation: 6 stage events (page_view, plot_search, report_generated, payment_started, payment_completed, report_viewed)
- [x] 60-day report validity (expires_at + revoked_at columns, pay-to-refresh checkout via existing Razorpay pattern, ₹1 refresh)
- [x] 6-section regression test (2 test cases asserting all 6 section IDs render)
- [x] **Pipeline end-to-end works in browser** — pregenerate returns 200 in ~60s, /report/[id] page renders (RCCMS probe disabled as workaround, see BACKLOG)

## Pre-Sprint-5 hotfix (2026-06-12)

- [x] **RCCMS Playwright probe hang:** `rccmsFetch` was hanging >3min on `rccms.odisha.gov.in` (chromium.launch + page.goto never resolved). Pipeline now skips RCCMS, marks `verification=manual_required`, and reports ship in ~60s. Buyers see a note to verify revenue court cases manually. Tracked in BACKLOG.md for Sprint 6.

## Sprint 4 exit criteria

- [x] `khordha_circle_rates.json` with floor rates for top 50 villages
- [x] Section 7 (What is it worth) shows circle rate floor band with rate + view-source link
- [x] D/88 sub-plot detector: regex fires HIGH WATCH-OUT when surveyNo matches `D/\d+` or `\d+/\d+`
- [x] BDA zoning data for top 50 village/locality combos (residential / commercial / industrial / green-belt)
- [x] Land classifier surfaces BDA zone alongside kisam restrictions
- [x] Section 7 refactored to 3-band floor / directional / ceiling layout
- [x] Build passes (TypeScript compilation verified; pre-existing `/404` prerender issue tracked separately)

**Deferred to BACKLOG or Sprint 5+** (out of scope for Sprint 4):
- MagicBricks/99acres scraping (high effort, TOS risk)
- IGR village-level sale records (IGR requires login)
- Bhuvan flood layer (requires ORSAC WFS access)

---

## Sprint 2 regression checklist

Run against Mendhasala / Plot 415:
- [x] Home page loads without error
- [x] Step 1: Tehsil/village selection works
- [x] Step 2: Plot number entry works
- [x] Step 3: Email required, Razorpay opens on "Get report"
- [x] Payment success → report renders in-browser
- [x] Download button produces PDF
- [x] Email arrives (check inbox)
- [ ] No-token `/report/{id}` blocked in production
- [x] bhunakshaPolygon pregenerate working (village CQL filter)
- [ ] Map renders in report UI (map stuck at loading — parked, BACKLOG.md)

---

## Blockers

- `NEXT_PUBLIC_MAPBOX_TOKEN` env var needed for Mapbox GL JS — add to Vercel before deploy
- Map loading stuck — parked in BACKLOG, needs client-side investigation

---

## What's been built this sprint

**Financial exposure (Sprint 3):**
- `apps/web/src/lib/pipeline/index.ts` — eCourts, IGR EC, CERSAI, RCCMS fetchers called in generateReportV11 after Bhulekh
- `buildSourceResult()` helper converts raw fetcher results into SourceResult[] for mapToReportInput
- A7 EncumbranceReasoner (manual instructions) wired in with IGR EC + CERSAI results
- Report HTML now includes `#section-financial` with risk badges (clear/at-risk/unquantified)
- Per-tehsil EC instructions: `apps/web/src/lib/ec-instructions.ts` with Bhubaneswar, Jatni, Balipatna, Banapur, Khandagiri SROs
- CERSAI captcha solver: replaced stub `performBasicOcr()` with real `performOcr()` using Tesseract.js + multi-strategy (contrast/grayscale/threshold/invert)
- RCCMS: replaced placeholder with live portal probe (rccms.odisha.gov.in) + Playwright search attempt
- IGR link updated to `www.igrodisha.gov.in` (no more broken `igrodisha.gov.in` URL)

**Build fix (Sprint 3):**
- Next.js webpack build failed on playwright's vite/recorder HTML file — resolved by externalizing playwright/playwright-core/tesseract.js in webpack config (`config.externals`)

**Bhunaksha map (Sprint 2):**
- Bhunaksha village CQL filter: `revenue_village_name LIKE '%VillageName%'` + `revenue_plot = '<plotNo>'`
- `resolveVillageGps()` fallback: tehsil centroids for villages Nominatim can't find
- Pipeline → Bhunaksha → polygon → pregenerate response → checkout session → payment success → display

---

## Friday retrospective

**Did the product infrastructure ship?**
Yes — all five financial exposure sources wired, per-tehsil EC instructions, CERSAI OCR fixed, build passing. Sprint 3 automation complete.

---

*Last touched: 2026-06-12*

---

## This week's user behavior (the only thing that ships)

**PI-V — Sprint V1 (Week 1–2)**

> **A test runner can enumerate every valid Khordha input combination and the QA harness knows what the right answer is for 50 of them.**

**Sprint V1 exit criteria:**
- [x] 4,389 valid Khordha input combinations enumerated in `qa/khordha_inputs.json`
- [x] 50 ground-truth plot scaffolds created with manifest schema and manual verification instructions
- [x] 24 corpus-scope negative test cases in `qa/invalid_inputs.json`
- [x] Input taxonomy script `scripts/enumerate_inputs.mjs` regenerates inputs deterministically
- [x] Coverage matrix `qa/_corpus_coverage.md` shows per-tahasil × pattern × BDA zone × kisam class coverage

**Pre-existing work still shipping:**
- `generateReportV11` pipeline working end-to-end (~60s for Mendhasala/415)
- 6-report sections rendering correctly per user behavior in CURRENT_FOCUS.md
- Print-optimized CSS, 60-day expiry, verify-yourself links, conversion funnel instrumentation all intact
- RCCMS probe disabled with manual_required note (hotfix applied)

**Blocked on founder work:** Manual verification of 50 ground-truth plots across live portals (~15–20 hours). The harness is ready and tests 617 pass — ground-truth corpus needs population.

---

## PI-V Validation (Sprints V1–V4)

Inserted between PI 1 (Sprints 1–5) and PI 2 (Sprints 6–10). Deploy a validation-first approach before Cuttack launch.

**V1** (this sprint): Input taxonomy + ground truth corpus.  
**V2**: Per-fetcher contract tests.  
**V3**: Section-level validators + degradation matrix.  
**V4**: Shadow runner + invalid input gate + CI regression suite.

Cuttack launch gates on PI-V V4: ≥95% valid inputs produce correct/typed-degraded reports, 50-plot regression suite green.
