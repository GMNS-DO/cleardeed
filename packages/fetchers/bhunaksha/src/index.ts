import { BhunakshaResult, runWithRetry } from "@cleardeed/schema";
import { z } from "zod";
import { polygon as turfPolygon, area as turfArea } from "@turf/turf";
import { createHash } from "node:crypto";

const GEOSERVER_BASE = "https://mapserver.odisha4kgeo.in/geoserver/revenue/wfs";
const USER_AGENT = "ClearDeed/1.0 (property due-diligence; contact@cleardeed.in)";
const PARSER_VERSION = "bhunaksha-fetcher/2026-04-30";
const AREA_COMPUTATION = "turf_geodesic_area_v1";
const MAX_FEATURES = 500;
const WFS_TEMPLATE = `${GEOSERVER_BASE}?SERVICE=WFS&VERSION=1.0.0&REQUEST=GetFeature&TYPENAME=revenue:{layer}&BBOX={bbox},EPSG:4326&MAXFEATURES=${MAX_FEATURES}&OUTPUTFORMAT=application/json`;
const EMPTY_RETRY_MULTIPLIER = 4;
const MAX_ATTEMPTS = 2;
const WFS_TIMEOUT_MS = 15_000;

export interface BhunakshaInput {
  lat: number;
  lon: number;
  /**
   * Layer name. Defaults to khurda_bhubaneswar for Khordha district.
   * Format: "district_tehsil" all lowercase, no spaces.
   * e.g. "khurda_bhubaneswar", "baleswar_baleswar", "cuttack_cuttack"
   */
  layer?: string;
  /** Search radius in degrees. Default 0.001 (~100m). Larger = more results. */
  searchRadius?: number;
  /**
   * Village name to filter results to a specific village.
   * Use when you know the village name (e.g. from Bhulekh) but not exact GPS.
   * This adds a CQL_FILTER=revenue_village_name LIKE '%VillageName%' clause.
   */
  villageName?: string;
  /**
   * Plot number to match a specific plot within the village.
   * When provided alongside villageName, this adds a second CQL clause:
   * revenue_plot = '<plotNo>'. This allows precise plot matching without GPS.
   */
  plotNo?: string;
}

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

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

interface WFSQueryResult {
  data: WFSResponse;
  bbox: string;
  url: string;
  rawArtifactHash: string;
}

/**
 * Fetch adjacent plots to a target polygon using the same GeoServer WFS.
 *
 * Algorithm:
 * 1. Build a bounding box slightly larger than the target polygon (~300m buffer)
 * 2. Query WFS with that expanded bbox
 * 3. Filter out the target plot itself (by geometry hash match)
 * 4. Return remaining polygons with their metadata
 *
 * Adjacent plot analysis (ceiling plan Section 4, Source 5):
 * A plot whose adjacent plots are all government-classified (road, drain, water body)
 * may be a corner encroachment or boundary-error case. Conversely, private neighbors
 * across all sides indicate a normal, well-defined plot boundary.
 */
export async function fetchAdjacentPlots(input: {
  lat: number;
  lon: number;
  targetPolygon: { type: "Polygon"; coordinates: number[][] };
  targetGeometryHash: string;
  layer?: string;
}): Promise<AdjacentPlotsResult> {
  const { lat, lon, targetPolygon, targetGeometryHash, layer = "khurda_bhubaneswar" } = input;
  const fetchedAt = new Date().toISOString();
  const PARSER_VERSION = "bhunaksha-adjacent/2026-05-14";

  try {
    // Buffer the bounding box by ~0.003 degrees (~330m) to capture neighbors
    const bbox = buildBbox(lat, lon, 0.003);
    const url = `${GEOSERVER_BASE}?SERVICE=WFS&VERSION=1.0.0&REQUEST=GetFeature&TYPENAME=revenue:${layer}&BBOX=${bbox},EPSG:4326&MAXFEATURES=${MAX_FEATURES}&OUTPUTFORMAT=application/json`;

    const res = await globalThis.fetch(url, {
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(WFS_TIMEOUT_MS),
    });

    if (!res.ok) {
      throw new Error(`GeoServer WFS ${res.status} for adjacent query`);
    }

    const raw = typeof res.text === "function" ? await res.text() : JSON.stringify(await res.json());
    const parsed = JSON.parse(raw) as unknown;
    const validation = WFSResponseSchema.safeParse(parsed);
    if (!validation.success) {
      return {
        source: "bhunaksha",
        status: "partial",
        fetchedAt,
        adjacentPlots: [],
        totalFound: 0,
        filteredFromTarget: 0,
        statusReason: "wfs_response_validation_failed",
        verification: "manual_required",
      };
    }

    const allFeatures = validation.data.features;

    // Filter out the target plot itself
    const candidates = allFeatures.filter((f) => {
      const hash = polygonCentroidHash(f);
      return hash !== targetGeometryHash;
    });

    const adjacent: AdjacentPlot[] = candidates.slice(0, 20).map((f) => {
      const coords = f.geometry.coordinates[0];
      const props = f.properties;
      return {
        plotNo: String(props.revenue_plot ?? ""),
        village: String(props.revenue_village_name ?? ""),
        featureId: String(f.id ?? ""),
        geometryHash: polygonCentroidHash(f),
        areaSqKm: areaSquareKm(coords),
      };
    });

    return {
      source: "bhunaksha",
      status: candidates.length > 0 ? "success" : "partial",
      fetchedAt,
      adjacentPlots: adjacent,
      totalFound: allFeatures.length,
      filteredFromTarget: allFeatures.length - candidates.length,
      statusReason: candidates.length > 0
        ? `found_${candidates.length}_adjacent_candidates`
        : "no_candidates_beyond_target",
      verification: "verified",
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      source: "bhunaksha",
      status: "failed",
      fetchedAt,
      adjacentPlots: [],
      totalFound: 0,
      filteredFromTarget: 0,
      statusReason: `fetch_error: ${message}`,
      verification: "manual_required",
    };
  }
}

export interface AdjacentPlotsResult {
  source: "bhunaksha";
  status: string;
  fetchedAt: string;
  adjacentPlots: AdjacentPlot[];
  totalFound: number;
  filteredFromTarget: number;
  statusReason: string;
  verification: string;
}

export interface AdjacentPlot {
  plotNo: string;
  village: string;
  featureId: string;
  geometryHash: string;
  areaSqKm: number;
}

function polygonCentroidHash(feature: WFSFeature): string {
  const coords = feature.geometry?.coordinates;
  if (!coords) return "";
  const first = coords[0];
  if (!first) return "";
  // Use centroid as stable-ish geometric proxy for the polygon
  const n = first.length - 1;
  let sumLon = 0, sumLat = 0;
  for (let i = 0; i < n; i++) { sumLon += first[i][0]; sumLat += first[i][1]; }
  return sha256(`${sumLon / n},${sumLat / n},${feature.id ?? ""}`);
}

function buildBbox(lat: number, lon: number, searchRadius: number): string {
  return `${(lon - searchRadius).toFixed(4)},${(lat - searchRadius).toFixed(4)},${(lon + searchRadius).toFixed(4)},${(lat + searchRadius).toFixed(4)}`;
}

async function queryWFS(
  lat: number,
  lon: number,
  layer: string,
  searchRadius: number,
  villageName?: string,
  plotNo?: string
): Promise<WFSQueryResult> {
  const result = await runWithRetry(
    async (attempt) => {
      const bbox = buildBbox(lat, lon, searchRadius);
      const params = new URLSearchParams({
        SERVICE: "WFS",
        VERSION: "1.0.0",
        REQUEST: "GetFeature",
        TYPENAME: `revenue:${layer}`,
        BBOX: `${bbox},EPSG:4326`,
        MAXFEATURES: String(MAX_FEATURES),
        OUTPUTFORMAT: "application/json",
      });
      if (villageName) {
        // CQL filter by village name — exact match on Bhunaksha's revenue_village_name field.
        // Bhunaksha stores names as "Mendhasala", "Ghatikia", etc. (no underscores in source data).
        // WFS LIKE is case-insensitive on the server side.
        // If plotNo is also provided, add an AND clause for exact plot number match.
        const villageFilter = `revenue_village_name LIKE '%${villageName}%'`;
        const plotFilter = plotNo ? ` AND revenue_plot = '${plotNo}'` : "";
        params.set("CQL_FILTER", villageFilter + plotFilter);
        // No BBOX when filtering by village — we want all plots in the village.
        params.delete("BBOX");
      }
      const url = `${GEOSERVER_BASE}?${params.toString()}`;

      const res = await globalThis.fetch(url, {
        headers: { "User-Agent": USER_AGENT },
        signal: AbortSignal.timeout(15_000),
      });

      if (!res.ok) {
        throw new Error(`GeoServer WFS ${res.status} for layer ${layer}`);
      }

      const raw = typeof res.text === "function"
        ? await res.text()
        : JSON.stringify(await res.json());
      const parsed = JSON.parse(raw) as unknown;
      const validation = WFSResponseSchema.safeParse(parsed);
      if (!validation.success) {
        throw new Error(`Invalid GeoServer WFS response shape: ${validation.error.issues[0]?.message ?? "unknown error"}`);
      }

      return {
        data: validation.data,
        bbox,
        url,
        rawArtifactHash: sha256(raw),
      };
    },
    { maxAttempts: 2, baseDelayMs: 500 }
  );
  return result.value;
}

function pointInPolygon(
  px: number,
  py: number,
  polygon: number[][]
): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i][0], yi = polygon[i][1];
    const xj = polygon[j][0], yj = polygon[j][1];
    const intersect =
      yi > py !== yj > py &&
      px < ((xj - xi) * (py - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function areaSquareDegrees(polygon: number[][]): number {
  // Shoelace formula for area in square degrees
  let area = 0;
  const n = polygon.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    area += polygon[i][0] * polygon[j][1];
    area -= polygon[j][0] * polygon[i][1];
  }
  return Math.abs(area / 2);
}

export function computePolygonAreaSqKm(polygonCoords: number[][]): number {
  const turfPoly = turfPolygon([polygonCoords]);
  return turfArea(turfPoly) / 1_000_000;
}

function areaSquareKm(polygonCoords: number[][]): number {
  return computePolygonAreaSqKm(polygonCoords);
}

function sourceDocument(layer: string): string {
  return `${GEOSERVER_BASE}?TYPENAME=revenue:${layer}`;
}

function crsName(data: WFSResponse): string | undefined {
  const crs = data.crs as { properties?: { name?: unknown }; name?: unknown } | undefined;
  const name = crs?.properties?.name ?? crs?.name;
  return typeof name === "string" ? name : undefined;
}

function geometryHash(feature: WFSFeature): string {
  return sha256(JSON.stringify(feature.geometry));
}

export async function bhunakshaFetch(
  input: BhunakshaInput
): Promise<z.infer<typeof BhunakshaResult>> {
  const fetchedAt = new Date().toISOString();
  const { lat, lon, layer = "khurda_bhubaneswar", searchRadius = 0.001, villageName, plotNo } = input;
  const templateHash = sha256(WFS_TEMPLATE);
  const inputsTried: z.infer<typeof BhunakshaResult>["inputsTried"] = [];
  const warnings: NonNullable<z.infer<typeof BhunakshaResult>["warnings"]> = [];
  let rawArtifactHash: string | undefined;

  try {
    // ── Query WFS ────────────────────────────────────────────────────────────
    let query: WFSQueryResult;
    if (villageName) {
      // Village-level filter: CQL filter replaces BBOX. Always try village first.
      query = await queryWFS(lat, lon, layer, searchRadius, villageName, plotNo);
      inputsTried.push({
        label: "village_cql_filter",
        input: { lat, lon, layer, villageName, searchRadius, url: query.url },
      });
      rawArtifactHash = query.rawArtifactHash;

      // If village CQL returned 0, fall back to plain BBOX (no village filter)
      if (query.data.features.length === 0) {
        warnings.push({
          code: "village_cql_empty_fallback",
          message: `CQL filter for village "${villageName}" returned 0 features; falling back to BBOX.`,
        });
        query = await queryWFS(lat, lon, layer, searchRadius);
        inputsTried.push({
          label: "village_fallback_bbox",
          input: { lat, lon, layer, searchRadius, bbox: query.bbox, url: query.url },
        });
        rawArtifactHash = query.rawArtifactHash;
      }
    } else {
      // Standard BBOX-based query
      query = await queryWFS(lat, lon, layer, searchRadius);
      inputsTried.push({
        label: "initial_bbox",
        input: { lat, lon, layer, searchRadius, bbox: query.bbox, url: query.url },
      });
      rawArtifactHash = query.rawArtifactHash;

      if (query.data.features.length === 0) {
        const expandedRadius = searchRadius * EMPTY_RETRY_MULTIPLIER;
        warnings.push({
          code: "empty_initial_bbox_retry",
          message: `Initial BBOX returned 0 candidate polygons; retried with radius ${expandedRadius}.`,
        });
        query = await queryWFS(lat, lon, layer, expandedRadius);
        inputsTried.push({
          label: "expanded_bbox",
          input: { lat, lon, layer, searchRadius: expandedRadius, bbox: query.bbox, url: query.url },
        });
        rawArtifactHash = query.rawArtifactHash;
      }
    }

    const data = query.data;

    if (!data.features || data.features.length === 0) {
      return {
        source: "bhunaksha",
        status: "partial",
        statusReason: "no_features_returned",
        verification: "manual_required",
        fetchedAt,
        attempts: inputsTried.length,
        inputsTried,
        rawArtifactHash,
        parserVersion: PARSER_VERSION,
        templateHash,
        warnings,
        data: {
          plotNo: "",
          village: "",
          tahasil: "",
          area: undefined,
          areaUnit: "sq_km",
          shapeAreaUnit: "degrees2",
          crs: crsName(data),
          layer,
          areaComputation: AREA_COMPUTATION,
          polygon: undefined,
          classification: undefined,
          sourceDocument: sourceDocument(layer),
        },
      };
    }

    // ── Match feature ────────────────────────────────────────────────────────
    let matchingFeature: WFSFeature | undefined;

    // Priority 1: match by plot number (Bhulekh already knows the plot number)
    if (plotNo) {
      const plotMatch = data.features.find(
        (f) => String(f.properties?.revenue_plot ?? "").trim() === String(plotNo).trim()
      );
      if (plotMatch) {
        matchingFeature = plotMatch;
        warnings.push({
          code: "matched_by_plot_number",
          message: `Matched plot #${plotNo} by Bhulekh plot number.`,
        });
      } else if (data.features.length > 0) {
        warnings.push({
          code: "plot_number_not_found_in_village",
          message: `Plot #${plotNo} not found in village "${villageName ?? "BBOX"}" candidates (${data.features.length} plots returned).`,
        });
      }
    }

    // Priority 2: match by centroid-in-polygon (when no plot number match or no plotNo provided)
    if (!matchingFeature) {
      const containingFeatures = data.features
        .filter((f) => pointInPolygon(lon, lat, f.geometry.coordinates[0]))
        .map((f) => ({ f, area: areaSquareKm(f.geometry.coordinates[0]) }))
        .sort((a, b) => a.area - b.area);
      matchingFeature = containingFeatures[0]?.f;

      if (containingFeatures.length > 1) {
        warnings.push({
          code: "multiple_containing_polygons",
          message: `Found ${containingFeatures.length} candidate polygons containing the GPS point; selected the smallest by area (${String(matchingFeature?.id ?? "unknown id")}).`,
        });
      }
    }

    if (!matchingFeature) {
      const returned = data.features.length;
      const declaredTotal = featureCount(data.totalFeatures ?? data.numberReturned);
      const truncated = declaredTotal !== undefined && declaredTotal > returned;
      warnings.push({
        code: truncated ? "candidate_truncated" : "no_containing_polygon",
        message: truncated
          ? `GeoServer reported ${declaredTotal} candidate polygons but returned ${returned}; no containing polygon was present in the returned page.`
          : `Found ${returned} candidate polygons, but none contained the GPS point.`,
      });
      return {
        source: "bhunaksha",
        status: "partial",
        statusReason: truncated ? "candidate_truncated_no_containing_polygon" : "point_outside_returned_polygons",
        verification: "manual_required",
        fetchedAt,
        attempts: inputsTried.length,
        inputsTried,
        rawArtifactHash,
        parserVersion: PARSER_VERSION,
        templateHash,
        warnings,
        data: {
          plotNo: "",
          village: "",
          tahasil: "",
          area: undefined,
          areaUnit: "sq_km",
          shapeAreaUnit: "degrees2",
          crs: crsName(data),
          layer,
          areaComputation: AREA_COMPUTATION,
          polygon: undefined,
          sourceDocument: sourceDocument(layer),
        },
      };
    }

    const props = matchingFeature.properties;
    const polygonCoords = matchingFeature.geometry.coordinates[0];
    const shapeAreaRaw = numericProperty(props.shape_area);
    const areaSqKm = areaSquareKm(polygonCoords);

    return {
      source: "bhunaksha",
      status: "success",
      statusReason: plotNo && String(props.revenue_plot ?? "").trim() === String(plotNo).trim()
        ? "matched_by_plot_number"
        : "point_contained_in_polygon",
      verification: "verified",
      fetchedAt,
      attempts: inputsTried.length,
      inputsTried,
      rawArtifactHash,
      parserVersion: PARSER_VERSION,
      templateHash,
      warnings,
      data: {
        plotNo: String(props.revenue_plot ?? ""),
        village: String(props.revenue_village_name ?? ""),
        tahasil: String(props.tehsil_name ?? ""),
        area: areaSqKm,
        areaUnit: "sq_km",
        shapeAreaRaw,
        shapeAreaUnit: "degrees2",
        crs: crsName(data),
        featureId: matchingFeature.id,
        layer,
        geometryHash: geometryHash(matchingFeature),
        areaComputation: AREA_COMPUTATION,
        polygon: { type: "Polygon" as const, coordinates: matchingFeature.geometry.coordinates },
        sourceDocument: sourceDocument(layer),
      },
    };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    return {
      source: "bhunaksha",
      status: "failed",
      statusReason: "fetch_or_parse_error",
      verification: "manual_required",
      fetchedAt,
      attempts: inputsTried.length || undefined,
      inputsTried: inputsTried.length ? inputsTried : undefined,
      rawArtifactHash,
      parserVersion: PARSER_VERSION,
      templateHash,
      error: errorMessage,
    };
  }
}

function featureCount(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function numericProperty(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

export async function healthCheck(): Promise<boolean> {
  try {
    // Keep this BBOX small. Broad BBOX health probes can time out even when
    // production-sized plot lookups are healthy.
    const url = `${GEOSERVER_BASE}?SERVICE=WFS&VERSION=1.0.0&REQUEST=GetFeature&TYPENAME=revenue:khurda_bhubaneswar&BBOX=85.7000,20.2720,85.7020,20.2740,EPSG:4326&MAXFEATURES=1&OUTPUTFORMAT=application/json`;
    const res = await globalThis.fetch(url, {
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(10_000),
    });
    return res.ok;
  } catch {
    return false;
  }
}
