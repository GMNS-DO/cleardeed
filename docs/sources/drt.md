# Source: DRT Bhubaneswar / Cuttack

Last verified working: 2026-04-30 (probe session)
Owner module: `packages/fetchers/drt`

## What it returns
Party-name search results from DRT Cuttack (DRT-2, jurisdiction for Odisha).
Also covers DRAT New Delhi (appellate for Odisha) when `includeDRAT` is set.
Returns: case number, case type, court name, filing date, status, and parties with roles.

## Portal
URL: `https://cis.drt.gov.in/drtlive/order/page1_advocate.php`
(NICCI-managed public DRT portal — different from the login-protected drt.gov.in)

## Endpoint(s)
- `POST https://cis.drt.gov.in/drtlive/order/page1_advocate.php`
- Form fields: `schemaname` (DRT ID, required), `case_type` (AJAX-populated), `petitioner respondent` (party name free text)
- DRT Cuttack schemaname value: `20` (confirmed in dropdown list)
- DRAT New Delhi: `100`; DRAT Kolkata: `104`

## Authentication
None (public on CIS DRT portal).
Main DRT portal (`drt.gov.in`) requires login — not used for party search.

## Rate limits
Not published. No captcha means no OCR bottleneck.
Playwright 30s timeout guards against hanging.

## CAPTCHA
None on the CIS DRT portal (`page1_advocate.php`).
This is the key advantage over district eCourts and High Court — simpler automation.

## Schema
Output: `CourtCaseResult` (same schema as district eCourts).
Key fields: `source="drt"`, `searchMetadata.drtCodes[]` (array of `{code, name}`),
`searchMetadata.partyName`, `searchMetadata.nameVariantsTried`.

## Known edge cases
- `case_type` dropdown is AJAX-populated after `schemaname` selection — requires Playwright (not plain HTTP)
- DRT table format is less standardized than eCourts; "Vs" or line-break party separators
- Multiple DRTs can have overlapping jurisdiction; searching DRT + DRAT doubles coverage
- DRT Cuttack schemaname confirmed as `20`; other Odisha-adjacent DRTs: DRT Jabalpur (24), DRT Kolkata (26/27)

## Failure modes
- `portal_error`: CIS DRT down or returning non-HTML — status: failed
- `no_cases_found`: Valid search, no records — status: partial, verification: manual_required
- Browser unavailable: status: failed, verification: manual_required
- schemaname selection failing: AJAX cascade not completing — status: failed

## Manual verification fallback
1. Visit: `https://cis.drt.gov.in/drtlive/order/page1_advocate.php`
2. Select "DEBTS RECOVERY TRIBUNAL CUTTACK" from DRT/DRAT dropdown
3. Wait for Case Type dropdown to populate
4. Enter party name and click Submit
5. Results in table format

## Last known good response
Not yet live-tested. See probe notes in `packages/fetchers/drt/src/index.ts`.

## Banner escalation rule
DRT recovery certificate cases (SARFAESI, bank recovery, financial default) involving seller/plot escalate to banner-level findings.
DRT cases are the most financially dangerous for land buyers — a property with an active DRT recovery is encumbered.

## Relationship to district eCourts
DRT Cuttack searches for recovery cases involving Odisha parties.
eCourts district courts search for civil/litigation cases.
High Court searches for all case types across Odisha.
All three should be queried for a complete litigation picture.
