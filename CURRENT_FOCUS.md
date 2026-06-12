# CURRENT_FOCUS.md

> **One page. Updated daily. Delete completed items rather than marking them done.**
> If this file is longer than what fits on one screen without scrolling, you are using it wrong.
> Today is the only thing that matters.
> **Implementation sprints only. Commercial activities begin after PI 3. See `COMMERCIAL_TRACK.md`.**

---

## This week's user behavior (the only thing that ships)

**Sprint 5 — Week 8**

> **A buyer in Khordha can pay ₹1, view a 6-section report in the browser, download a print-optimized PDF, refresh the URL within 60 days for free, and re-pay ₹1 to refresh after expiry.**

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
