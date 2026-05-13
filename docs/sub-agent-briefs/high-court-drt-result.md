# Sub-Agent Brief: High Court + DRT Court Coverage

Parent session: 2026-04-30
Created: 2026-04-30

## Objective
Build Orissa High Court and DRT Bhubaneswar/Cuttack party-name search fetchers and document findings.

## Context

### Orissa High Court
- Portal: `https://hcservices.ecourts.gov.in/ecourtindiaHC` — same e-Courts platform as district courts
- Jurisdiction: all of Odisha (broader than district eCourts which only search one district at a time)
- Key form: `ki_petres.php` — party name + year + case status + securimage CAPTCHA
- Has CAPACITY: can find cases across Odisha in one search

### DRT Cuttack
- Portal: `https://cis.drt.gov.in/drtlive` — NICCI-managed public portal (no login required)
- DRT-2 Cuttack has jurisdiction for Odisha (confirmed `schemaname=20` in dropdown)
- Free text search: `page1_advocate.php` — no CAPTCHA, simpler than eCourts
- Main DRT portal `drt.gov.in` requires login — not usable
- DRAT New Delhi (`schemaname=100`) is the appellate for Odisha DRT decisions

### High Court e-Courts (same as district courts)
- Same `hcservices.ecourts.gov.in` domain and technology stack
- Party name search: `ki_petres.php` with `state_cd=11`, `court_code=1`
- Securimage CAPTCHA — Tesseract.js v5 OCR with 4-attempt retry
- Form validation: min 3 chars on party name, letters+periods+spaces only

### What was attempted and abandoned
- **drt.gov.in API**: The main DRT portal has a Laravel API at `https://drt.gov.in/DRT_application/public/index.php/api/v1/` but it requires login session (`SERVER_136_CIS` cookie from the CIS portal). Party-name search is not available via the API without authentication.
- **DRT-2 Bhubaneswar** (drtbankura.gov.in): Probe returned no content — not operational or unreachable.
- **CIS DRT diary/R-C search**: Confirmed these exist as separate tabs (Diary No. Wise, Advocate/Free text) but the party name tab is the most relevant for property due-diligence.
- **DRT v1 API endpoints**: Tried `/case-status`, `/party`, `/search`, `/diary` — all returned 404 Not Found. The API only exposes dropdown metadata and auction notices.

## What was produced

### Fetchers
- `packages/fetchers/high-court/` — `highCourtFetch()` using e-Courts High Court portal
- `packages/fetchers/drt/` — `drtFetch()` using CIS DRT portal with schemaname=20 (DRT Cuttack)

### Source documentation
- `docs/sources/high-court.md` — full portal documentation
- `docs/sources/drt.md` — full portal documentation including DRT/DRAT relationship

### Workspace wiring
- `pnpm-workspace.yaml` — added high-court and drt packages
- `vitest.config.ts` — added test includes and aliases
- `apps/web/next.config.ts` — added webpack aliases

## Test results
All 20 High Court + DRT tests pass. Full suite: 199 passing (1 skipped, pre-existing).

## Architecture notes

### High Court fetcher
- Follows the same pattern as the district eCourts fetcher (same securimage CAPTCHA, same e-Courts platform)
- State-wide search is an advantage over district courts (one search covers all of Odisha)
- OCR accuracy may differ from district eCourts (different captcha fonts) — captcha solve rate needs measurement

### DRT fetcher
- No CAPTCHA is the key advantage — faster and more reliable than district courts
- `case_type` dropdown is AJAX-populated after `schemaname` selection — requires Playwright (not HTTP)
- DRT table format is less standardized than eCourts — parser uses "Vs" and line-break patterns
- Supports optional DRAT appellate search (DRAT New Delhi, schemaname=100)

## New questions raised
1. Should the orchestrator include High Court + DRT by default, or only when district eCourts returns partial results?
2. DRT cases are financially dangerous (SARFAESI, recovery certificates) — should they get a separate section in the report with a mandatory banner flag?
3. e-Courts district courts + High Court + DRT = 3 separate searches. Is there a way to unify OCR infrastructure or consolidate the captcha pipeline?
4. The DRT CIS portal (cis.drt.gov.in) may have rate limits or session cookies we haven't discovered yet — needs 10+ run measurement.
5. Should DRT Cuttack (schemaname=20) also try DRT Jabalpur (24) and DRT Kolkata (26/27) since Odisha borders those states? The banner escalation rule in docs/sources/drt.md says DRT Jabalpur (24) and DRT Kolkata (26/27) are adjacent — may be worth probing.

## Next steps for live validation
1. Run `npm run healthcheck` for high-court and drt packages after Playwright browsers are available
2. Live test `highCourtFetch({ partyName: "Mohapatra" })` against production
3. Live test `drtFetch({ partyName: "Mohapatra" })` against production
4. Measure CAPTCHA solve rate for High Court (10 runs) vs district eCourts
5. Wire both into the orchestrator alongside existing eCourts search
