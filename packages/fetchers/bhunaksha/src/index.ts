import { BhunakshaResult } from "@cleardeed/schema";
import { z } from "zod";

const GEOSERVER_BASE = "https://mapserver.odisha4kgeo.in/geoserver/revenue/wfs";
const USER_AGENT = "ClearDeed/1.0 (property due-diligence; contact@cleardeed.in)";

export interface BhunakshaInput {
  lat: number;
  lon: number;
  /**
   * Layer name. Defaults to khurda_bhubaneswar for Khordha district.
   * Format: "district_tehsil" all lowercase, no spaces.
   * e.g. "khurda_bhubaneswar", "baleswar_baleswar", "cuttack_cuttack"
   */
  layer?: string;
  /** Search radius in degrees. Default 0.005 (~500m). Larger = more results. */
  searchRadius?: number;
}

interface WFSFeature {
  type: "Feature";
  id: string;
  geometry: { type: "Polygon"; coordinates: number[][][] };
  properties: Record<string, unknown>;
}

interface WFSResponse {
  type: "FeatureCollection";
  features: WFSFeature[];
  totalFeatures: number;
  numberReturned: number;
  crs?: { type: string; properties: { name: string } };
}

async function queryWFS(
  lat: number,
  lon: number,
  layer: string,
  searchRadius: number
): Promise<WFSResponse> {
  const bbox = `${(lon - searchRadius).toFixed(4)},${(lat - searchRadius).toFixed(4)},${(lon + searchRadius).toFixed(4)},${(lat + searchRadius).toFixed(4)}`;
  const url = `${GEOSERVER_BASE}?SERVICE=WFS&VERSION=1.0.0&REQUEST=GetFeature&TYPENAME=revenue:${layer}&BBOX=${bbox},EPSG:4326&MAXFEATURES=50&OUTPUTFORMAT=application/json`;

  const res = await globalThis.fetch(url, {
    headers: { "User-Agent": USER_AGENT },
    signal: AbortSignal.timeout(15_000),
  });

  if (!res.ok) {
    throw new Error(`GeoServer WFS ${res.status} for layer ${layer}`);
  }

  return res.json() as Promise<WFSResponse>;
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

export async function bhunakshaFetch(
  input: BhunakshaInput
): Promise<z.infer<typeof BhunakshaResult>> {
  const fetchedAt = new Date().toISOString();
  const { lat, lon, layer = "khurda_bhubaneswar", searchRadius = 0.005 } = input;

  try {
    const data = await queryWFS(lat, lon, layer, searchRadius);

    if (!data.features || data.features.length === 0) {
      return {
        source: "bhunaksha",
        status: "partial",
        verification: "manual_required",
        fetchedAt,
        data: {
          plotNo: "",
          village: "",
          tahasil: "",
          area: undefined,
          polygon: undefined,
          classification: undefined,
          sourceDocument: `${GEOSERVER_BASE}?TYPENAME=revenue:${layer}`,
        },
      };
    }

    // Find the polygon that contains our point
    const matchingFeature = data.features.find((f) =>
      pointInPolygon(lon, lat, f.geometry.coordinates[0])
    );

    if (!matchingFeature) {
      // Point not in any returned polygon — too small radius or no plot at this location
      // Return nearest by centroid distance as partial
      const nearest = data.features
        .map((f) => {
          const coords = f.geometry.coordinates[0];
          const cx = coords.reduce((s, c) => s + c[0], 0) / coords.length;
          const cy = coords.reduce((s, c) => s + c[1], 0) / coords.length;
          const dist = Math.sqrt((cx - lon) ** 2 + (cy - lat) ** 2);
          return { f, dist };
        })
        .sort((a, b) => a.dist - b.dist)[0];

      const props = nearest.f.properties;
      return {
        source: "bhunaksha",
        status: "partial",
        verification: "manual_required",
        fetchedAt,
        data: {
          plotNo: String(props.revenue_plot ?? ""),
          village: String(props.revenue_village_name ?? ""),
          tahasil: String(props.tehsil_name ?? ""),
          area: undefined,
          polygon: { type: "Polygon", coordinates: nearest.f.geometry.coordinates },
          classification: String(props.revenue_village_code ?? ""),
          sourceDocument: `${GEOSERVER_BASE}?TYPENAME=revenue:${layer}`,
        },
      };
    }

    const props = matchingFeature.properties;
    const polygonCoords = matchingFeature.geometry.coordinates[0];
    const areaDeg2 = areaSquareDegrees(polygonCoords);
    // Very rough conversion: 1 sq degree lat ≈ 111km, lon ≈ 111km * cos(lat)
    // At lat ~20°, 1 sq deg ≈ 111km × 111km × cos(20°) ≈ 12,200 sq km per deg²
    // But this is a plot area, so use relative comparison
    const areaSqKm = areaDeg2 * 12300;

    return {
      source: "bhunaksha",
      status: "success",
      verification: "verified",
      fetchedAt,
      data: {
        plotNo: String(props.revenue_plot ?? ""),
        village: String(props.revenue_village_name ?? ""),
        tahasil: String(props.tehsil_name ?? ""),
        area: Math.round(areaSqKm * 100) / 100,
        polygon: { type: "Polygon" as const, coordinates: matchingFeature.geometry.coordinates },
        classification: String(props.revenue_village_code ?? ""),
        sourceDocument: `${GEOSERVER_BASE}?TYPENAME=revenue:${layer}`,
      },
    };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    return {
      source: "bhunaksha",
      status: "failed",
      verification: "manual_required",
      fetchedAt,
      error: errorMessage,
    };
  }
}

export async function healthCheck(): Promise<boolean> {
  try {
    const url = `${GEOSERVER_BASE}?SERVICE=WFS&VERSION=1.0.0&REQUEST=GetFeature&TYPENAME=revenue:khurda_bhubaneswar&BBOX=85.65,20.24,85.75,20.32,EPSG:4326&MAXFEATURES=1&OUTPUTFORMAT=application/json`;
    const res = await globalThis.fetch(url, {
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(10_000),
    });
    return res.ok;
  } catch {
    return false;
  }
}