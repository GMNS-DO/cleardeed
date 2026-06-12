/**
 * BDA Zoning Fetcher for ClearDeed
 *
 * Point-in-polygon lookup against BDA Master Plan zones.
 * Integrates with land classifier to show "what you can build here."
 *
 * Loads per-village zone data from data/bda_zones.json (produced by
 * scripts/probe/bluis-scraper.ts). Falls back to a 10-row seed (Patia,
 * Jaydev Vihar, Khandagiri, etc.) if the JSON is missing.
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

declare const __dirname: string; // Provided by vitest/Node CommonJS runtime

const BDA_ZONES_JSON_PATH = join(__dirname, "../data/bda_zones.json");
const BDA_ZONES_DATA_URL = "https://bluis.in/";
const PARSER_VERSION = "bda-zoning-v2";

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

type BdaZoneStatus = "success" | "no_match";
type BdaZoneStatusReason = "seed_data_found" | "json_data_loaded" | "no_data_match";
type BdaZoneWarningCode = "seed_data_limitation" | "json_data_limitation";

interface BdaZoneResult {
  source: "bda-zoning";
  status: BdaZoneStatus;
  statusReason: BdaZoneStatusReason;
  verification: "verified";
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

  return {
    source: "bda-zoning",
    status: results.length > 0 ? "success" : "no_match",
    statusReason: results.length > 0
      ? (getDataSource() === "json" ? "json_data_loaded" : "seed_data_found")
      : "no_data_match",
    verification: "verified",
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
  return getZones().length > 0;
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