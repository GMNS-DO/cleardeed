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

interface WFSQueryResult {
  data: WFSResponse;
  bbox: string;
  url: string;
  rawArtifactHash: string;
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function buildBbox(lat: number, lon: number, searchRadius: number): string {
  return `${(lon - searchRadius).toFixed(4)},${(lat - searchRadius).toFixed(4)},${(lon + searchRadius).toFixed(4)},${(lat + searchRadius).toFixed(4)}`;
}

async function queryWFS(
  lat: number,
  lon: number,
  layer: string,
  searchRadius: number
): Promise<WFSQueryResult> {
  const result = await runWithRetry(
    async (attempt) => {
      const bbox = buildBbox(lat, lon, searchRadius);
      const url = `${GEOSERVER_BASE}?SERVICE=WFS&VERSION=1.0.0&REQUEST=GetFeature&TYPENAME=revenue:${layer}&BBOX=${bbox},EPSG:4326&MAXFEATURES=${MAX_FEATURES}&OUTPUTFORMAT=application/json`;

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
  const { lat, lon, layer = "khurda_bhubaneswar", searchRadius = 0.001 } = input;
  const templateHash = sha256(WFS_TEMPLATE);
  const inputsTried: z.infer<typeof BhunakshaResult>["inputsTried"] = [];
  const warnings: NonNullable<z.infer<typeof BhunakshaResult>["warnings"]> = [];
  let rawArtifactHash: string | undefined;

  try {
    let query = await queryWFS(lat, lon, layer, searchRadius);
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

    const containingFeatures = data.features
      .filter((f) => pointInPolygon(lon, lat, f.geometry.coordinates[0]))
      .map((f) => ({ f, area: areaSquareKm(f.geometry.coordinates[0]) }))
      .sort((a, b) => a.area - b.area);
    const matchingFeature = containingFeatures[0]?.f;

    if (containingFeatures.length > 1) {
      warnings.push({
        code: "multiple_containing_polygons",
        message: `Found ${containingFeatures.length} candidate polygons containing the GPS point; selected the smallest by area (${String(matchingFeature?.id ?? "unknown id")}).`,
      });
    }

    if (!matchingFeature) {
      const returned = data.features.length;
      const declaredTotal = featureCount(data.totalFeatures ?? data.numberReturned);
      if (declaredTotal !== undefined && declaredTotal > returned) {
        warnings.push({
          code: "candidate_truncated",
          message: `GeoServer reported ${declaredTotal} candidate polygons but returned ${returned}; no containing polygon was present in the returned page.`,
        });
        return {
          source: "bhunaksha",
          status: "partial",
          statusReason: "candidate_truncated_no_containing_polygon",
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

      // Point not in any returned polygon — too small radius or no plot at this location
      // Return nearest by centroid distance as partial
      warnings.push({
        code: "no_containing_polygon",
        message: `Found ${data.features.length} candidate polygons, but none contained the GPS point.`,
      });
      return {
        source: "bhunaksha",
        status: "partial",
        statusReason: "point_outside_returned_polygons",
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

    // Use Turf.js for geodesic area (accurate across all latitudes).
    // areaSquareDegrees is kept for debugging/relative comparisons only.
    const areaSqKm = areaSquareKm(polygonCoords);

    return {
      source: "bhunaksha",
      status: "success",
      statusReason: "point_contained_in_polygon",
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
