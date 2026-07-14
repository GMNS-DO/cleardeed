# BDA Zoning (Bhubaneswar Development Authority Master Plan)
## Khordha Industrial Zone Overlay — Sprint 4 (2026-05-12 to 2026-05-21)

> Purpose: confirm or refute "this plot is in a BDA industrial zone" for the
> ROR-INS-153 insight (Pattern 4 in CLAUDE.md — "Industrial-Zone Plot Sold as
> Residential"). Fires redFlag on industrial zone + residential khatiyan.
>
> Scope: **Khordha district only.** BDA jurisdiction is Bhubaneswar Municipal
> Corporation + immediate fringe (the "Bhubaneswar Planning Area" as defined
> in the BDA Master Plan 2010). Anything outside this area returns
> `out_of_scope` — this is not a failure, it is a legal-true negative.

## Source authority

- Master Plan 2010 (available on bda.gov.in / BDA planning authority office).
- No API. No authenticated endpoint. No public WMS/WFS.
- BDA publishes a PDF master-plan map showing residential / commercial /
  industrial / mixed-use zones. We do NOT have a machine-readable zoning
  feed. The fetcher therefore uses a **curated GeoJSON polygon overlay** that
  represents the industrial pockets identified from:
  - BDA Master Plan 2010 PDF (page ~N, "[mention specific page]") — the
    reference that a lawyer can verify manually.
  - OpenStreetMap `landuse=industrial` tags for Khordha as a cross-check
    (OSM is CC0 and citeable).
- Each polygon's `publicSource` property cites the specific BDA Master Plan
  page range it was drawn from. The underlying GeoJSON is at
  `packages/fetchers/bda-zoning/data/bda_industrial_polygons.geojson`.

## Package

`packages/fetcher-bda-zoning` — uses `@turf/turf` (Turf.js) for
`booleanPointInPolygon`.

Public surface:

- `fetch(input: { latitude: number; longitude: number; [tehsil]?: string; [village]?: string; }) → Promise<BdaZoneResult>`
- `getZoneByCode(zoneCode) → Zone | null`
- `permitsResidential / permitsCommercial / permitsIndustrial(zone) → boolean`
- `healthCheck() → boolean`
- `getZoneForVillage(village) → Zone | null` — centroid-based
- `getZoneForLocation(lat, lng) → Zone | null` — centroid-based fallback
- `findZoneByPolygon(lat, lng) → BdaZoneRow | null` — **preferred path for
  ROR-INS-153**; uses curated GeoJSON before the centroid fallback.
- `getDataSource() → "json" | "inline_seed"` — diagnostic

## Resolution order in `fetch()`

1. Polygon overlay hit (Turf.booleanPointInPolygon against curated
   `bda_industrial_polygons.geojson`). If hit → `status: "success"`,
   `statusReason: "polygon_overlay_match"`. The curated data is authoritative
   only for the 6 polygons; it is NOT a complete BDA zoning map. See
   `warnings` array — every hit is gated with a
   `polygon_overlay_limitation` note.
2. If no polygon hit, fall back to centroid-based lookup against the
   static BDA zone JSON (`bda_zones.json`) to detect non-industrial zones
   for Mendhasala / Biju Patnaik Nagar / other nearby villages. Falls back
   to inline seed data when the JSON file is missing.
3. If nothing matches → `status: "out_of_scope"`,
   `statusReason: "outside_bda_planning_area"`.

## Response schema

```ts
type ZoneId = "industrial" | "commercial" | "residential" | "mixed_use" | "green" | "institutional" | "transport" | "water_body" | "other";
type BdaZoneStatus = "success" | "no_match" | "out_of_scope";
type BdaZoneStatusReason = "seed_data_found"
  | "json_data_loaded"
  | "polygon_overlay_match"       // Sprint 4 — only set when polygon hit fires
  | "no_data_match"
  | "outside_bda_planning_area";

interface BdaZoneRow {
  village: string;
  tehsil: string;
  locality?: string;
  zone: Zone;
  centroid?: { latitude: number; longitude: number };
}

interface BdaZoneResult {
  source: "bda-zoning";
  status: BdaZoneStatus;
  statusReason: BdaZoneStatusReason;
  data: BdaZoneRow[];
  fetchedAt: string;
  mtimeMs?: number;
  warnings: BdaZoneWarning[];
}

type BdaZoneWarningCode =
  | "seed_data_limitation"      // bda_zones.json missing; inline seed used
  | "json_data_limitation"      // BDA zone JSON loaded but sparse / partial
  | "polygon_overlay_limitation"; // polygon hit — curated overlay, not a complete BDA map
```

## Polygon overlay

File: `packages/fetchers/bda-zoning/data/bda_industrial_polygons.geojson`

**Schema per feature** (must be stable — downstream `findZoneByPolygon` relies on these exact keys):

- `properties.name` — human-readable locality name
- `properties.tehsil` — tehsil (must match Bhulekh tahasil casing for
  cross-referencing)
- `properties.village` — revenue village name (Khordha-standard spelling)
- `properties.zone` — **must be one of `ZoneId` enum values**; only
  `"industrial"` and `"industrial_2"` trigger ROR-INS-153. `industrial_2`
  is currently mapped to `"industrial"` in `resolveZone()` so downstream
  only sees `"industrial"`.
- `properties.zoneCode` — legacy code (I, R, etc.)
- `properties.areaSqKm`, `properties.approxAcres` — provenance
- `properties.publicSource` — BDA Master Plan PDF reference

When adding a new polygon: (1) hand-curate the GPS polygon from the BDA
Master Plan PDF; (2) add the feature; (3) add a unit test in
`packages/fetchers/bda-zoning/src/index.test.ts`; (4) add a
`findZoneByPolygon` edge-case test with an out-of-bounds point. Raw OSM
`landuse=industrial` polygons can be converted to GeoJSON but must be
verified against the BDA PDF before being added — OSM alone is not a
sufficient source for a legal-grade report.

## Edge cases

- **Plot GPS outside every curated polygon** — `findZoneByPolygon` returns
  `null`. `fetch()` then falls back to the centroid JSON. If the centroid
  JSON also has no hit → `status: "out_of_scope"`. ROR-INS-153 produces
  a `watchout` ("outside BDA Master Plan jurisdiction"), not a `redFlag`.
  The V1.1 demo (Mendhasala, `20.272688, 85.701271`) hits this branch.
- **Plot GPS inside a curated polygon** — `findZoneByPolygon` returns the
  row. `fetch()` short-circuits and returns `status: "success"`,
  `statusReason: "polygon_overlay_match"` with `warnings: [{code:
  "polygon_overlay_limitation"}]`. ROR-INS-153 fires `redFlag` only when
  zone.id is in the INDUSTRIAL_ZONE_IDS set and the RoR is `verified`.
- **BDA_ZONES_JSON missing** — `fetch()` uses inline seed data
  (`INLINE_SEED_ZONES`). `healthCheck()` returns true if either polygon
  overlay OR seed data loads. Status reason becomes `seed_data_found` and a
  `seed_data_limitation` warning is added.
- **Polygon overlay missing or corrupt** — `loadPolygonOverlay` returns
  null; behavior identical to "no hit" — falls back to centroid JSON.
  Report this as a `seed_data_limitation` if both are unavailable.
- **Turf.booleanPointInPolygon throws** — caught inside `findZoneByPolygon`,
  returned as `null`, falls back to centroid. The polygon overlay is not
  considered a failure source.

## ROR-INS-153 contract (Pattern 4 in CLAUDE.md)

The rule consumes `bdaZoneData` from the orchestrator output:

- `bdaZoneData === null` → watchout ("outside BDA Master Plan jurisdiction")
- `bdaZoneData.status !== "success"` → watchout ("not classified / lookup failed")
- `bdaZoneData.data.length === 0` → watchout ("BDA zone not classified for this village")
- `bdaZoneData.data.some(row => INDUSTRIAL_ZONE_IDS.has(row.zone.id))` →
  redFlag "Industrial zone — residential sale risk" — action item points to
  Bhulekh RoR `kisam` check for residential land class.
- Zone is classified but not industrial → no ROR-INS-153 insight (null).

Rule does NOT gate on `bdaZoneData` being `out_of_scope` — a watchout is
the correct consumer-facing signal. The demo must never spuriously fire
`redFlag` on the V1.1 Mendhasala coordinate.

## Dependency

`@turf/turf` — pinned in `packages/fetcher-bda-zoning/package.json`.
`booleanPointInPolygon` is the single Turf function used.

## Caveats for production use

- The BDA Master Plan map is a plan, not a legally binding zoning
  regulation for all purposes. Khordha has multiple overlapping planning
  authorities (BDA, Bhubaneswar Municipal Corporation, OSPAR for industrial
  layout). A lawyer must verify the actual BDA approved layout plan for the
  specific plot — the polygon overlay is an early-warning signal, not a
  definitive zoning ruling.
- Sub-plot detection (415/1, D/88) is a separate insight (ROR-INS-180 per
  CLAUDE.md Section "On fraud pattern detection") and does NOT depend on
  the BDA polygon overlay.

## Last known working

- Date: 2026-05-12 (Sprint 4 session)
- Status: GREEN — 6 curated polygons confirmed via Turf.js containment;
  demo coords confirmed outside all polygons; consumer-report-writer tests
  (633 passing) + bda-zoning fetcher tests (25 passing) + e2e tests (6
  passing) all green.
