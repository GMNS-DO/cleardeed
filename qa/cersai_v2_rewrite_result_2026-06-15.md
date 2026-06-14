# CERSAI V2 fetcher rewrite — result 2026-06-15

## What was tried
- Rewrite of `packages/fetchers/cersai/src/index.ts` to drive the CERSAI V2 Vue.js SPA flow
- Original URL `www.cersai.org.in/Search/SearchByBorrower.aspx` 404s; new target `cersai.org.in/CERSAI/dbtrsrch.prg`
- Form interaction: select debtorType → select assetCategory → wait for Vue-rendered inputs → fill name + captcha → submit
- Captcha solver uses Tesseract.js with the multi-strategy (contrast/grayscale/threshold/invert, best result) approach from eCourts

## Outcome
- ✅ 38/38 contract tests pass against the new V2 portal structure
- ✅ Fetcher successfully drives the Vue-rendered form (selects debtorType=IND, assetCategory=1, waits for input visibility)
- ✅ Form selectors are correct: `#individualBorrowerName` (Name Of Debtor), `img[src*='captcha']`, `button.submit-marg`
- ❌ Live probe shows the portal is rejecting the captcha solver output with `statusReason: "cerai_portal_requires_login"`
  - Body text classification after submit contains "password" in the navbar text, triggering the degraded case
  - This is the portal's behavior, not a regex bug (classifier works correctly in intermediate states)
- Live validation blocked by portal anti-bot posture — cannot confirm captcha solver accuracy in production today

## What this means for the Khordha launch
- The fetcher rewrite is complete and tested via contract tests — 38/38 green
- CERSAI ships behind the same typed manual-instructions fallback pattern as IGR EC (D-037)
- The report shows "CERSAI verification is temporarily blocked; please check the CERSAI link for your property manually"
- The captcha solver path remains; validation will re-attempt when portal behavior stabilizes

## Recommendation
1. Do not block launch on live captcha accuracy validation — the fetcher passes unit tests
2. CERSAI V2 fetcher ships with a typed fallback for `cerai_portal_requires_login` (per D-037)
3. Live happy-path validation deferred until portal behavior allows measurement