# eCourts P051 live smoke test — result 2026-06-15

## What was tried
- Smoke test at `scripts/smoke/ecourts-p051-smoke.ts`
- Target: P051 owner "Deeksha Mahapatra" (Mendhasala 181/10454, Bhubaneswar Tehsil, Khordha)
- Expected: clean "no_records" with `negativeResultConfidence: "high"`

## Outcome
- Live portal at `services.ecourts.gov.in/ecourtindia_v6/?p=casestatus/index` is in a hard anti-bot/anti-scraping posture today
- First request: 302 to relative path `ecourtindia_v6/` (Playwright then 302-loops into `/ecourtindia_v6/ecourtindia_v6/` and loops again)
- Subsequent curl probes with real Chrome User-Agent: 403 Forbidden
- Smoke test exits `failed` with `statusReason: "fetch_failed"` after 2.2s

## What this means for the Khordha launch
- The fetcher code itself is sound: 18/18 contract tests pass, and the workflow was last verified live on 2026-04-17 per `scripts/probe/ecourts.md`
- The portal is rejecting all unauthenticated browser-shaped traffic today
- eCourts degrades to typed manual-instructions in the buyer report — same posture as IGR EC (D-037)
- This is consistent with the eCourts reliability grade in the launch audit: "Untested at scale — district code fix shipped, but no live eCourts result has been end-to-end verified"

## Recommendation
1. Do not block Khordha launch on this. eCourts was already classified YELLOW in the launch audit, and the portal's behavior today only confirms what we already knew.
2. Defer the live happy-path validation to next week when the portal state may have changed.
3. Add a typed degradation path for `fetch_failed` due to portal anti-bot — the report should show "eCourts portal is currently blocking automated access; please verify manually at the eCourts link below." This is the same pattern already used for IGR EC.
