/**
 * BDA Zoning Fetcher for ClearDeed
 *
 * Point-in-polygon lookup against a curated GeoJSON overlay of known BDA
 * Industrial Zone polygons in Khordha (Chandaka, Mancheswar, Rasulgarh,
 * Tamando, Khurda, Jatni — data/bda_industrial_polygons.geojson). Falls
 * back to centroid-based lookup against data/bda_zones.json only when
 * the polygon overlay is unavailable.
 *
 * ROR-INS-153 (Industrial-Zone Plot Sold as Residential, CEE DEE Builders
 * pattern) consumes this fetcher's output: fires redFlag when the plot GPS
 * falls inside an industrial polygon and the Bhulekh kisam is gharabari.
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { booleanPointInPolygon, featureCollection, point } from "@turf/turf";

declare const __dirname: string; // Provided by vitest/Node CommonJS runtime

const BDA_ZONES_JSON_PATH = join(__dirname, "../data/bda_zones.json");
const BDA_POLYGONS_JSON_PATH = join(__dirname, "../data/bda_industrial_polygons.geojson");
const BDA_ZONES_DATA_URL = "https://bluis.in/";
const PARSER_VERSION = "bda-zoning-v3";

// --- Type definitions for BDA zones ---

export type ZoneId =
  | "residential"
  | "commercial"
  | "industrial"
  | "green_belt"
  | "special"
  | "mixed_use"
  | "institutional";

interface Zone {
  id: ZoneId;
  name: string;
  description: string;
  permittedUses: string[];
  restrictions: string[];
  zoneCode: string;
}

interface BdaZoneRow {
  tehsil: string;
  village: string;
  locality?: string;
  zone: Zone;
  centroid?: {
    latitude: number;
    longitude: number;
  };
}

/** Shape as stored in bda_zones.json (zone is a string id, not a Zone object). */
interface BdaZoneJsonRow {
  village: string;
  tehsil: string;
  locality?: string;
  zone: ZoneId;
  centroid?: { latitude: number; longitude: number };
  sourceUrl?: string;
  sourceDate?: string;
}

type BdaZoneStatus = "success" | "no_match" | "out_of_scope";
type BdaZoneStatusReason =
  | "seed_data_found"
  | "json_data_loaded"
  | "polygon_overlay_match"
  | "no_data_match"
  | "outside_bda_planning_area";
type BdaZoneWarningCode = "seed_data_limitation" | "json_data_limitation" | "polygon_overlay_limitation";

export interface BdaZoneResult {
  source: "bda-zoning";
  status: BdaZoneStatus;
  statusReason: BdaZoneStatusReason;
  verification: "verified" | "n/a";
  fetchedAt: string;
  attempts: 0;
  inputsTried: Array<{ label: string; input: Record<string, unknown> }>;
  parserVersion: string;
  data: BdaZoneRow[];
  warnings: Array<{
    code: BdaZoneWarningCode;
    message: string;
  }>;
}

// --- Hard-coded BDA zone definitions (simplified) ---

const BDA_ZONES: Zone[] = [
  {
    id: "residential",
    name: "Residential",
    description: "Areas designated for residential development",
    permittedUses: [
      "Single-family residential",
      "Group housing",
      "Apartments",
      "Hostels",
    ],
    restrictions: ["No industrial/commercial use", "Floor area ratio governed by BDA guidelines"],
    zoneCode: "R",
  },
  {
    id: "commercial",
    name: "Commercial",
    description: "Areas designated for commercial activities",
    permittedUses: [
      "Shops",
      "Offices",
      "Commercial complexes",
      "Hotels",
      "Restaurants",
    ],
    restrictions: ["No residential use", "Height restrictions apply"],
    zoneCode: "C",
  },
  {
    id: "industrial",
    name: "Industrial",
    description: "Areas designated for industrial activities",
    permittedUses: [
      "Manufacturing",
      "Warehousing",
      "Industrial sheds",
      "Factories",
    ],
    restrictions: ["No residential use", "Pollution control norms apply"],
    zoneCode: "I",
  },
  {
    id: "green_belt",
    name: "Green Belt",
    description: "Areas reserved for environmental conservation",
    permittedUses: [
      "Agriculture",
      "Parks",
      "Forestry",
    ],
    restrictions: [
      "No construction",
      "No development",
      "Protected area",
    ],
    zoneCode: "G",
  },
  {
    id: "special",
    name: "Special Area",
    description: "Areas with specific development regulations",
    permittedUses: ["Mixed use as per BDA regulations", "As approved by BDA"],
    restrictions: ["Development requires BDA approval", "Specific restrictions apply"],
    zoneCode: "S",
  },
  {
    id: "mixed_use",
    name: "Mixed Use",
    description: "Areas allowing residential, commercial, and institutional uses",
    permittedUses: [
      "Residential apartments",
      "Ground-floor commercial",
      "Offices",
      "Convenience retail",
    ],
    restrictions: ["FAR governed by BDA master plan", "Height restrictions apply"],
    zoneCode: "M",
  },
  {
    id: "institutional",
    name: "Institutional",
    description: "Areas reserved for government, educational, and public facilities",
    permittedUses: [
      "Schools and universities",
      "Hospitals",
      "Government offices",
      "Religious institutions",
    ],
    restrictions: ["No private commercial use", "Sale to private parties generally not permitted"],
    zoneCode: "I2",
  },
];

// --- Hard-coded seed data for top 50 village/locality combinations ---

const BDA_SEED_DATA: BdaZoneRow[] = [
  // Bhubaneswar city core
  {
    tehsil: "Bhubaneswar",
    village: "Bhubaneswar",
    locality: "Patia",
    zone: BDA_ZONES.find((z) => z.id === "commercial")!,
    centroid: { latitude: 20.2746, longitude: 85.8404 },
  },
  {
    tehsil: "Bhubaneswar",
    village: "Bhubaneswar",
    locality: "Jaydev Vihar",
    zone: BDA_ZONES.find((z) => z.id === "residential")!,
    centroid: { latitude: 20.2654, longitude: 85.8543 },
  },
  {
    tehsil: "Bhubaneswar",
    village: "Bhubaneswar",
    locality: "Khandagiri",
    zone: BDA_ZONES.find((z) => z.id === "residential")!,
    centroid: { latitude: 20.2428, longitude: 85.8177 },
  },
  {
    tehsil: "Bhubaneswar",
    village: "Bhubaneswar",
    locality: "Dumuduma",
    zone: BDA_ZONES.find((z) => z.id === "residential")!,
    centroid: { latitude: 20.2699, longitude: 85.8504 },
  },
  {
    tehsil: "Bhubaneswar",
    village: "Bhubaneswar",
    locality: "Infocity",
    zone: BDA_ZONES.find((z) => z.id === "commercial")!,
    centroid: { latitude: 20.2701, longitude: 85.8399 },
  },

  // Jatni
  {
    tehsil: "Jatni",
    village: "Jatni",
    locality: "Jatni Town",
    zone: BDA_ZONES.find((z) => z.id === "residential")!,
    centroid: { latitude: 20.1325, longitude: 85.9278 },
  },

  // Balipatna
  {
    tehsil: "Balipatna",
    village: "Balipatna",
    locality: "Balipatna Market",
    zone: BDA_ZONES.find((z) => z.id === "commercial")!,
    centroid: { latitude: 20.2028, longitude: 85.7985 },
  },
  {
    tehsil: "Balipatna",
    village: "Jagulaipadar",
    zone: BDA_ZONES.find((z) => z.id === "industrial")!,
    centroid: { latitude: 20.2153, longitude: 85.8137 },
  },

  // Banapur
  {
    tehsil: "Banapur",
    village: "Banapur",
    locality: "Banapur Bazaar",
    zone: BDA_ZONES.find((z) => z.id === "commercial")!,
    centroid: { latitude: 19.9572, longitude: 85.5293 },
  },

  // Khandagiri
  {
    tehsil: "Khandagiri",
    village: "Khandagiri",
    locality: "Khandagiri Temple Area",
    zone: BDA_ZONES.find((z) => z.id === "special")!,
    centroid: { latitude: 20.2399, longitude: 85.8209 },
  },
];

// --- Main fetch function ---

export interface BdaZoneInput {
  latitude?: number;
  longitude?: number;
  village?: string;
  locality?: string;
  tehsil?: string;
}

export async function fetch(input: BdaZoneInput): Promise<BdaZoneResult> {
  const fetchedAt = new Date().toISOString();

  const inputsTried = [
    {
      label: "bda_zone_search",
      input: { latitude: input.latitude, longitude: input.longitude, village: input.village, locality: input.locality, tehsil: input.tehsil },
    },
  ];

  // If coordinates are provided, try the curated industrial polygon overlay
  // first. This is the path that unlocks ROR-INS-153 (CEE DEE Builders
  // pattern) — a real point-in-polygon containment check, not a centroid
  // proximity fallback. The overlay covers 6 known industrial pockets in
  // Khordha (~85% of known industrial estate area). A plot GPS that falls
  // inside any polygon returns status:"success" with the matching zone row.
  if (input.latitude && input.longitude) {
    const polygonHit = findZoneByPolygon(input.latitude, input.longitude);
    if (polygonHit) {
      return {
        source: "bda-zoning",
        status: "success",
        statusReason: "polygon_overlay_match",
        verification: "verified",
        fetchedAt,
        attempts: 0,
        inputsTried,
        parserVersion: PARSER_VERSION,
        data: [polygonHit],
        warnings: [
          {
            code: "polygon_overlay_limitation",
            message: `Plot GPS (${input.latitude.toFixed(4)}, ${input.longitude.toFixed(4)}) falls inside the ${polygonHit.locality ?? polygonHit.village} industrial polygon from data/bda_industrial_polygons.geojson. Polygons are bounding approximations sourced from public area/center data; verify the exact zone at https://bda.gov.in or via the Bhubaneswar Planning Authority before transacting.`,
          },
        ],
      };
    }
    // No polygon containment — fall through to centroid lookup for the
    // (village, tehsil, locality) name-based path, which will return
    // out_of_scope for villages outside BDA jurisdiction.
  }

  // If coordinates are provided, find the nearest zone using point-in-polygon lookup
  if (input.latitude && input.longitude) {
    // For seed data, find the closest centroid as a placeholder
    // In production, this would be real point-in-polygon logic
    const closest = findNearestCentroid(input.latitude, input.longitude);
    if (closest) {
      return {
        source: "bda-zoning",
        status: "success",
        statusReason: getDataSource() === "json" ? "json_data_loaded" : "seed_data_found",
        verification: "verified",
        fetchedAt,
        attempts: 0,
        inputsTried,
        parserVersion: PARSER_VERSION,
        data: [closest],
        warnings: [
          {
            code: getDataSource() === "json" ? "json_data_limitation" : "seed_data_limitation",
            message: getDataSource() === "json"
              ? `BDA zoning loaded from bda_zones.json. For exact verification, consult ${BDA_ZONES_DATA_URL}`
              : "BDA zoning data is from inline seed (10 localities). For full coverage of 50+ villages, run: node scripts/probe/bluis-scraper.ts --scrape. Verify exact zoning at BDA office.",
          },
        ],
      };
    }
  }

  // If village/locality is provided, filter to that area
  let results = getZones();
  if (input.village) {
    results = results.filter((row) =>
      row.village.toLowerCase().includes(input.village!.toLowerCase())
    );
  }
  if (input.locality) {
    const localityLower = input.locality!.toLowerCase();
    results = results.filter(
      (row) => row.locality?.toLowerCase().includes(localityLower) ?? false
    );
  }
  if (input.tehsil) {
    results = results.filter((row) =>
      row.tehsil.toLowerCase().includes(input.tehsil!.toLowerCase())
    );
  }

  // When results is empty the plot is outside BDA's planning area. BDA Master
  // Plan zoning only covers localities within the BDA jurisdiction (mostly the
  // Bhubaneswar Municipal Corporation area plus a few BDA-notified villages).
  // A non-match is therefore a *neutral* outcome, not a degraded one — report
  // it as "out_of_scope" so the buyer is told to check the local Tahsildar
  // rather than seeing a "source failed" message.
  const isOutOfScope = results.length === 0;
  return {
    source: "bda-zoning",
    status: isOutOfScope ? "out_of_scope" : "success",
    statusReason: isOutOfScope
      ? "outside_bda_planning_area"
      : (getDataSource() === "json" ? "json_data_loaded" : "seed_data_found"),
    verification: isOutOfScope ? "n/a" : "verified",
    fetchedAt,
    attempts: 0,
    inputsTried,
    parserVersion: PARSER_VERSION,
    data: results,
    warnings: [
      {
        code: getDataSource() === "json" ? "json_data_limitation" : "seed_data_limitation",
        message: getDataSource() === "json"
          ? `BDA zoning loaded from bda_zones.json. For exact verification, consult ${BDA_ZONES_DATA_URL}`
          : "BDA zoning data is from inline seed (10 localities). For full coverage of 50+ villages, run: node scripts/probe/bluis-scraper.ts --scrape. Verify exact zoning at BDA office.",
      },
    ],
  };
}

// --- Helper functions ---

/**
 * Find the nearest centroid for a given coordinate.
 * This is a placeholder for real point-in-polygon logic.
 */
function findNearestCentroid(latitude: number, longitude: number): BdaZoneRow | null {
  const zones = getZones();
  if (zones.length === 0) return null;

  let minDistance = Infinity;
  let nearest: BdaZoneRow | null = null;

  for (const row of zones) {
    if (!row.centroid) continue;
    const distance = calculateDistance(
      latitude,
      longitude,
      row.centroid.latitude,
      row.centroid.longitude
    );
    if (distance < minDistance) {
      minDistance = distance;
      nearest = row;
    }
  }

  return nearest;
}

/**
 * Calculate distance between two coordinates using Haversine formula.
 * Returns distance in meters.
 */
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000; // Earth's radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

/**
 * Get BDA zone by code for easy reference.
 */
export function getZoneByCode(zoneCode: string): Zone | null {
  return BDA_ZONES.find((z) => z.zoneCode === zoneCode) || null;
}

/**
 * Check if a zone permits residential use.
 */
export function permitsResidential(zone: Zone): boolean {
  return zone.permittedUses.some((use) => use.toLowerCase().includes("residential"));
}

/**
 * Check if a zone permits commercial use.
 */
export function permitsCommercial(zone: Zone): boolean {
  return zone.permittedUses.some((use) => use.toLowerCase().includes("commercial"));
}

/**
 * Check if a zone permits industrial use.
 */
export function permitsIndustrial(zone: Zone): boolean {
  return zone.permittedUses.some((use) => use.toLowerCase().includes("industrial"));
}

// --- Health check ---

export async function healthCheck(): Promise<boolean> {
  // Healthy when either the polygon overlay OR the centroid JSON loads.
  // The polygon overlay is the primary path for Sprint 4 (ROR-INS-153).
  return loadPolygonOverlay() !== null || getZones().length > 0;
}

// --- JSON loader + helpers (parallel to circle-rate pattern) ---

let cachedZones: BdaZoneRow[] | null = null;

function resolveZone(zoneId: string): Zone | null {
  return BDA_ZONES.find((z) => z.id === zoneId) ?? null;
}

function getZones(): BdaZoneRow[] {
  if (cachedZones !== null) return cachedZones;
  if (existsSync(BDA_ZONES_JSON_PATH)) {
    try {
      const jsonContent = readFileSync(BDA_ZONES_JSON_PATH, "utf-8");
      const parsed = JSON.parse(jsonContent) as BdaZoneJsonRow[];
      if (Array.isArray(parsed) && parsed.length > 0) {
        // Normalize: resolve string zone id to full Zone object
        const normalized: BdaZoneRow[] = [];
        for (const row of parsed) {
          const zone = resolveZone(row.zone);
          if (!zone) {
            console.warn(`⚠️ Skipping ${row.village}: unknown zone id "${row.zone}"`);
            continue;
          }
          normalized.push({
            village: row.village,
            tehsil: row.tehsil,
            locality: row.locality,
            zone,
            centroid: row.centroid,
          });
        }
        if (normalized.length > 0) {
          cachedZones = normalized;
          return normalized;
        }
      }
    } catch (err) {
      console.error("⚠️ Failed to load BDA zones JSON, using seed:", (err as Error).message);
    }
  }
  cachedZones = BDA_SEED_DATA;
  return BDA_SEED_DATA;
}

/** Reset cache (used by tests). */
export function _resetCache(): void {
  cachedZones = null;
}

/** Get the data source for reporting. */
export function getDataSource(): "json" | "inline_seed" {
  return existsSync(BDA_ZONES_JSON_PATH) && cachedZones !== BDA_SEED_DATA
    ? "json"
    : "inline_seed";
}

/**
 * Lookup zone for a specific village + tehsil pair.
 * Returns the best match from JSON data or seed fallback.
 */
export function getZoneForVillage(
  village: string,
  tehsil: string
): Zone | null {
  const zones = getZones();
  const villageLower = village.toLowerCase();
  const tehsilLower = tehsil.toLowerCase();

  // Exact village + tehsil match
  const exact = zones.find(
    (z) =>
      z.village.toLowerCase() === villageLower &&
      z.tehsil.toLowerCase() === tehsilLower
  );
  if (exact) return exact.zone;

  // Village-only match
  const villageMatch = zones.find(
    (z) => z.village.toLowerCase() === villageLower
  );
  if (villageMatch) return villageMatch.zone;

  // Tehsil-level fallback (any village)
  const tehsilMatch = zones.find(
    (z) => z.tehsil.toLowerCase() === tehsilLower
  );
  return tehsilMatch?.zone ?? null;
}

/**
 * Lookup zone for a GPS coordinate using nearest-centroid fallback.
 * Returns the closest zone from any known locality or null if no data.
 */
export function getZoneForLocation(lat: number, lng: number): Zone | null {
  const zones = getZones();
  if (zones.length === 0) return null;

  let nearest: BdaZoneRow | null = null;
  let minDist = Infinity;

  for (const row of zones) {
    if (!row.centroid) continue;
    const dist = calculateDistance(lat, lng, row.centroid.latitude, row.centroid.longitude);
    if (dist < minDist) {
      minDist = dist;
      nearest = row;
    }
  }

  return nearest?.zone ?? null;
}

// ─── GeoJSON polygon overlay (Sprint 4) ──────────────────────────────────────
//
// data/bda_industrial_polygons.geojson is a curated, polygon-level overlay of
// known BDA Industrial + Industrial-2 pockets in Khordha. Each polygon is a
// bounding rectangle (not surveyed boundary) sourced from public center/area
// data (Wikipedia, geoiq.io, IDCO listings, BDA CDP maps). Coverage is
// ~85% of known industrial estate land area; village-scale industrial kisam
// entries inside residential villages are NOT included — those will not
// match by GPS and will be caught by ROR-INS-153's Bhulekh cross-reference.
//
// ROR-INS-153 reads bdaZoneData.data[].zone.id and fires redFlag only when
// status === "success" AND zone.id in ["industrial", "industrial_2"].

/** Cache for the parsed GeoJSON. Rebuilt only when the underlying file mtime changes. */
let _polygonCache: {
  collection: ReturnType<typeof featureCollection>;
  mtime: number;
} | null = null;

function loadPolygonOverlay(): ReturnType<typeof featureCollection> | null {
  try {
    if (!existsSync(BDA_POLYGONS_JSON_PATH)) return null;
    const stat = existsSync(BDA_POLYGONS_JSON_PATH) ? require("fs").statSync(BDA_POLYGONS_JSON_PATH) : null;
    const mtime = stat?.mtimeMs ?? 0;
    if (_polygonCache && _polygonCache.mtime === mtime) return _polygonCache.collection;
    const raw = readFileSync(BDA_POLYGONS_JSON_PATH, "utf-8");
    const parsed = JSON.parse(raw);
    if (!parsed?.features?.length) return null;
    _polygonCache = { collection: featureCollection(parsed.features), mtime };
    return _polygonCache.collection;
  } catch {
    return null;
  }
}

/**
 * Returns the BDA Zone row for a GPS coordinate if it falls inside any
 * curated industrial polygon, or null when (a) the polygon overlay is
 * missing, (b) the point is outside every polygon, or (c) turf throws.
 *
 * Called from `fetch()` before the centroid fallback so that a genuine
 * industrial pocket takes precedence over "nearest residential centroid".
 */
export function findZoneByPolygon(lat: number, lng: number): BdaZoneRow | null {
  const collection = loadPolygonOverlay();
  if (!collection) return null;

  try {
    const pt = point([lng, lat]); // GeoJSON is [lng, lat]
    const hit = collection.features.find((f) => {
      try {
        return booleanPointInPolygon(pt, f);
      } catch {
        return false;
      }
    });
    if (!hit) return null;
    const p = hit.properties;
    const zone = resolveZone(p.zone);
    if (!zone) return null;
    return {
      village: p.village,
      tehsil: p.tehsil,
      locality: p.name,
      zone,
      centroid: p.centroidLatLng ? { latitude: p.centroidLatLng[1], longitude: p.centroidLatLng[0] } : undefined,
    };
  } catch {
    return null;
  }
}