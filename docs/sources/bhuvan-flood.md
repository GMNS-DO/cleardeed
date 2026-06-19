# Source: Bhuvan flood hazard WMS

Last verified working: 2026-06-19
Owner module: `packages/fetchers/bhuvan-flood/`
Probe artifacts: `/tmp/bhuvan-*.{xml,json,png}` (probe session)
License posture: **planning-only** — formal NRSC licensing is required before
Bhuvan data appears in any paid ClearDeed report.

## What it returns

Historical flood extent footprints (annual layers `br_fld_1998`..`br_fld_2010`
and named cyclonic-event layers `or_<DDMMYY>_flood`, plus the Odisha-wide
composite `or_cyclone`) overlaid on the Bhuvan map. The WMS endpoint exposes
raster overlays only — there is **no per-pixel classification API**.

## Endpoint

```
GET https://bhuvan-ras2.nrsc.gov.in/cgi-bin/flood.exe?...
```

Two service paths exist on the same executable:

| Path | Status | Result |
|------|--------|--------|
| `service=WMS&request=GetFeatureInfo&layers=<name>` | **DISABLED** server-side | `LayerNotQueryable` for every probed layer (`Flood`, `br_fld_2010`, `or_cyclone`, `or_121013_flood`, `or_river`) |
| `service=WFS&request=GetFeature&typeName=<name>` | **DISABLED** server-side | `WFS server error. WFS request not enabled. Check wfs/ows_enable_request settings.` |
| `service=WMS&request=GetMap&layers=<name>` | OK | Raster tile (PNG, ~9 KB for 512×512 of all Odisha; ~0.5 KB for 256×256 around Mendhasala) |

Both `wms/ows_enable_request` and `wfs/ows_enable_request` MapServer settings
are off at the host — confirmed by reproducing the error messages verbatim
across every probed layer and protocol.

## Layer catalogue (`GetCapabilities`)

The parent `Flood` layer is a folder grouping 50+ named children, of which
the Odisha-relevant subset is:

- `or_cyclone` — composite cyclone footprint for Odisha (planning use).
- `or_<DDMMYY>_flood` — per-event cyclone flood footprint, e.g. `or_121013_flood`
  (Phailin, 12 Oct 2013), `or_261013_flood`, `or_291013_flood`.
- `or_river` — river network overlay (Odisha).
- `br_fld_<YYYY>` and `as_fld_<YYYY>` — annual flood layers for **Brahmaputra**
  (`br_`) and **Assam** (`as_`), not for Odisha.
- Event-specific layers for Andhra (`ap_`), Gujarat (`gj_`), Maharashtra
  (`mh_`), Punjab, Tamil Nadu (`tn_`), West Bengal (`wb_`).

A Khordha GPS query should probe `or_cyclone` for the broadest coverage;
event-specific Odisha layers can be probed if a cyclone event needs to be
named in the report.

## Authentication

None. The WMS endpoint is open-access. Bhuvan's published license permits
**planning purposes** only — formal NRSC licensing is required before any
Bhuvan-derived output appears in a paid ClearDeed report.

## Rate limits

Not formally published. Probing cadence: ≤ 2 req/s from a single IP keeps
the GetMap tile returns stable; sustained bursts return identical 200/PNG
responses (no 429 observed during this probe session).

## Schema

The fetcher exposes a typed `SourceResult` via `bhuvanFetch({ lat, lon })`:

| Field | Type | Meaning |
|-------|------|---------|
| `source` | `"bhuvan-flood"` | Discriminator |
| `status` | `"success"` / `"partial"` / `"failed"` | `partial` = tile reachable, GetFeatureInfo blocked (current reality for all Khordha GPS). |
| `verification` | `"verified"` / `"manual_required"` / `"not_covered"` | `"not_covered"` until NRSC licensing is in place. |
| `floodFrequency` | `"none"` / `"low"` / `"medium"` / `"high"` / `"very_high"` / `"unknown"` | Best-effort classification. **For V1 always `"unknown"`** — server has no point-query API. |
| `layersProbed` | `string[]` | Bhuvan layer names queried (`or_cyclone`, `or_121013_flood`, …). |
| `getFeatureInfoBlocked` | `boolean` | Server-side flag — currently `true` for every probe. |
| `tileBytes` | `number \| null` | Bytes returned from the GetMap tile probe (if any). |
| `dataSource` | `"bhuvan-ras2.nrsc.gov.in"` | Provenance. |
| `fetchedAt` | ISO datetime | Wall-clock at fetcher invocation. |

## Known edge cases

- **Every probed layer is `LayerNotQueryable` on GetFeatureInfo.** This is a
  MapServer-side `ows_enable_request` flag, not a bug in the request. No
  layer parameter combination, info_format, or WMS version fixes it.
- WFS requests are also disabled server-side.
- GetMap tiles return raster overlays only — no per-pixel classification API
  exists.
- The parent `Flood` layer is a folder, not a queryable layer.

## Failure modes

- `LayerNotQueryable` from GetFeatureInfo → expected; do not retry.
- HTTP 5xx / network failure → retry with backoff (3 attempts, 1s base).
- Tile size > 0 with no feature data → `status: "partial"`, `verification: "manual_required"`.

## Manual verification fallback

Until NRSC licensing is in place:

1. Open `https://bhuvan-ras2.nrsc.gov.in/index.php?lang=en&mode=Open%20Flood%20Services`
   in a browser.
2. Select the Odisha flood overlay (cyclone or specific event).
3. Click the GPS coordinate on the Bhuvan map to inspect the raster overlay
   for the target plot.
4. Cross-reference with the OSM/Bhunaksha polygon and the local SRO/Tehsil.

## Last known good response

- GetMap tile (PNG 512×512 of Odisha 84.5-86.5°E, 19.5-21.5°N, layer `or_cyclone`)
  → 9,196 bytes, 2-bit colormap. Saved to `/tmp/bhuvan-map-wide.png` during
  the 2026-06-19 probe.
- GetFeatureInfo probes → all returned the canonical
  `ServiceException code="LayerNotQueryable"` from
  `bhuvan-ras2.nrsc.gov.in/cgi-bin/flood.exe`.