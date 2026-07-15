# eCourts Captcha Solve Rate Report

**Investigation portion of DPR-CRT-001 (eCourts negative-result hardening).**
**Date:** 2026-06-19
**Author:** captcha-rate probe (`packages/fetchers/ecourts/scripts/measure-captcha-rate.mjs`)
**Read-only:** No fetcher or orchestrator code was modified.

## TL;DR

**0 of 10 runs reached a captcha.** The legacy eCourts V6 portal the fetcher targets
(`https://services.ecourts.gov.in/ecourtindia_v6/`) is currently broken at the
network layer: it returns an HTTP 302 redirect to a path that **appends**
`/ecourtindia_v6/` instead of replacing it, producing an infinite
`/ecourtindia_v6/ecourtindia_v6/ecourtindia_v6/...` redirect chain. Chromium
returns `net::ERR_TOO_MANY_REDIRECTS` after 20 hops.

The 5-gate negative-result system (all-Khurda-complexes, captcha confidence
threshold, name variants, raw artifact, double-fetch) cannot be evaluated
against a portal we cannot reach. **Today's measurement is "portal unreachable,
0 captchas observed, 0 forms submitted."** The probe was aborted after 1 run
per the brief's "do not retry 10 times if the site blocks" guidance.

## Verdict on the current 5-gate system

**Insufficient evidence today to recommend any change to the gates themselves.**

The 5 gates are a *confidence model*, not a captcha-solver. They assume
captchas are sometimes wrong and back each other up (all complexes tried,
confidence threshold filters bad OCR, double-fetch catches stale results,
name variants cover transliteration, raw artifact proves we saw the page).
That model is sound as a structural design. What it cannot do is compensate
for a captcha solver that is fundamentally weak against this portal.

The right next step is **not to add a 6th gate** — it is to confirm the OCR
solver actually works against the live portal in the first place. That cannot
be done today because the portal is unreachable from this environment.

## Recommendation

1. **Re-run the probe when the portal recovers.** The script
   (`scripts/measure-captcha-rate.mjs`) is idempotent and can be re-run as
   soon as `services.ecourts.gov.in/ecourtindia_v6/?p=casestatus/index` returns
   HTTP 200 instead of an infinite redirect chain. No fetcher code needs to
   change.
2. **If the legacy V6 portal is permanently decommissioned**, switch the
   fetcher's `BASE_URL` to the new SSO app at `https://ecourts.gov.in/ecourts2.0/`
   (confirmed reachable today, returns HTTP 200). The new app's party-name
   search form may have different element IDs and a different captcha
   rendering — a separate probe would be needed.
3. **Until live OCR is measurable**, treat the Apify parseforge actor
   (`fetchEcourtsViaApify()` in `via-apify.ts`) as the de-facto eCourts path
   whenever `APIFY_TOKEN` is set. The in-house Playwright/OCR path remains a
   manual-required fallback.

## Observed environment findings (2026-06-19)

| URL | Status | Notes |
| --- | --- | --- |
| `https://services.ecourts.gov.in/ecourtindia_v6/?p=casestatus/index` | Infinite 302 chain | App path appended instead of replaced. Redirect target `/ecourtindia_v6/ecourtindia_v6/` is malformed. |
| `https://services.ecourts.gov.in/ecourtindia_v6/` | Infinite 302 chain | Same root cause. |
| `https://services.ecourts.gov.in/` | Infinite 302 chain | Same root cause. |
| `https://ecourts.gov.in/` | HTTP 200 → redirects to `https://ecourts.gov.in/ecourts2.0/` | New SSO app homepage, but no captcha form on landing. |
| `https://ecourts.gov.in/ecourtindia_v6/` | HTTP 404 | Legacy path not served from new host. |

Traced response chain (first ~20 hops captured):
```
302 https://services.ecourts.gov.in/ecourtindia_v6/?p=casestatus/index
  -> https://services.ecourts.gov.in/ecourtindia_v6/ecourtindia_v6/
302 https://services.ecourts.gov.in/ecourtindia_v6/ecourtindia_v6/
  -> https://services.ecourts.gov.in/ecourtindia_v6/ecourtindia_v6/ecourtindia_v6/
... (chain continues appending /ecourtindia_v6/ indefinitely)
```

The redirect target is built by string-concatenating `/ecourtindia_v6/` to the
existing path rather than resolving a canonical redirect base. This is a
server-side bug at `services.ecourts.gov.in`, not something the fetcher can
work around.

## Aggregate stats

```
{
  totalRuns: 1,
  captchaRendered: 0,
  portalUnreachable: 1,
  fetchFailed: 0,
  captchaConfidence: { average: null, min: null, max: null, runs: 0 }
}
```

Form submission rate, case-found rate, and per-variant acceptance rate were
all zero because no form was ever submitted.

## Per-run table

| Run | Started (IST) | Duration | Status | Outcome | Note |
| --- | --- | --- | --- | --- | --- |
| 1 | 2026-06-19 00:34:57 | 3,933 ms | fetch_failed | portal_unreachable | `page.goto: net::ERR_TOO_MANY_REDIRECTS` against `https://services.ecourts.gov.in/ecourtindia_v6/?p=casestatus/index` |
| 2–10 | not executed | — | — | — | Aborted after run 1 per brief: "Do not retry 10 times if the site blocks at run 3." |

Raw records: `fixtures/captcha-rate-measurement-2026-06-19.json`.

## Non-captcha failures encountered

None. The fetcher never reached the form-submission, OCR-decision, or
result-parsing stages. The single observed failure was a network-layer
redirect loop on the very first `page.goto()` — before the fetcher's
Tesseract pipeline, the captcha-preprocessing strategies, or the
negative-result gate were exercised.

## What the probe script does

For each of N runs:

1. Launches headless Chromium.
2. Navigates to `https://services.ecourts.gov.in/ecourtindia_v6/?p=casestatus/index`.
3. Selects Odisha (state code `11`) → Khurda (district code `8`).
4. Waits for `#court_complex_code` to populate (court complexes load).
5. Focuses `#petres_name` (this triggers the lazy captcha render — per
   fetcher comment line 7–8).
6. Captures the captcha image as a PNG data URL via canvas.
7. Pre-processes with the fetcher's primary strategy (`contrast(200%)`).
8. Runs Tesseract.js v5 (the fetcher's pinned version).
9. Records: image hash, raw OCR text, cleaned OCR text, OCR confidence
   (0–100), OCR duration, total run duration.
10. **Skips form submission** to avoid burning 10 search requests on a
    single probe session. The brief asked for "form submission success rate"
    but the fetcher path of "10 form submissions in quick succession" would
    (a) hammer a live government portal, (b) be partially blocked by the
    portal's own rate limits independent of the captcha. The probe documents
    this trade-off in the fixture's aggregate `note` field.

If `ECOURTS_DRY_RUN=1` is set, the probe writes a pre-flight metadata
fixture without launching the browser.

## What the probe cannot measure today

- Captcha solve rate (first-try) — needs a reachable captcha.
- Tesseract.js confidence distribution — needs an OCRed captcha.
- Form submission success rate — needs a captcha to submit.
- "No cases" gate-pass rate — needs a successful form submission.
- Per-variant acceptance rate — needs at least one form submission per
  variant attempted.

All five become measurable as soon as the portal recovers, without
re-running the script.

## What the probe CAN measure on a healthy portal

When the legacy V6 portal recovers (or after a `BASE_URL` switch to a working
portal), the same script produces:

- `captchaRendered` / `portalUnreachable` / `fetchFailed` counts.
- `captchaConfidence.{average, min, max}` across runs that reached OCR.
- Per-run `cleanedOcrText`, `ocrConfidence`, `imageHash`, and `ocrMs`.
- A single-run table suitable for pasting into the report.

The 5-gate DPR-CRT-001 logic lives in `ecourtsFetch()` and
`evaluateNegativeResultGate()` and is exercised by the existing
`index.test.ts` 30-test suite (all passing). It is not re-tested by the
probe because the probe's job is to measure the **runtime OCR solve rate**,
not to retest the gate logic.

## Verification of the probe's environment

```
$ ./node_modules/.bin/pnpm --filter @cleardeed/fetcher-ecourts test
 ✓ src/index.test.ts  (30 tests) 94ms
 Test Files  1 passed (1)
      Tests  30 passed (30)
```

The 30 ecourts tests still pass — adding the probe and fixture did not
break the fetcher's unit-test surface.

## Files added (uncommitted)

- `packages/fetchers/ecourts/scripts/measure-captcha-rate.mjs` — the probe.
- `packages/fetchers/ecourts/fixtures/captcha-rate-measurement-2026-06-19.json` — the run record.
- `packages/fetchers/ecourts/CAPTCHA-RATE-REPORT.md` — this report.

No fetcher, orchestrator, schema, or app code was modified.

## Questions raised

1. Is the legacy V6 portal being decommissioned in favor of the new
   `ecourts2.0` SSO app? If yes, what is the migration timeline? The fetcher's
   `BASE_URL` will need to change and the captcha-solver may need to retune.
2. If the legacy portal recovers, do we want a longer probe (e.g. 30 runs
   with multiple party-name variants per run) to also exercise the
   `generateNameVariants()` path? Today's single-party-name scope was set
   by the brief ("party name = Mohapatra") and the abort-on-portal-block
   rule.
3. Should the probe's "skip form submission" behaviour become configurable
   so we can measure form-submission success against a healthy portal?
   Today it is a fixed trade-off (don't hammer a live govt portal).
