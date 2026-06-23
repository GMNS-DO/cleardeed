/**
 * ClearDeed — Plot polygon synthesizer (MapCard v1 fallback).
 *
 * When Bhunaksha WFS returns no polygon for the plot GPS (≈30-40% of
 * Khordha reports), the pipeline still wants to render an interactive
 * MapCard v1. This module synthesises a minimal GeoJSON payload so
 * the existing diagram step + bootstrap can render a useful map:
 *
 *   - a 60m × 60m square polygon centered on the village GPS, just
 *     large enough for the gold "target" outline to be visible
 *   - the full Khordha district boundary so the bootstrap can render
 *     it as a MapLibre layer
 *   - a bounds box that snaps the camera to district-level zoom
 *     (not street-level)
 *   - the village centroid (so the gold marker is at the right place)
 *
 * The output is consumed by `runPlotDiagramStep` via the new
 * `fallback` field on `PlotDiagramStepInput`. The diagram step
 * inspects it to render a different SVG (the district outline) and
 * to surface the geo data so MapCard v1 boots in approximate mode.
 *
 * Why pure / static-only:
 *   - Called twice per report (once for fresh render, once per cache
 *     hit re-resolve). ~5ms budget each.
 *   - The Khordha boundary is a static asset, statically imported so
 *     no I/O.
 *   - The function must be deterministic — same input → same output
 *     — so test assertions are byte-stable.
 */

import {
  KHORDHA_BOUNDARY_FEATURE,
  KHORDHA_BOUNDS,
} from "@cleardeed/schema";

export interface SynthesizeInput {
  /** Village centroid resolved by Nominatim (always set when this is called). */
  gps: { lat: number; lon: number };
  /** Bhulekh plot number — used as a label, not in the geometry. */
  plotNo: string;
  /** Village name — used as a label, not in the geometry. */
  village: string;
  /**
   * The reason Bhunaksha returned no polygon. Surfaces in the report
   * caption and the diagram step's `reason` field so support can
   * diagnose why a fallback was triggered.
   */
  reason: string;
}

export interface SynthesizeResult {
  /** A 60m × 60m square polygon at the GPS. GeoJSON Polygon. */
  polygon: { type: "Polygon"; coordinates: number[][][] };
  /**
   * Same polygon as a `number[][]` (single ring) — what the diagram
   * step's `targetPolygon` field on `PlotDiagramStepResult` expects.
   * Pre-computed so the step doesn't have to unpack it.
   */
  targetPolygon: { type: "Polygon"; coordinates: number[][] };
  /** Village centroid (== input.gps, but normalised). */
  centroid: { lat: number; lon: number };
  /** Khordha district bounding box. Snaps the camera to district-level. */
  bounds: { minLat: number; maxLat: number; minLon: number; maxLon: number };
  /** Khordha district boundary asset (for the bootstrap's layer). */
  khordhaBoundary: typeof KHORDHA_BOUNDARY_FEATURE;
  /** Always "approximate" for the fallback path. The mapper reads this. */
  mode: "approximate";
  /** The reason Bhunaksha returned no polygon. Surfaces in the caption. */
  reason: string;
  /** Identifier passed through for label rendering. */
  plotNo: string;
  village: string;
}

/**
 * Side length of the synthesized "target" polygon in degrees. At
 * Khordha's latitude (≈20°N), 0.00054° ≈ 60m east-west and ≈60m
 * north-south. This is not the plot — it's just enough that the
 * gold target outline is visible at district zoom and the buyer
 * understands a marker exists for the village.
 */
const TARGET_SQUARE_DEG = 0.00054;

/**
 * Synthesise a fallback plot-diagram payload for the MapCard v1
 * approximate mode. Pure function — no I/O, no time, no mutation of
 * the input.
 *
 * @example
 *   const fb = synthesizePlotPolygon({
 *     gps: { lat: 20.27, lon: 85.84 },
 *     plotNo: "309",
 *     village: "Mendhasala",
 *     reason: "no_containing_polygon",
 *   });
 *   // fb.polygon.coordinates[0] is a closed 5-vertex ring.
 */
export function synthesizePlotPolygon(input: SynthesizeInput): SynthesizeResult {
  const { lat, lon } = input.gps;
  const half = TARGET_SQUARE_DEG / 2;

  // Closed square ring (5 points: 4 corners + closing point).
  // MapLibre/GeoJSON convention: [lon, lat].
  const ring: number[][] = [
    [lon - half, lat - half],
    [lon + half, lat - half],
    [lon + half, lat + half],
    [lon - half, lat + half],
    [lon - half, lat - half],
  ];

  return {
    polygon: { type: "Polygon", coordinates: [ring] },
    targetPolygon: { type: "Polygon", coordinates: ring },
    centroid: { lat, lon },
    bounds: {
      minLat: KHORDHA_BOUNDS.minLat,
      maxLat: KHORDHA_BOUNDS.maxLat,
      minLon: KHORDHA_BOUNDS.minLon,
      maxLon: KHORDHA_BOUNDS.maxLon,
    },
    khordhaBoundary: KHORDHA_BOUNDARY_FEATURE,
    mode: "approximate",
    reason: input.reason,
    plotNo: input.plotNo,
    village: input.village,
  };
}

/**
 * The raw Khordha boundary asset. Re-exported from @cleardeed/schema
 * (which loads the JSON statically) so downstream code has a single
 * import path. The schema package's KHORDHA_BOUNDARY_FEATURE is the
 * canonical source; this alias keeps the synthesize module self-contained.
 */
export const KHORDHA_BOUNDARY_ASSET = KHORDHA_BOUNDARY_FEATURE;
