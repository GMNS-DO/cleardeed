# Bhunaksha Area Regression

Last updated: 2026-04-30
Status: live WFS path reachable; Bhulekh live pairing blocked in this environment

## Purpose

Guard against treating GeoServer `shape_area` as square metres. The report must use Turf/geodesic polygon area from WFS coordinates, then reconcile that value against the Bhulekh target plot row area before making an area consistency claim.

## Current Harness

`packages/fetchers/bhunaksha/src/index.test.ts` includes a live-gated regression:

```bash
CLEARDEED_LIVE_BHUNAKSHA_AREA=1 \
CLEARDEED_LIVE_BHULEKH_AREA_ACRES=<observed-target-plot-acres> \
npx vitest run packages/fetchers/bhunaksha/src/index.test.ts
```

Optional coordinate overrides:

- `CLEARDEED_LIVE_BHUNAKSHA_LAT`, default `20.272688`
- `CLEARDEED_LIVE_BHUNAKSHA_LON`, default `85.701271`

The test fetches live WFS, computes Turf area from the returned polygon, converts to acres, and asserts a `<=5%` discrepancy against the supplied observed Bhulekh target plot row area. The Bhulekh area is intentionally an explicit input so we do not lock a stale or unverified area into the test.

## Latest Local Probe

Recorded artifact: `docs/metrics/bhunaksha-area-regression-2026-04-30.json`

- WFS health check: passed after narrowing the BBOX to a production-sized probe.
- Live WFS for `20.272688,85.701271`: success, plot `127`, village `Mendhasala`, area `0.001808857090686576 sq_km`.
- Raw `shape_area`: `1.5595729140254912e-7` degrees², retained only as metadata.
- Bhulekh live pairing for plot `127`: not completed; Playwright browser bootstrap did not progress in this shell before the probe was stopped.

## Claim Gate

Until a Bhulekh target row area is observed in the same run, area copy may say that Bhunaksha returned a polygon area, but must not say that the area is reconciled with Bhulekh.
