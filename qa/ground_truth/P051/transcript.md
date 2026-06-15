# P051 — Bhubaneswar / Mendhasala / 181/10454 — Verification Transcript

> This is the **anchor case for the Bhunaksha Plot Report fetcher** (a sibling
> of the existing Bhunaksha polygon fetcher). All 9 fields + the cadastral
> map image were captured live against the portal and are in the manifest.

## What this plot covers

- **Fetcher target:** Bhunaksha Plot Report (plotreportOR.jsp)
- **Tahasil:** Bhubaneswar (code 3)
- **Village:** Mendhasala
- **RI:** Bhubaneswar
- **Plot no:** 181/10454 (fraction pattern)
- **GIS code:** 20021110500
- **Khatiyan:** 500
- **BDA zone:** residential
- **Kisam class:** residential

## Live fetch — 2026-06-14

This manifest was populated automatically by the `smoke-mendhasala.ts` script
in `packages/fetchers/bhunaksha-plot-report/`. The script:

1. Resolves the giscode by looking up the GIS-code table
   (`packages/fetchers/bhunaksha-plot-report/src/gis-codes.ts`) for
   `Bhubaneswar/Mendhasala/RI-Bhubaneswar` → 20021110500.
2. GETs `https://app3bhunakshaodisha.nic.in/bhunaksha/21/plotreportOR.jsp?state=21&giscode=20021110500&plotno=181%2F10454`.
3. The page is a JS loader — Playwright executes it, waits for `#htmlReport`,
   and waits for `networkidle` so the AJAX POST to `../rest/ReportsOR/PlotReport`
   completes.
4. Extracts all `position:absolute;left:Xpx;top:Ypx;...` divs as
   `(left, top, width, height, text)` cells. Matches labels to values by
   spatial proximity (closest top first, then closest left).
5. Splits the owner block on the Odia separators `SWA:`, `JAA:`, `BAA:`.
6. Picks the largest `<img>` in `#htmlReport` (≥100px) and downloads it via
   Playwright's `page.request.get()` — the servlet requires the browser's
   JSESSIONID cookie, so Node's `globalThis.fetch` cannot reach it.
7. Wraps the deliverable in a `BhunakshaPlotReportResult` envelope and
   returns it. Elapsed: ~8s end-to-end (Playwright + chromium warm).

## Live values captured (anchor)

| Field | Value | Source |
|---|---|---|
| `plotNo` | 181/10454 | ପ୍ଳଟ ନମ୍ବର label |
| `khatiyanNo` | 500 | ଖତିୟାନ ନମ୍ବର label |
| `thana` | 2 | ଥାନା label (portal renders digit) |
| `thanaNo` | 2 | ଥାନା ନମ୍ବର label (portal renders digit) |
| `mouza` | ମେଣ୍ଢାଶାଳ | ମୌଜା label |
| `tehsil` | ଭୁବନେଶ୍ଵର | ତହସୀଲ label |
| `district` | ଖୋର୍ଦ୍ଧା | ଜିଲ୍ଲା label |
| `area.acres` | 0 | ଏକର cell |
| `area.decimal` | 100 | ଡିସିମଲ cell |
| `area.hectare` | 0.04046 | ହେକ୍ଟର cell |
| `owner.name` | ଦୀକ୍ଷା ମହାପାତ୍ର | before `SWA:` |
| `owner.father` | ସମୀର କୁମାର | between `SWA:` and `JAA:` |
| `owner.caste` | ବ୍ରାହ୍ମଣ | between `JAA:` and `BAA:` |
| `owner.address` | (full Bhubaneswar address) | after `BAA:` |
| `mapScale` | 1:500 | ସ୍କୌ label |
| `gisCode` | 20021110500 | resolved via gis-code table |
| `mapImageBase64` | 602,836 bytes | `../servlets/image?image=img_0_0_34.svg` |

## Odia codepoint correctness (2026-06-14)

The first end-to-end run failed on the owner block because the source had
**U+0B71 (ୱ "wa")** in the SWA: separator list, but the portal actually
renders **U+0B35 (ଵ "va")**. Visually nearly identical; `String.includes`
is byte-exact. Fixed at the parser level in
`packages/fetchers/bhunaksha-plot-report/src/index.ts:438`.

## Coverage matrix delta

- P051 fills the **Plot-report** column for **Bhubaneswar × fraction** —
  unique anchor case for the per-plot report fetcher.
- P001 (Plot 415, numeric) is the polygon-fetcher anchor; P051 (Plot
  181/10454, fraction) is the plot-report-fetcher anchor.
- Future plots in the corpus should fill the other 9 fetcher slices (bhulekh,
  bhunaksha, igr-ec, cersai, rccms, circle-rate, bda-zoning, nominatim,
  ecourts) — out of scope for this work, founder task.

## Steps to re-verify manually

1. Open https://app3bhunakshaodisha.nic.in/bhunaksha/21/plotreportOR.jsp?state=21&giscode=20021110500&plotno=181%2F10454
2. Wait for the JavaScript loader to render `#htmlReport` (it POSTs to
   `../rest/ReportsOR/PlotReport`).
3. Verify the 9 text fields, 4 owner-block pieces, and the 1:500 scale in
   the bottom-left of the map.
4. Save the rendered map image (img_0_0_34.svg → converted to PNG by the
   Playwright step) as `qa/ground_truth/P051/screenshots/plot_map.png`.

## Screenshot destinations

- `qa/ground_truth/P051/screenshots/plot_report_dom.png` (full page DOM render)
- `qa/ground_truth/P051/screenshots/plot_map.png` (cadastral map image, 588 KB)
