# Source: Orissa High Court

Last verified working: 2026-04-30 (probe session)
Owner module: `packages/fetchers/high-court`

## What it returns
Party-name search results from the Orissa High Court, Cuttack (jurisdiction: all of Odisha).
Returns: case number, case type, court name, filing date, status, and party names with roles.

## Portal
URL: `https://hcservices.ecourts.gov.in/ecourtindiaHC/cases/ki_petres.php`
(Shared e-Courts High Courts platform: same domain and technology as district eCourts)

## Endpoint(s)
- `GET/POST https://hcservices.ecourts.gov.in/ecourtindiaHC/cases/ki_petres.php`
- Parameters: `state_cd=11` (Odisha), `dist_cd=1`, `court_code=1` (Orissa HC), `stateNm=Odisha`
- Form fields: `petres_name` (party name), `rgyear` (year, 4-digit), `f` (Pending/Disposed/Both), `captcha` (OCR text)

## Authentication
None (public). Same session/cookie approach as district eCourts.

## Rate limits
Not published. No throttling detected. Playwright 30s timeout guards against hanging.

## CAPTCHA
Securimage CAPTCHA (same family as district eCourts).
Solved via Tesseract.js OCR with 4-attempt retry and confidence threshold (>=75).
Captcha image: `/ecourtindiaHC/securimage/securimage_show.php?<random>`
Refresh: `/ecourtindiaHC/securimage/securimage_play.swf?...` + `Math.random()` on image src

## Schema
Output: `CourtCaseResult` (same schema as district eCourts).
Key fields: `source="high_court"`, `searchMetadata.courtName="Orissa High Court"`,
`searchMetadata.stateCode="11"`, `searchMetadata.year`, `searchMetadata.caseStatus`.

## Known edge cases
- Minimum 3 characters required in `petres_name` field (enforced by JS validation)
- Only letters, periods, and spaces allowed in party name field
- Year field: 4 digits required if provided
- OCR failure rate for High Court securimage may differ from district eCourts

## Failure modes
- `captcha_failed`: OCR could not solve; search not completed — status: partial
- `portal_error`: Site down or returning non-HTML response — status: failed
- `no_cases_found`: Valid captcha, no records — status: partial, verification: manual_required
- Browser unavailable: status: failed, verification: manual_required

## Manual verification fallback
1. Visit: `https://hcservices.ecourts.gov.in/ecourtindiaHC/cases/ki_petres.php?state_cd=11&dist_cd=1&court_code=1&stateNm=Odisha`
2. Enter party name (>=3 chars), year (optional), select case status, enter captcha
3. Click "Go" — results shown in table below form

## Last known good response
Not yet live-tested. See probe notes in `packages/fetchers/high-court/src/index.ts`.

## Banner escalation rule
High Court title/land cases (specific performance, declaration, partition, SARFAESI, injunction, DRT recovery) involving seller + village/khata/plot escalate to banner-level findings.
High Court jurisdiction covers all districts in Odisha (broader than district courts).
