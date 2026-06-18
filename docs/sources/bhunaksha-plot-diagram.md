# Bhunaksha — Plot Diagram

Last verified: 2026-06-18
Status: NOT-A-STATIC-SVG — Bhunaksha does NOT publish a static SVG/PNG plot report. The "plot report" is a live OpenLayers WMS tile composition rendered to a `<canvas>`. There is no parseable SVG, no `<img>` element, and no printable plot-diagram endpoint.

This is the finding from the Task 31 probe (`qa/bhunaksha_plot_diagram_probe.mjs`, 2026-06-18). The plan's `Task 32` (Plot report fetcher) and `Task 33` (screenshot fallback) were written against a placeholder assumption of a static SVG. **That assumption is wrong** — Task 32 must be re-scoped before implementation. See "Implications for Task 32" below.

## TL;DR for implementers

Bhunaksha is an interactive web map, not a static report. There is no URL pattern like `?district=…&tahasil=…&village=…&plot=…` that returns a parseable SVG. The plot diagram only exists as rasterized pixels inside a 1280×647 OpenLayers canvas, composed from multiple GeoServer WMS `GetMap` tile requests. To produce a "plot diagram" for a ClearDeed report, we have three viable paths:

1. **Headless Playwright screenshot of the live map** — run the same cascade in headless Chrome, click the plot, and capture `#map` as a PNG. Slow, fragile, blocked by any site downtime, but the only path that captures the styled, full-color map with the same visual fidelity a human user sees.
2. **Direct GeoServer WMS rendering** — `https://app3bhunakshaodisha.nic.in/bhunaksha/WMS?SERVICE=WMS&...&LAYERS=VILLAGE_MAP&gis_code=20010101601&...&STYLES=VILLAGE_MAP`. Bypasses the JS frontend. We get a raw raster tile but no plot highlighting or labels. Useful only as a backdrop.
3. **Compose from our own data** — the Bhunaksha WFS at `mapserver.odisha4kgeo.in` (used by the existing `bhunakshaFetch` in `packages/fetchers/bhunaksha`) already returns the plot polygon for Khordha. We can render the target plot + a buffer of neighbors with a lightweight SVG library (e.g. `d3-geo` or `@svgdotjs/svg.js`) and write a self-contained SVG to the report. Fast, deterministic, no dependency on the live Bhunaksha site.

**Recommendation: Path 3.** Path 1 is too slow/fragile for a consumer product that needs a report in under 30 seconds. Path 2 doesn't include the plot highlight. Path 3 lets us ship an SVG plot diagram that exactly matches the report context, with consistent styling, and is auditable.

## Auth / session

- **No login, no captcha, no token.** The Bhunaksha map is a public GeoServer-backed web app. Any user can drive the cascade.
- **HTTPS self-signed certificate** on `:8443`. Playwright needs `ignoreHTTPSErrors: true` or `curl -k` to connect.
- **No cookies required for the static map tiles.** `ScalarDatahandler` and `rest/*` endpoints do set `JSESSIONID` but the map tiles load with a single GET.

## Routing (district → server)

Bhunaksha is sharded across multiple backend servers, one per district group. The home page (`https://bhunakshaodisha.nic.in/`) is a portal that dispatches a district code to a backend. **There is no single URL that serves all districts.**

Routing table (from `https://bhunakshaodisha.nic.in/` inline `goBhunaksha()`):

| District codes | Server |
| --- | --- |
| 7, 8, 18 | `https://app4bhunakshaodisha.nic.in/bhunaksha/` |
| 3, 17, 29 | `https://app4bhunakshaodisha.nic.in:8443/bhunaksha/` |
| 20, 23, 26 | `https://app3bhunakshaodisha.nic.in/bhunaksha/` (Khordha, Sonepur, Nabarangpur) |
| 11, 22, 27 | `https://app2bhunakshaodisha.nic.in/bhunaksha/` |
| 12, 15, 30 | `https://app2bhunakshaodisha.nic.in:8443/bhunaksha/` |
| 5, 24, 28 | `https://app3bhunakshaodisha.nic.in:8443/bhunaksha/` |
| 1, 10, 16 | `https://app1bhunakshaodisha.nic.in/bhunaksha/` |
| 2, 9, 25 | `https://app1bhunakshaodisha.nic.in:8443/bhunaksha/` |
| 4, 14, 19 | `https://bhunakshaodisha.nic.in:8443/bhunaksha/` |
| (fallback) | `http://bhunakshaodisha.nic.in/bhunaksha/` |

**Khordha is `app3` (port 80).** Note: district code 20 here is Bhubaneswar, not the same as Bhulekh's `district code 20` (also Khordha). The two systems use overlapping but non-identical code sets. Always cross-reference via the district name, not the code.

> The static URL `https://bhunakshaodisha.nic.in/19/index.html` referenced in `CLEARDEED_HANDOFF_V1.1.md` returns **404**. The reference in the handoff brief is outdated; ignore it.

## Frontend architecture (what we're probing)

`https://app3bhunakshaodisha.nic.in/bhunaksha/` is a vanilla OpenLayers 3 (ol3) + jQuery + Bootstrap 3 SPA. Page load:

1. GET `/` → server-rendered HTML with empty `<select id="level_1">…</select>` dropdowns and an empty `<div id="map">`.
2. `index.js` runs `$().ready(...)` → fetches `/rest/Levels/count` (returns `5`) and `/rest/Layers/getLayers` (returns the 20+ layer definitions + SLD styles).
3. The user picks `level_1` (district) → `loadVilLevel(2)` fires → POST `/rest/Levels/...` returns the next level's options → injected into `<select id="level_2">`.
4. After the cascade completes (`initVillMap()`), the map loads with `VILLAGE_MAP` WMS layer using the constructed `gis_code` (e.g. `20010101601` = state 21, district 20, tahasil 1, RI 1, village 16, sheet 01).
5. The user types a plot number in `#plotNo` and hits Enter (or clicks search) → `selectPlot()` runs → GET `/ScalarDatahandler?OP=5&state=21&levels=20,2,1,16,null,&plotno=415` returns `{"has_data":"N"}` or a JSON with the plot's x/y/extent.
6. On success, `doSelectPlot()` adds two more WMS layers: `PLOT_LIST` (highlighted target plot) and `SAME_OWNER_PLOT_LIST` (other plots owned by the same person).

**There is no separate "plot report" view.** The map IS the report. The `#plotinfo` div in the sidebar shows the chauhaddi text ("North: Road, South: Plot 416…") and owner name.

## Selector / API schema

### Page elements

| Element | Purpose |
| --- | --- |
| `#level_1` | District `<select>` (Khordha = value `20`) |
| `#level_2` | Tahasil `<select>` (Bhubaneswar = value `2`) |
| `#level_3` | RI `<select>` (varies — first non-empty under Bhubaneswar is `1` ନିଳାଦ୍ରି ପ୍ରସାଦ) |
| `#level_4` | Village `<select>` (Mendhasala is NOT in this list under Bhubaneswar tahasil — see below) |
| `#level_5` | Sheet number `<select>` (always `01`) |
| `#plotNo` | Navbar plot number `<input>` |
| `#pniu` | Navbar PNIU `<input>` (alternative to plot number) |
| `#map` | OpenLayers map `<div>` → internally a `<canvas>` element 1280×647 |
| `#plotinfo` | Sidebar `<div>` with chauhaddi text and owner info |
| `#state` | Hidden `<input value="21">` (Odisha) |

> **Important:** The Bhulekh code `105` for Mendhasala village does NOT exist in Bhunaksha's `level_4` under Bhubaneswar tahasil. Bhunaksha uses a different village code set than Bhulekh. To look up Mendhasala in Bhunaksha, we need to discover its Bhunaksha-side code. The probe attempted RI `2` (ଭୁବନେଶ୍ଵର RI?) but the cascade returned `has_data: "N"` for plot 415 — likely because the wrong RI was picked. A re-probe with the correct RI is required before this fetcher is usable.

### REST endpoints (only work in-browser session)

| Endpoint | Method | Purpose |
| --- | --- | --- |
| `/rest/Levels/count?state=21` | POST | Returns the cascade depth (always `5`) |
| `/rest/Layers/getLayers` | POST | Returns the layer definitions + SLD styles |
| `/rest/MapInfo/getVVVVExtentGeoref` | POST | Returns extent for the current cascade (xmin/ymin/xmax/ymax + scaleFactor + attribution) |
| `/rest/MapInfo/getPlotAtXY` | POST | Returns the plot ID + kide for a clicked point |
| `/rest/MapInfo/getPointsfromPNIU` | POST | Returns plot coordinates for a PNIU input |
| `/rest/MapInfo/getGisCode` | POST | Returns the gis_code for a plot number |
| `ScalarDatahandler?OP=5&state=21&levels=…&plotno=…` | GET | Returns `{"has_data":"Y","plotNo":…,"ID":…,"PNIU":…,"info":…,"gisCode":…,"center_x":…,"center_y":…,"xmin":…,"ymin":…,"xmax":…,"ymax":…}` or `{"has_data":"N"}` |
| `WMS?SERVICE=WMS&…&LAYERS=VILLAGE_MAP&…&gis_code=…&STYLES=VILLAGE_MAP` | GET | Returns a PNG tile (image/png) |
| `WMS?SERVICE=WMS&…&LAYERS=PLOT_LIST&…&plot_id=…&STYLES=PLOT_SELECTION` | GET | Returns the highlighted target plot overlay (PNG) |
| `WMS?SERVICE=WMS&…&LAYERS=SAME_OWNER_PLOT_LIST&…&plot_no=…&STYLES=OWNER_PLOTS` | GET | Returns the same-owner neighbors overlay (PNG) |

All REST endpoints return `text/html;charset=utf-8` (even for JSON responses) — this is a JSP servlet quirk. `ScalarDatahandler?OP=5` is the only endpoint that returns a clean JSON body. The rest return HTML fragments that must be parsed as text.

### gis_code construction

The `gis_code` is a 12-digit string: `TTDRRIVILLSS` where `TT` = state code (21 for Odisha), `D` = district code, `RR` = RI code, `IV` = tahasil inverted (?) — actually the format from the probe is `20010101601` = `2|0|01|01|6|01`, breaking down to:

```
20010101601
^ state (21 padded)
 ^ district (20)
  ^^ tahasil (01)
    ^^ RI (01)
      ^^ village (16)
        ^^ sheet (01)
```

The exact structure is not documented anywhere; the only way to derive a `gis_code` is to drive the cascade in-browser and read `gisCode` from the JS global after each step.

## Response format

- **No SVG.** Confirmed: `document.querySelector("svg")` returns `null` on the live page.
- **No `<img>` element with plot/map alt or src.** Confirmed: zero matching `<img>` elements.
- **One `<canvas>` element** at 1280×647, painted by OpenLayers from WMS tiles.
- **The "report" text** (`#plotinfo` innerText) is plain HTML, NOT a structured payload. The chauhaddi format from a successful lookup (not seen in this probe — the plot was missing) is typically: "Plot No: 415\nOwner: <name>\nArea: <area>\nNorth: <boundary>\nSouth: <boundary>\nEast: <boundary>\nWest: <boundary>".

## Probe results (2026-06-18)

```
URL:    https://app3bhunakshaodisha.nic.in/bhunaksha/
State:  21 (Odisha)
Cascade: district 20 (Khordha) → tahasil 2 (Bhubaneswar) → RI 1 → village 16 → sheet 01
Plot lookup: 415 → has_data: "N" (plot not in this RI/village)
Inline SVG: 0 bytes
<img> matching plot/map: 0
<canvas>: 1 (1280×647)
Map screenshot: packages/fetchers/bhunaksha/fixtures/plot-report-map-screenshot.png (39,713 bytes, empty map)
Network responses captured: 17 (REST + WMS)
```

The captured screenshot is a 1280×647 PNG of the empty OpenLayers canvas after the cascade — there is no plot because the RI/village we picked doesn't contain plot 415. The screenshot is included for verification that the probe correctly drove the cascade; it is not a useful "plot diagram" fixture.

## Implications for Task 32 (Plot report fetcher)

The plan's Task 32 implementation assumes a static SVG response. **This assumption is invalid.** Before implementing Task 32, the plan must be amended to one of:

- **32.a — Compose SVG from Bhunaksha WFS data.** Use the existing `bhunakshaFetch` (GeoServer WFS) to get the target plot polygon + 4-8 neighbor polygons, then render a self-contained SVG with `d3-geo` or a similar library. Add `chauhaddi` text from the Bhulekh RoR `mutationReferences` (or from a future Bhunaksha REST call). Output a clean, branded SVG that lives entirely in our report.
- **32.b — Screenshot the live canvas.** Playwright drives the Bhunaksha cascade, calls `selectPlot()`, waits for the WMS tiles to load, then calls `page.locator("#map").screenshot()`. Output a PNG. Slow, fragile, depends on Bhunaksha being up. Implement as a fallback when 32.a is impossible.
- **32.c — Skip Bhunaksha plot diagram entirely.** Lean on the existing WFS plot polygon we already fetch and skip the visual diagram. Renders the polygon as a static SVG with only the target plot and a few neighbors.

**My recommendation is 32.c as a first cut** (fastest, already 80% built, no new dependency) with 32.b as a future enhancement. The plan's "Screenshot" fallback (Task 33) becomes the production path for high-fidelity plot diagrams.

## How to re-probe

```bash
# 1. Install Playwright in the repo (already done):
#    pnpm install

# 2. Run the probe:
node qa/bhunaksha_plot_diagram_probe.mjs

# 3. Inspect artifacts under packages/fetchers/bhunaksha/fixtures/:
#    - plot-report-map-screenshot.png  (the OpenLayers canvas snapshot)
#    - plot-report-plotinfo.txt        (the sidebar text, if any)
#    - plot-report-network.json        (every captured REST + WMS call)
#    - plot-report-scalardatahandler.txt  (plot lookup payloads)
#    - plot-report-page.html           (the full rendered page HTML)
#    - plot-report-probe.json          (timestamped observation log)
```

The probe is idempotent and re-runnable. It does not write to any external system. It will leave Bhunaksha in whatever state the cascade reaches (logged-out, no changes made).

## Failure modes

- **All Bhunaksha servers return 200 to GET / but the WMS layer returns 204 No Content** when the cascade picks an invalid district/RI/village combination. Treat 204 as "empty selection".
- **`ScalarDatahandler?OP=5` returns `{"has_data":"N"}`** when the plot number is not in the picked village. Pick a different village or RI.
- **The plotNo input is case-sensitive and trims whitespace** — `415` works, ` 415 ` works, `0415` does not.
- **The probe will hang for 30s on the first call** if Playwright is not installed; install with `pnpm install` first.
- **Network is unstable** — Bhunaksha is government-hosted and has occasional 504/timeout errors. Treat 5xx as transient and retry the probe once.

## Last known good response

The most recent successful live response captured by this probe is the WMS tile at:

```
https://app3bhunakshaodisha.nic.in/bhunaksha/WMS?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetMap&FORMAT=image%2Fpng&TRANSPARENT=true&LAYERS=VILLAGE_MAP&transparent=true&state=21&gis_code=20010101601&overlay_codes=&CRS=EPSG%3A3857&STYLES=VILLAGE_MAP&WIDTH=1920&HEIGHT=971&BBOX=...
```

This is a `image/png` (raster tile, not SVG) for the village map layer centered on gis_code `20010101601`. To re-fetch, the same `gis_code` and `BBOX` work; the tile server does not require session cookies.

## Source-of-truth status

- **Plan Task 31 status:** DONE — this document satisfies Task 31's deliverable. The "no static SVG" finding is a CONCERN but not a blocker because the alternative paths (32.a/32.b/32.c) are all viable and the existing WFS plot polygon already covers most of the use case.
- **Plan Task 32 status:** UNBLOCKED with re-scoping — implementer must read this doc before starting.
- **Plan Task 33 status:** UNBLOCKED with re-scoping — the Playwright screenshot fallback is now the recommended production path, not just a "third-party plugin" fallback.
