# LARR Honesty — Sprint V3

> **Decision recommendation:** option (b) for V1.1. Option (a) becomes the
> right call when the LARR fetcher is verified to run reliably against the
> Odisha Revenue SIA page and eCourts party-name search.

---

## The problem

The LARR (Land Acquisition, Rehabilitation and Resettlement) fetcher is
**built and unit-tested** at `packages/fetchers/larr/src/index.ts` and
`packages/fetchers/larr/src/index.test.ts`. It is **NOT wired into the V1.1
pipeline** at `apps/web/src/lib/pipeline/index.ts`. The pipeline only calls:

- `runReport()` (orchestrator — runs Bhulekh, Bhunaksha, Nominatim, eCourts, RCCMS, IGR EC, CERSAI)
- `reasonOwnership()` (A5)
- `classifyLand()` (A6)
- `screenRegulations()` (A8 — regulatory flags)
- `reasonEncumbrance()` (A7)
- `generateConsumerReport()` (A10)

The LARR fetcher (`fetch as larrFetch from "@cleardeed/fetcher-larr"`) is
not imported anywhere in the V1.1 pipeline.

As a result, in V1.1 every report's `#section-larr` block renders with
`larr === null`, which makes `buildLarrSection()` produce:
- Risk badge: **UNKNOWN**
- SIA text: "No known Social Impact Assessment (SIA) notifications detected automatically."
- Status text: "Manual verification recommended"
- RTI recommendation: "File an RTI application at the District Collector's office..."

This is **technically correct** (the section is honest about the data not
being available) but it is **structurally confusing** to a buyer — it looks
like a fetcher failure rather than a deliberate "we don't have this wired
yet" state.

---

## The two options

### Option (a) — Wire LARR into the V1.1 pipeline

**What it takes:**

1. Import `larrFetch` in `apps/web/src/lib/pipeline/index.ts`:
   ```ts
   import { fetch as larrFetch } from "@cleardeed/fetcher-larr";
   ```

2. Add a call after eCourts returns (re-using the seller name from input):
   ```ts
   const larrResult = await larrFetch({
     sellerName: input.claimedOwnerName,
     village: (bhunakshaData as any)?.village ?? "",
     lat: input.gps.lat,
     lon: input.gps.lon,
     districtCode: "8",
     districtName: "Khurda",
   });
   ```

3. Push the result into `orchestratorOutput.sources` as a new `larr` entry.

4. The mapper (`agents/consumer-report-writer/src/mapper.ts` line ~143) already
   reads `larr?.data` and exposes it as `larrRiskAssessment`. The A10
   renderer (`buildLarrSection`) consumes it. No renderer change needed.

**Cost:** ~1 day of engineering work to wire it in, plus Playwright dependency
on the LARR fetcher (the SIA scrape uses `chromium.launch()`). The Playwright
chain is the same dependency that hung RCCMS in the 2026-06-12 hotfix.

**Risk:** the SIA scrape uses Playwright against
`https://revenue.odisha.gov.in/en/Communication/sia-notification/4-1-notification`
which is the same anti-bot pattern that hung RCCMS. If the SIA page rate-limits
or blocks Playwright, every report will hang ~3 min before failing, just like
RCCMS. We would need to add the same `manual_required` fallback as the RCCMS
hotfix.

**Payoff:** Section 6 becomes a real risk assessment (HIGH / ELEVATED / LOW
based on actual eCourts LA cases + SIA page matches) rather than always
UNKNOWN.

### Option (b) — Replace the LARR section with an honest "not yet integrated" label

**What it takes:**

1. In `buildLarrSection()` (line 3060 of `agents/consumer-report-writer/src/index.ts`),
   detect when `larr === null` AND the V1.1 special_handling flag is set, and
   render a clearly-labeled "LARR data not yet integrated for Khordha — manual
   check at [link]" box instead of the generic UNKNOWN badge.

2. Update the section's class from `caution-box` to a new `larr-not-wired` class
   so it's visually distinct from "fetcher failed".

3. Update the degradation tag taxonomy in `qa/section_validators/_inventories.md`
   to include `larr_not_wired` as a known-degraded state.

4. Update `qa/section_validators/section-larr.test.ts` to assert the
   `larr_not_wired` text appears (already partially done in the current
   validator — see "V1.1 known-degraded state" test).

**Cost:** ~2 hours of work. No new fetcher calls, no Playwright dependency,
no risk of the 3-min hang.

**Risk:** the section looks "less rich" than the other 6 sections. Some buyers
may notice the "not yet integrated" label and lose trust. Mitigate by:
- Making the label clear that this is a transparency signal, not a fetcher failure
- Linking to the LARR RTI page so the buyer can act on it themselves
- Logging a metric: "LARR reports served without automated check" so we can
  track the gap

**Payoff:** no regression risk. Section 6 is honest. Engineering effort goes
to other V1.1 work.

---

## Recommendation: option (b) for V1.1

**Why:**

1. **Faster.** 2 hours vs 1 day. Sprint V3 is about validation, not adding
   new fetchers.
2. **Lower regression risk.** No Playwright dependency on a new page that
   hasn't been battle-tested. RCCMS already proved that the Playwright
   chain can hang.
3. **Honest-by-default.** The current UNKNOWN state is technically honest
   but visually identical to "fetcher failed". A clear "not yet integrated"
   label is more honest and easier to reason about.
4. **Reversible.** When the LARR fetcher is verified (after we solve the
   Playwright hang on the SIA page), we can wire it in with no schema
   change — the mapper already passes `larrRiskAssessment` through.
5. **Tracks the gap.** A typed `larr_not_wired` tag in the degradation
   matrix + a counter in the report audit log lets us see exactly how many
   reports are served with the degraded section. This is the kind of metric
   the consumer-track needs (see `COMMERCIAL_TRACK.md` — feedback
   infrastructure ships before the polish).

**When to switch to option (a):**

- After we have ≥50 reports served in production with the `larr_not_wired`
  label and zero buyer complaints about the section being empty.
- After we have a fallback for the SIA Playwright hang (likely a `rccms`-style
  `manual_required` short-circuit).
- After the LARR fetcher's Playwright probe passes an Soak test of 10
  consecutive runs without a >30s hang.

**When NOT to switch to option (a):**

- Don't add the LARR call to the V1.1 pipeline just to make the section
  look richer. The whole point of Sprint V3 is to validate what we already
  ship, not to add new automated checks.

---

## Action items for option (b)

| # | What | Where | Effort |
|---|---|---|---|
| 1 | Add `larr_not_wired` class to the LARR section when `larr === null` in V1.1 | `agents/consumer-report-writer/src/index.ts` line 3060 | 30 min |
| 2 | Update the section text to "LARR data not yet integrated for Khordha — manual check at https://revenue.odisha.gov.in/en/Communication/sia-notification/4-1-notification" | same | 30 min |
| 3 | Add a typed `larr_not_wired` tag to `qa/section_validators/_inventories.md` | `_inventories.md` Section 6 row | 15 min |
| 4 | Update `qa/degradation_matrix.json` `fetchers.larr` cells to use the new consumer_message | `degradation_matrix.json` | 15 min |
| 5 | Add a counter to the report audit log: `larr_not_wired_count` per `reportId` | `agents/output-auditor/src/index.ts` | 1 hour |
| 6 | Update the V3 section-larr validator to assert the `larr_not_wired` text appears | `qa/section_validators/section-larr.test.ts` | already done |

Total: ~3 hours. Fits in the Sprint V3 scope.

---

## What this document is NOT

This document is **not** a permanent decision. The decision is logged in
`DECISIONS.md` (D-XXX — to be added when this analysis is accepted) as
"option (b) for V1.1, switch to (a) after Playwright reliability work". If
the LARR fetcher's Playwright dependency is solved in Sprint 5+ (e.g. by
adding the SIA page to the Bhulekh Mirror's headless-browser pool), this
document should be superseded by a new entry in `DECISIONS.md` and the
section should be wired in.

---

*Last touched: 2026-06-12. Sprint V3 scaffolding.*
