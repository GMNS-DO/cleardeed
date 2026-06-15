# Sprint V5c — Live smoke result (2026-06-15)

**Date:** 2026-06-15
**Portal:** `igrodisha.gov.in` (live public endpoints)
**Script:** `qa/smoke/v5c_live_smoke.mts`

## Result table

| Fetcher              | Status   | Reason                              | Notes |
|----------------------|----------|-------------------------------------|-------|
| public-dashboard     | success  | live_page_alive                     | All 3 dashboard pages (PublicDashboard.aspx, DeedWiseStatus.aspx, ORServiceNew.aspx) return 200 + page shell > 1KB. |
| govt-fee             | success  | permanent_cache                     | Matched "Sale" → 5% stamp + 2% reg + ₹100 min (correct per IGR schedule). |
| igr-certified-copy   | not_covered | live_page_alive_no_captcha_bypass | Page alive, Phase 1 typed-degrade per D-046: §57 note (314 chars) + 6 manual-instructions steps + est. fee ₹30. |

All 3 fetchers return Zod-valid envelopes; pipeline path verified end-to-end.

## What this proves
1. **All 3 V5c fetchers run end-to-end** against the IGR portal and degrade correctly.
2. **2 of 3 are typed-degrade by design** (D-046): public-dashboard is server-rendered (no JSON API); certified-copy is captcha+login-gated. Both still ship a useful envelope (verified-live URL + manual instructions).
3. **1 of 3 returns real data** (govt-fee) — the permanent typed cache of the IGR fee schedule, sourced from GovtFeeDtls.aspx. Matched "Sale" returns the correct percentages.
4. **Pipeline degradation is buyer-safe** — even when the fetcher can't return data, the renderer still gets a typed envelope with a fallback link and the §57 transparency note.

## V5c exit-criteria progress
- [x] 3 fetcher packages shipped
- [x] Unit tests pass (24/24)
- [x] Contract files + barrel exports
- [x] Workspace registration + vitest aliases
- [x] V11 pipeline integration (Step 2j/2k/2l)
- [x] `Section 7: Official References & Fees` (Section 6 expanded)
- [x] Section 2 "Previous sale deed (open index entry)" sub-card with §57 transparency
- [x] Live smoke — 3 fetchers pass (2 typed-degrade by design, 1 returns real data)
- [ ] Pre-fill P020 manifest (founder)
- [ ] 5 ground-truth plots pass
- [ ] PDF render verification of V5c sub-cards

**Test suite:** 24/24 V5c unit tests + 92/92 consumer-report-writer + apps/web + 116/116 combined V5c+consumer-report-writer+apps/web.
