/**
 * Plot Diagram WFS Compose Fetcher
 *
 * Composes a normalized plot diagram from GeoServer WFS queries:
 *   - Target plot polygon (passed in by caller from existing WFS lookup)
 *   - 4-8 adjacent plot polygons that share an edge with the target
 *   - Road network in the target's bounding box (if road layer is available)
 *   - Bounds and provenance metadata
 *
 * Phase 8 of unified insight engine. Companion to `bhunakshaFetch` in index.ts
 * which produces the target polygon; this module reuses the same WFS endpoint
 * and bbox query infrastructure to assemble a diagram-ready payload.
 *
 * Reuses:
 *   - WFSResponseSchema / WFSFeatureSchema from index.ts (not re-exported to
 *     avoid coupling; defined locally with the same shape so this module can
 *     be tested in isolation)
 *   - runWithRetry from @cleardeed/schema for transient error handling
 *
 * Rejected approaches (per task brief):
 *   - No Playwright — pure HTTP WFS queries.
 *   - No static SVG lookup — canvas is rendered client-side from this payload.
 */

import { z } from "zod";
import { runWithRetry } from "@cleardeed/schema";
import { createHash } from "node:crypto";

const GEOSERVER_BASE = "https://mapserver.odisha4kgeo.in/geoserver/revenue/wfs";
const USER_AGENT = "ClearDeed/1.0 (property due-diligence; contact@cleardeed.in)";
export const PLOT_DIAGRAM_PARSER_VERSION = "bhunaksha-plot-diagram/2026-06-18";

// 30s ceiling for the full compose per the task brief.
// 4 parallel WFS calls share this budget via Promise.race + individual timeouts.
const COMPOSE_TIMEOUT_MS = 30_000;
const WFS_TIMEOUT_MS = 12_000;
const NEIGHBOR_BUFFER_DEG = 0.003; // ~330m at this latitude — captures edge-adjacent plots.
const MAX_NEIGHBORS = 8;
const MAX_FEATURES = 500;

// Re-define schemas locally so this module is testable without pulling index.ts.
// Shape must match WFSResponseSchema in index.ts.
const Coordinate = z.tuple([z.number(), z.number()]).rest(z.number());

const WFSFeatureSchema = z.object({
  type: z.literal("Feature"),
  id: z.string().optional(),
  geometry: z.object({
    type: z.literal("Polygon"),
    coordinates: z.array(z.array(Coordinate).min(4)).min(1),
  }),
  properties: z.record(z.unknown()).default({}),
});

const WFSResponseSchema = z.object({
  type: z.literal("FeatureCollection"),
  features: z.array(WFSFeatureSchema),
  totalFeatures: z.union([z.number(), z.string()]).optional(),
  numberReturned: z.union([z.number(), z.string()]).optional(),
  crs: z.unknown().optional(),
});

type WFSFeature = z.infer<typeof WFSFeatureSchema>;
type WFSResponse = z.infer<typeof WFSResponseSchema>;

// ────────────────────────────────────────────────────────────────────────────
// Public input/output contract
// ────────────────────────────────────────────────────────────────────────────

export interface PlotDiagramInput {
  /** Target plot polygon from existing WFS lookup. */
  targetPolygon: { type: "Polygon"; coordinates: number[][][] };
  /** Target plot number (Bhulekh plot number) for provenance labelling. */
  targetPlotNo: string;
  /** Target plot village name (for provenance). */
  targetVillage: string;
  /** GPS centroid of the target plot — used as the WFS query seed. */
  centroid: { lat: number; lon: number };
  /** WFS layer name. Defaults to "khurda_bhubaneswar". */
  layer?: string;
  /**
   * Optional WFS road layer name. If omitted, the module will attempt the
   * common naming convention "revenue:roads" but will not throw if absent.
   */
  roadLayer?: string;
}

export interface PlotDiagramBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface PlotDiagramTarget {
  plotNo: string;
  village: string;
  polygon: { type: "Polygon"; coordinates: number[][] };
  areaSqKm: number;
}

export interface PlotDiagramNeighbor {
  plotNo: string;
  village: string;
  tehsil: string;
  polygon: { type: "Polygon"; coordinates: number[][] };
  areaSqKm: number;
  /** Kisam if present in WFS properties (best-effort; WFS plot layer usually lacks this). */
  kisam?: string;
}

export interface PlotDiagramRoad {
  /** Road name if WFS road properties include it. */
  name?: string;
  /** LineString or MultiLineString coordinates (raw from WFS). */
  path: number[][] | number[][][];
  /** Road class/type if WFS road properties include it. */
  roadClass?: string;
}

export interface PlotDiagramProvenance {
  source: "bhunaksha:wfs:plot-diagram";
  fetchedAt: string;
  parserVersion: string;
  layer: string;
  roadLayerAttempted?: string;
  roadLayerAvailable: boolean;
  /** SHA-256 of the raw neighbor WFS response (for replay/debug). */
  neighborsRawHash?: string;
  /** SHA-256 of the raw road WFS response if available. */
  roadsRawHash?: string;
  /** Counts of features returned at each step. */
  counts: {
    neighborCandidates: number;
    neighborSelected: number;
    roadFeatures: number;
  };
}

export interface PlotDiagramResult {
  source: "bhunaksha:wfs:plot-diagram";
  status: "success" | "partial" | "failed";
  fetchedAt: string;
  target: PlotDiagramTarget | null;
  neighbors: PlotDiagramNeighbor[];
  roads: PlotDiagramRoad[];
  bounds: PlotDiagramBounds | null;
  provenance: PlotDiagramProvenance;
  /** Non-fatal warnings (e.g. road layer missing, no edge-sharing neighbors found). */
  warnings: string[];
  /** Final error message on hard failure. */
  error?: string;
}

// ────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function shoelaceAreaSqDeg(polygon: number[][]): number {
  let area = 0;
  const n = polygon.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    area += polygon[i][0] * polygon[j][1];
    area -= polygon[j][0] * polygon[i][1];
  }
  return Math.abs(area / 2);
}

function shoelaceAreaSqKm(polygon: number[][]): number {
  // Convert degree² → km² using local degree scale at the centroid latitude.
  // 1° lat ≈ 111 km; 1° lon ≈ 111 * cos(lat) km.
  let sumLat = 0;
  const n = polygon.length;
  for (const p of polygon) sumLat += p[1];
  const meanLat = sumLat / n;
  const kmPerDegLat = 111;
  const kmPerDegLon = 111 * Math.cos((meanLat * Math.PI) / 180);
  const sqDeg = shoelaceAreaSqDeg(polygon);
  return sqDeg * kmPerDegLat * kmPerDegLon;
}

function computeBounds(polygons: Array<{ type: "Polygon"; coordinates: number[][][] }>): PlotDiagramBounds | null {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  let any = false;
  for (const poly of polygons) {
    const ring = poly.coordinates[0];
    if (!ring) continue;
    for (const pt of ring) {
      if (pt[0] < minX) minX = pt[0];
      if (pt[0] > maxX) maxX = pt[0];
      if (pt[1] < minY) minY = pt[1];
      if (pt[1] > maxY) maxY = pt[1];
      any = true;
    }
  }
  if (!any) return null;
  return { minX, minY, maxX, maxY };
}

function buildBboxFromCenter(lat: number, lon: number, bufferDeg: number): string {
  return `${(lon - bufferDeg).toFixed(4)},${(lat - bufferDeg).toFixed(4)},${(lon + bufferDeg).toFixed(4)},${(lat + bufferDeg).toFixed(4)}`;
}

/**
 * Test if two polygon rings share at least one edge segment of positive length.
 *
 * "Sharing an edge" requires the shared vertices to be CONSECUTIVE on at least
 * one of the two rings — that distinguishes a shared edge (length > 0) from a
 * corner-touch (length 0).
 *
 * Algorithm:
 *  - Build a vertex-key set for ringA and another for ringB.
 *  - Scan ringB: two consecutive B-vertices both in ringA's set → shared edge.
 *  - Scan ringA: two consecutive A-vertices both in ringB's set → shared edge.
 *  - Sub-meter epsilon rounding (1e-6 ≈ 0.1 m) handles WFS float-precision
 *    noise that shifts vertices by sub-meter amounts.
 */
function polygonsShareEdge(ringA: number[][], ringB: number[][]): boolean {
  if (ringA.length < 3 || ringB.length < 3) return false;
  const epsilon = 1e-6;
  const key = (x: number, y: number): string =>
    `${Math.round(x / epsilon)},${Math.round(y / epsilon)}`;

  const aSet = new Set<string>();
  for (const p of ringA) aSet.add(key(p[0], p[1]));
  const bSet = new Set<string>();
  for (const p of ringB) bSet.add(key(p[0], p[1]));

  // Scan ring B: two consecutive B-vertices both in ringA → shared edge.
  for (let i = 0; i < ringB.length - 1; i++) {
    const p1 = ringB[i];
    const p2 = ringB[i + 1];
    if (!p1 || !p2) continue;
    if (aSet.has(key(p1[0], p1[1])) && aSet.has(key(p2[0], p2[1]))) return true;
  }
  // Scan ring A: two consecutive A-vertices both in ringB → shared edge.
  for (let i = 0; i < ringA.length - 1; i++) {
    const p1 = ringA[i];
    const p2 = ringA[i + 1];
    if (!p1 || !p2) continue;
    if (bSet.has(key(p1[0], p1[1])) && bSet.has(key(p2[0], p2[1]))) return true;
  }
  return false;
}

// ────────────────────────────────────────────────────────────────────────────
// WFS query helpers (reuse the same dispatcher as index.ts)
// ────────────────────────────────────────────────────────────────────────────

interface RawWFSResult {
  ok: boolean;
  features: WFSFeature[];
  rawHash: string;
  url: string;
  error?: string;
}

async function queryWFSPlotLayer(
  lat: number,
  lon: number,
  layer: string,
  bufferDeg: number
): Promise<RawWFSResult> {
  const bbox = buildBboxFromCenter(lat, lon, bufferDeg);
  const url = `${GEOSERVER_BASE}?SERVICE=WFS&VERSION=1.0.0&REQUEST=GetFeature&TYPENAME=revenue:${layer}&BBOX=${bbox},EPSG:4326&MAXFEATURES=${MAX_FEATURES}&OUTPUTFORMAT=application/json`;

  return runWithRetry(
    async (): Promise<RawWFSResult> => {
      try {
        const res = await globalThis.fetch(url, {
          headers: { "User-Agent": USER_AGENT },
          signal: AbortSignal.timeout(WFS_TIMEOUT_MS),
        });
        if (!res.ok) {
          return { ok: false, features: [], rawHash: "", url, error: `WFS ${res.status}` };
        }
        const raw = typeof res.text === "function" ? await res.text() : JSON.stringify(await res.json());
        const parsed = JSON.parse(raw) as unknown;
        const validation = WFSResponseSchema.safeParse(parsed);
        if (!validation.success) {
          return {
            ok: false,
            features: [],
            rawHash: sha256(raw),
            url,
            error: `schema_validation_failed: ${validation.error.issues[0]?.message ?? "unknown"}`,
          };
        }
        return { ok: true, features: validation.data.features, rawHash: sha256(raw), url };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return { ok: false, features: [], rawHash: "", url, error: message };
      }
    },
    { maxAttempts: 2, baseDelayMs: 500 }
  ).then((r) => r.value);
}

async function queryWFSRoadLayer(
  lat: number,
  lon: number,
  roadLayer: string,
  bufferDeg: number
): Promise<RawWFSResult> {
  const bbox = buildBboxFromCenter(lat, lon, bufferDeg);
  const url = `${GEOSERVER_BASE}?SERVICE=WFS&VERSION=1.0.0&REQUEST=GetFeature&TYPENAME=revenue:${roadLayer}&BBOX=${bbox},EPSG:4326&MAXFEATURES=${MAX_FEATURES}&OUTPUTFORMAT=application/json`;

  try {
    const res = await globalThis.fetch(url, {
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(WFS_TIMEOUT_MS),
    });
    if (!res.ok) {
      return { ok: false, features: [], rawHash: "", url, error: `WFS ${res.status}` };
    }
    const raw = typeof res.text === "function" ? await res.text() : JSON.stringify(await res.json());
    const parsed = JSON.parse(raw) as unknown;

    // Road layers may be LineString or MultiLineString, not just Polygon.
    // Accept any geometry type as long as coordinates are present.
    const RoadResponseSchema = z.object({
      type: z.literal("FeatureCollection"),
      features: z.array(
        z.object({
          type: z.literal("Feature"),
          id: z.string().optional(),
          geometry: z.object({
            type: z.string(),
            coordinates: z.unknown(),
          }),
          properties: z.record(z.unknown()).default({}),
        })
      ),
    });
    const validation = RoadResponseSchema.safeParse(parsed);
    if (!validation.success) {
      return { ok: false, features: [], rawHash: sha256(raw), url, error: "road_schema_validation_failed" };
    }
    // Re-shape to the plot Feature type. Coerce coordinates to a permissive shape.
    // Use `any` here only for road path extraction — the consumer renders a path.
    const features = validation.data.features as unknown as WFSFeature[];
    return { ok: true, features, rawHash: sha256(raw), url };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, features: [], rawHash: "", url, error: message };
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Public API
// ────────────────────────────────────────────────────────────────────────────

/**
 * Compose a plot diagram by querying the existing GeoServer WFS endpoint
 * for the target's neighbors and (optionally) nearby roads.
 *
 * Guarantees:
 *   - Never throws. Always returns a PlotDiagramResult.
 *   - If WFS returns 0 neighbors → `neighbors` is an empty array, status is
 *     "partial" with a warning, not a failure.
 *   - If road layer is absent → `roads` is an empty array, warning is set.
 *   - Honors the 30s overall compose budget; long-running fetches are
 *     cancelled via the per-WFS-call 12s timeouts.
 */
export async function fetchPlotDiagram(input: PlotDiagramInput): Promise<PlotDiagramResult> {
  const fetchedAt = new Date().toISOString();
  const {
    targetPolygon,
    targetPlotNo,
    targetVillage,
    centroid,
    layer = "khurda_bhubaneswar",
    roadLayer = "roads",
  } = input;

  const warnings: string[] = [];
  const targetRing = targetPolygon.coordinates[0] ?? [];

  const composeController = new AbortController();
  const composeTimeout = setTimeout(() => composeController.abort(), COMPOSE_TIMEOUT_MS);

  try {
    // 3 parallel WFS calls: target refresh, neighbors, roads.
    // (Target polygon is already in the input, so we just need neighbors + roads.)
    const [neighborsResult, roadsResult] = await Promise.all([
      queryWFSPlotLayer(centroid.lat, centroid.lon, layer, NEIGHBOR_BUFFER_DEG),
      queryWFSRoadLayer(centroid.lat, centroid.lon, roadLayer, NEIGHBOR_BUFFER_DEG).catch(
        (): RawWFSResult => ({ ok: false, features: [], rawHash: "", url: "", error: "road_layer_exception" })
      ),
    ]);

    clearTimeout(composeTimeout);

    // ── Filter neighbors ────────────────────────────────────────────────────
    // Drop the target itself (its centroid hash will match the input polygon),
    // and require at least one shared edge to count as truly "adjacent".
    let neighborCandidates = 0;
    const neighbors: PlotDiagramNeighbor[] = [];
    for (const feature of neighborsResult.features) {
      const props = feature.properties;
      const candidateNo = String(props.revenue_plot ?? "").trim();
      // Skip if same plot number (best signal that it's the target polygon).
      if (candidateNo && targetPlotNo && candidateNo === targetPlotNo.trim()) continue;
      const ring = feature.geometry.coordinates[0];
      if (!ring) continue;
      neighborCandidates++;
      if (!polygonsShareEdge(targetRing, ring)) continue;
      if (neighbors.length >= MAX_NEIGHBORS) break;
      const tehsil = String(props.tehsil_name ?? "");
      const village = String(props.revenue_village_name ?? "");
      neighbors.push({
        plotNo: candidateNo,
        village,
        tehsil,
        polygon: { type: "Polygon", coordinates: ring },
        areaSqKm: shoelaceAreaSqKm(ring),
        // WFS plot polygons in Odisha don't carry kisam. Leave undefined;
        // the report writer will pair this with Bhulekh's back page if available.
        kisam: typeof props.kisam === "string" ? props.kisam : undefined,
      });
    }

    if (neighbors.length === 0) {
      warnings.push("no_edge_sharing_neighbors_found");
    } else if (neighbors.length < 4) {
      warnings.push(`only_${neighbors.length}_neighbors_found`);
    }

    // ── Build roads ─────────────────────────────────────────────────────────
    const roads: PlotDiagramRoad[] = [];
    let roadLayerAvailable = false;
    if (!roadsResult.ok) {
      warnings.push(`road_layer_unavailable: ${roadsResult.error ?? "unknown"}`);
    } else {
      roadLayerAvailable = true;
      for (const feature of roadsResult.features) {
        const props = feature.properties;
        const geomType = (feature.geometry as { type?: string }).type;
        if (geomType === "LineString") {
          roads.push({
            name: typeof props.name === "string" ? props.name : undefined,
            roadClass: typeof props.road_class === "string" ? props.road_class : undefined,
            path: (feature.geometry as unknown as { coordinates: number[][] }).coordinates,
          });
        } else if (geomType === "MultiLineString") {
          for (const line of (feature.geometry as unknown as { coordinates: number[][][] }).coordinates) {
            roads.push({
              name: typeof props.name === "string" ? props.name : undefined,
              roadClass: typeof props.road_class === "string" ? props.road_class : undefined,
              path: line,
            });
          }
        }
        // Other geometry types (Point, Polygon) are ignored for road rendering.
      }
      if (roads.length === 0) {
        warnings.push("road_layer_present_but_no_features_in_bbox");
      }
    }

    // ── Bounds ──────────────────────────────────────────────────────────────
    const bounds = computeBounds([
      { type: "Polygon", coordinates: targetPolygon.coordinates },
      ...neighbors.map((n) => ({
        type: "Polygon" as const,
        coordinates: [n.polygon.coordinates],
      })),
    ]);

    // ── Build target ────────────────────────────────────────────────────────
    // Target is only returned when the neighbor query succeeded — without
    // WFS confirmation we don't trust the input polygon enough to publish it.
    const target: PlotDiagramTarget | null = neighborsResult.ok
      ? {
          plotNo: targetPlotNo,
          village: targetVillage,
          polygon: { type: "Polygon", coordinates: targetRing },
          areaSqKm: shoelaceAreaSqKm(targetRing),
        }
      : null;

    // ── Status ──────────────────────────────────────────────────────────────
    // "failed" only when BOTH queries failed (no usable external data).
    // "partial" when neighbors were found but the road layer was missing,
    // or when the neighbor query returned 0 edge-sharing plots.
    // "success" when both queries returned usable data.
    let status: PlotDiagramResult["status"] = "success";
    let error: string | undefined;
    if (!neighborsResult.ok) {
      warnings.push(`neighbor_query_failed: ${neighborsResult.error ?? "unknown"}`);
      if (!roadLayerAvailable) {
        status = "failed";
        error = `both_queries_failed: neighbor=${neighborsResult.error ?? "unknown"}; road=${roadsResult.error ?? "unknown"}`;
      } else {
        status = "partial";
      }
    } else if (neighbors.length === 0) {
      status = "partial";
    }

    return {
      source: "bhunaksha:wfs:plot-diagram",
      status,
      fetchedAt,
      target,
      neighbors,
      roads,
      bounds,
      provenance: {
        source: "bhunaksha:wfs:plot-diagram",
        fetchedAt,
        parserVersion: PLOT_DIAGRAM_PARSER_VERSION,
        layer,
        roadLayerAttempted: roadLayer,
        roadLayerAvailable,
        neighborsRawHash: neighborsResult.rawHash || undefined,
        roadsRawHash: roadsResult.rawHash || undefined,
        counts: {
          neighborCandidates,
          neighborSelected: neighbors.length,
          roadFeatures: roads.length,
        },
      },
      warnings,
      error,
    };
  } catch (err) {
    clearTimeout(composeTimeout);
    const message = err instanceof Error ? err.message : String(err);
    return {
      source: "bhunaksha:wfs:plot-diagram",
      status: "failed",
      fetchedAt,
      target: null,
      neighbors: [],
      roads: [],
      bounds: null,
      provenance: {
        source: "bhunaksha:wfs:plot-diagram",
        fetchedAt,
        parserVersion: PLOT_DIAGRAM_PARSER_VERSION,
        layer,
        roadLayerAvailable: false,
        counts: { neighborCandidates: 0, neighborSelected: 0, roadFeatures: 0 },
      },
      warnings,
      error: message,
    };
  }
}

/**
 * Test seam: exposes the edge-sharing predicate for unit tests.
 * @internal
 */
export const __testing = { polygonsShareEdge, shoelaceAreaSqKm, computeBounds };
