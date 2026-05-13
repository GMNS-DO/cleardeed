import { createHash } from "node:crypto";
import khordhaBoundaryAsset from "./assets/khordha-district-boundary.json";

/**
 * Cross-source validation utilities for ClearDeed.
 *
 * Phase 1 (P1): GPS bounding box, village normalization, area reconciliation.
 */

// ─── GPS Bounds ────────────────────────────────────────────────────────────────

/** Khordha district approximate bounding box. */
export const KHORDHA_BOUNDS = {
  minLat: 19.8,
  maxLat: 20.5,
  minLon: 85.0,
  maxLon: 86.0,
} as const;

export function validateGPSBounds(
  lat: number,
  lon: number
): { valid: boolean; bounds: typeof KHORDHA_BOUNDS } {
  const valid =
    Number.isFinite(lat) &&
    Number.isFinite(lon) &&
    lat >= KHORDHA_BOUNDS.minLat &&
    lat <= KHORDHA_BOUNDS.maxLat &&
    lon >= KHORDHA_BOUNDS.minLon &&
    lon <= KHORDHA_BOUNDS.maxLon;
  return { valid, bounds: KHORDHA_BOUNDS };
}

export const KHORDHA_BOUNDARY_METADATA = {
  preferredOfficialSourceUrl:
    "https://geo-soi.iudx.io/collections/district_boundaries/items/KHORDHA?f=html",
  preferredOfficialSource: "Survey of India district boundary item via IUDX/pygeoapi",
  preferredOfficialItemId: "KHORDHA",
  preferredOfficialFeatureId: "211",
  preferredOfficialStateLgd: "21",
  preferredOfficialDistrictLgd: "362",
  preferredOfficialShapeArea: 2781806247.82,
  preferredOfficialShapeLength: 640351.921239,
  geometrySourceUrl: "https://commons.wikimedia.org/wiki/Data:India/Odisha/Khordha.map?action=raw",
  geometrySource: "Wikimedia Commons DataMap using DataMeet 2011 census district boundary",
  geometryLicense: "CC-BY-2.5",
  geometryArtifactHash:
    "24ad815db8130feea8f3f10e61481bdce83dd3bbce7f3f1549c9145e8e700326",
  fetchedAt: "2026-04-30",
} as const;

export type KhordhaGPSStatus = "inside" | "near_boundary" | "outside" | "invalid";

export interface KhordhaGPSValidation {
  valid: boolean;
  blocked: boolean;
  status: KhordhaGPSStatus;
  reason: "invalid_numeric" | "outside_bounds" | "outside_polygon" | "near_boundary" | "inside";
  message: string;
  distanceToBoundaryKm?: number;
  bounds: typeof KHORDHA_BOUNDS;
  source: typeof KHORDHA_BOUNDARY_METADATA;
}

export class GPSValidationError extends Error {
  readonly code = "GPS_OUTSIDE_KHORDHA";
  readonly validation: KhordhaGPSValidation;

  constructor(validation: KhordhaGPSValidation) {
    super(validation.message);
    this.name = "GPSValidationError";
    this.validation = validation;
  }
}

const KHORDHA_POLYGON_COORDINATES = (
  khordhaBoundaryAsset as {
    data: { geometry: { type: "Polygon"; coordinates: number[][][] } };
  }
).data.geometry.coordinates;

export function validateKhordhaGPS(
  lat: number,
  lon: number,
  nearBoundaryThresholdKm = 1
): KhordhaGPSValidation {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return {
      valid: false,
      blocked: true,
      status: "invalid",
      reason: "invalid_numeric",
      message: "GPS coordinates must be finite numeric latitude/longitude values.",
      bounds: KHORDHA_BOUNDS,
      source: KHORDHA_BOUNDARY_METADATA,
    };
  }

  const bounds = validateGPSBounds(lat, lon);
  if (!bounds.valid) {
    return {
      valid: false,
      blocked: true,
      status: "outside",
      reason: "outside_bounds",
      message: `GPS coordinates (${lat.toFixed(6)}, ${lon.toFixed(6)}) fall outside the supported Khordha district numeric bounds (${KHORDHA_BOUNDS.minLat}-${KHORDHA_BOUNDS.maxLat} N, ${KHORDHA_BOUNDS.minLon}-${KHORDHA_BOUNDS.maxLon} E).`,
      bounds: KHORDHA_BOUNDS,
      source: KHORDHA_BOUNDARY_METADATA,
    };
  }

  const inside = polygonContainsPoint(KHORDHA_POLYGON_COORDINATES, lon, lat);
  if (!inside) {
    return {
      valid: false,
      blocked: true,
      status: "outside",
      reason: "outside_polygon",
      message: `GPS coordinates (${lat.toFixed(6)}, ${lon.toFixed(6)}) are within the broad Khordha bounding box but outside the district boundary polygon. ClearDeed V1 only supports Khordha district plots.`,
      bounds: KHORDHA_BOUNDS,
      source: KHORDHA_BOUNDARY_METADATA,
    };
  }

  const distanceToBoundaryKm = distanceToPolygonBoundaryKm(
    KHORDHA_POLYGON_COORDINATES,
    lon,
    lat
  );
  if (distanceToBoundaryKm < nearBoundaryThresholdKm) {
    return {
      valid: true,
      blocked: false,
      status: "near_boundary",
      reason: "near_boundary",
      message: `GPS coordinates are inside Khordha district but within ${nearBoundaryThresholdKm} km of the district boundary. Verify the district and plot boundary manually before relying on location claims.`,
      distanceToBoundaryKm,
      bounds: KHORDHA_BOUNDS,
      source: KHORDHA_BOUNDARY_METADATA,
    };
  }

  return {
    valid: true,
    blocked: false,
    status: "inside",
    reason: "inside",
    message: "GPS coordinates are inside the supported Khordha district boundary.",
    distanceToBoundaryKm,
    bounds: KHORDHA_BOUNDS,
    source: KHORDHA_BOUNDARY_METADATA,
  };
}

export function assertKhordhaGPS(lat: number, lon: number): KhordhaGPSValidation {
  const validation = validateKhordhaGPS(lat, lon);
  if (validation.blocked) throw new GPSValidationError(validation);
  return validation;
}

export function polygonContainsPoint(
  rings: number[][][],
  lon: number,
  lat: number
): boolean {
  if (rings.length === 0) return false;
  const inOuter = pointInRing(rings[0], lon, lat);
  if (!inOuter) return false;
  return !rings.slice(1).some((hole) => pointInRing(hole, lon, lat));
}

function pointInRing(ring: number[][], lon: number, lat: number): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0];
    const yi = ring[i][1];
    const xj = ring[j][0];
    const yj = ring[j][1];
    const intersects =
      yi > lat !== yj > lat &&
      lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

function distanceToPolygonBoundaryKm(rings: number[][][], lon: number, lat: number): number {
  let min = Number.POSITIVE_INFINITY;
  for (const ring of rings) {
    for (let i = 0; i < ring.length - 1; i += 1) {
      min = Math.min(min, distanceToSegmentKm(lon, lat, ring[i], ring[i + 1]));
    }
  }
  return min;
}

function distanceToSegmentKm(
  lon: number,
  lat: number,
  start: number[],
  end: number[]
): number {
  const latScale = 110.574;
  const lonScale = 111.32 * Math.cos((lat * Math.PI) / 180);
  const sx = (start[0] - lon) * lonScale;
  const sy = (start[1] - lat) * latScale;
  const ex = (end[0] - lon) * lonScale;
  const ey = (end[1] - lat) * latScale;
  const dx = ex - sx;
  const dy = ey - sy;
  const lengthSq = dx * dx + dy * dy;
  if (lengthSq === 0) return Math.hypot(sx, sy);
  const t = Math.max(0, Math.min(1, -(sx * dx + sy * dy) / lengthSq));
  return Math.hypot(sx + t * dx, sy + t * dy);
}

// ─── Village Name Normalization ───────────────────────────────────────────────

/**
 * Normalize Indian village names for comparison.
 * Handles: Odia script, "(CT)" census-town suffix, hyphens, spaces, "The" prefix.
 */
export function normalizeVillageName(name: string | null | undefined): string {
  if (!name) return "";
  return name
    .toLowerCase()
    .replace(/[\s\-_]+/g, " ")
    .replace(/\(ct\)/gi, "") // census town suffix
    .replace(/^the\s+/i, "") // "The" prefix
    .replace(/[^\w\s]/g, "") // punctuation
    .replace(/\s+/g, " ")
    .trim();
}

export function levenshteinDistance(a: string, b: string): number {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  const dp: number[][] = Array.from({ length: a.length + 1 }, (_, i) =>
    Array.from({ length: b.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[a.length][b.length];
}

/**
 * Compare two village names for equality, accounting for spelling variants.
 */
export function villagesMatch(
  a: string | null | undefined,
  b: string | null | undefined
): boolean {
  const na = normalizeVillageName(a);
  const nb = normalizeVillageName(b);
  if (na === nb) return true;
  if (!na || !nb) return false;
  if (Math.abs(na.length - nb.length) <= 2) {
    return levenshteinDistance(na, nb) <= 2;
  }
  return na.includes(nb) || nb.includes(na);
}

// ─── Area Reconciliation ──────────────────────────────────────────────────────

/** Conversion: 1 square km = 247.105381461 acres */
export const SQKM_TO_ACRES = 247.105;

/**
 * Reconcile Bhunaksha area (km²) with Bhulekh area (acres).
 * Returns null if Bhunaksha area is unavailable.
 */
export function reconcileArea(
  bhunakshaSqKm: number | undefined,
  bhulekhAcres: number
): {
  bhunakshaAcres: number;
  discrepancy: number;       // absolute diff in acres
  pct: number;              // relative diff as percentage
  consistent: boolean;      // < 5% relative diff
  tier: "excellent" | "acceptable" | "warning" | "error";
} | null {
  if (bhunakshaSqKm === undefined) return null;
  const bhunakshaAcres = bhunakshaSqKm * SQKM_TO_ACRES;
  const avg = (bhunakshaAcres + bhulekhAcres) / 2;
  const pct = avg > 0 ? (Math.abs(bhunakshaAcres - bhulekhAcres) / avg) * 100 : 0;
  return {
    bhunakshaAcres,
    discrepancy: Math.abs(bhunakshaAcres - bhulekhAcres),
    pct: Math.round(pct * 10) / 10,
    consistent: pct <= 5,
    tier: pct < 1 ? "excellent" : pct <= 5 ? "acceptable" : pct <= 15 ? "warning" : "error",
  };
}

// ─── Odia Name Surnames ────────────────────────────────────────────────────────

/**
 * Common Odia surname → Odia script transliterations.
 * Used for basic owner name matching without an ML transliteration service.
 * Sources: Bhulekh real names observed at GPS 20.272688,85.701271.
 */
export const ODIA_SURNAME_MAP: Record<string, string> = {
  mohapatra: "ମୋହାପାତ୍ର",
  barajena: "ବଡ଼ଯେନା",
  das: "ଦାସ",
  mohanty: "ମହାନ୍ତୀ",
  nayak: "ନାୟକ",
  tripathy: "ତ୍ରିପାଠୀ",
  panda: "ପଣ୍ଡା",
  raut: "ରାଉତ",
  beuria: "ବେଉରିଆ",
  prusty: "ପ୍ରୁଷ୍ଠୀ",
  dash: "ଦାସ",
  behera: "ବେହେରା",
  biswal: "ବିଶ୍ଵାଲ",
  mallick: "ମଲ୍ଲିକ",
  jena: "ଜେନା",
};

/** Check if text contains Odia Unicode characters (U+0B00–U+0B7F). */
export function containsOdiaChars(text: string): boolean {
  return /[\u0B00-\u0B7F]/.test(text);
}

/** Dice coefficient for string similarity (0–1). */
export function diceCoefficient(a: string, b: string): number {
  if (!a || !b) return 0;
  const bigrams = (s: string): Set<string> => {
    const set = new Set<string>();
    for (let i = 0; i < s.length - 1; i++) set.add(s.slice(i, i + 2));
    return set;
  };
  const ba = bigrams(a.toLowerCase());
  const bb = bigrams(b.toLowerCase());
  let intersection = 0;
  for (const x of ba) if (bb.has(x)) intersection++;
  return (2 * intersection) / (ba.size + bb.size);
}

/**
 * Check if a claimed owner name plausibly matches an Odia Bhulekh tenant name.
 * Uses surname lookup + Dice coefficient.
 *
 * @param claimedName  English name as entered by user, e.g. "Krushna Barajena"
 * @param odiaTenantName  Odia script name from Bhulekh, e.g. "କୃଷ୍ଣଚନ୍ଦ୍ର ବଡ଼ଯେନା"
 * @param transliteratedHint  Optional AI transliteration of the Odia name, e.g. "Krushnachandra Barajena"
 */
export function matchOwnerName(
  claimedName: string,
  odiaTenantName: string,
  transliteratedHint?: string
): {
  matches: boolean;
  confidence: "high" | "medium" | "low" | "none";
  score: number;
  method: string;
} {
  const parts = claimedName.toLowerCase().trim().split(/\s+/).filter(Boolean);
  const surname = parts[parts.length - 1]; // last token = Indian surname
  const isSingleToken = parts.length === 1;

  // Method 1: Check if surname is in the Odia map and the name appears transliterated
  const odiaTransliteration = ODIA_SURNAME_MAP[surname];
  if (odiaTransliteration && odiaTenantName.includes(odiaTransliteration)) {
    if (isSingleToken) {
      return { matches: true, confidence: "medium", score: 0.55, method: "odia_surname_map_single_token_ambiguous" };
    }
    return { matches: true, confidence: "high", score: 1.0, method: "odia_surname_map" };
  }

  // Method 2: Dice coefficient on transliterated hint vs claimed name
  if (transliteratedHint) {
    const dice = diceCoefficient(claimedName.toLowerCase(), transliteratedHint.toLowerCase());
    if (dice >= 0.8) return { matches: true, confidence: "high", score: dice, method: "dice_transliterated" };
    if (dice >= 0.6) return { matches: true, confidence: "medium", score: dice, method: "dice_transliterated" };
  }

  // Method 3: Surname Dice on partial transliteration
  if (transliteratedHint) {
    const transParts = transliteratedHint.toLowerCase().split(/\s+/);
    const transSurname = transParts[transParts.length - 1];
    const surnameDice = diceCoefficient(surname, transSurname);
    if (surnameDice >= 0.6) {
      if (isSingleToken) {
        return { matches: true, confidence: "medium", score: Math.min(surnameDice, 0.55), method: "surname_dice_single_token_ambiguous" };
      }
      return { matches: true, confidence: "medium", score: surnameDice, method: "surname_dice" };
    }
  }

  return { matches: false, confidence: "none", score: 0, method: "none" };
}

// ─── Validation Finding ────────────────────────────────────────────────────────

export type ValidationSeverity = "error" | "warning" | "info";
export type ClaimReadiness = "L0" | "L1" | "L2" | "L3" | "L4";
export type ClaimState =
  | "verified"
  | "matched"
  | "discrepancy"
  | "unavailable"
  | "manual_required"
  | "not_covered"
  | "partial"
  | "ambiguous";

export interface ValidationFinding {
  code?: string;
  dimension: "village" | "tahasil" | "district" | "area" | "plotNo" | "ownerName" | "classification" | "gps" | "session";
  severity: ValidationSeverity;
  source: string;
  description: string;
  readiness?: ClaimReadiness;
  claimState?: ClaimState;
  /** Raw values for debugging */
  raw?: Record<string, unknown>;
}

/** Generate manual verification checklist items from validation findings. */
export function findingsToChecklist(findings: ValidationFinding[]): Array<{
  dimension: string;
  action: string;
}> {
  return findings
    .filter((f) => f.severity === "error" || f.severity === "warning")
    .map((f) => ({
      dimension: f.dimension,
      action: `Manual verification required: ${f.description}`,
    }));
}

// ─── DPR-INF-005: Parser Template/Hash Drift Detection ─────────────────────────

export interface TemplateHashOptions {
  /** Stable CSS/id selectors to extract from HTML. If omitted, uses generic selectors. */
  selectors?: Array<{ tag?: string; attr?: string; prefix?: string }>;
  /** Normalize attribute values (e.g., strip numeric indexes like _ctl01_ → _ctlXX_) */
  normalizeIndexes?: boolean;
  /** Strip dynamic content (timestamps, session IDs) from attribute values */
  stripDynamicValues?: boolean;
}

/** Known-good template hashes per source, persisted to DB on first successful parse. */
export interface KnownTemplateHash {
  source: string;
  hash: string;
  selectorSnapshot: string[];
  parserVersion: string;
  recordedAt: string;
  responseSampleHash: string; // SHA-256 of the raw response that produced this hash
}

/**
 * Compute a template hash from HTML content.
 * Extracts stable structural identifiers (IDs, classes, data attributes)
 * and ignores dynamic content.
 *
 * @param html Raw HTML response from a government portal
 * @param options Tuning for selector extraction
 * @returns Hex SHA-256 hash of stable selectors
 */
export function computeTemplateHash(
  html: string,
  options: TemplateHashOptions = {}
): { hash: string; selectors: string[] } {
  const selectors: string[] = [];

  // Extract stable element IDs
  const idMatches = Array.from(html.matchAll(/\sid=["']([^"']+)["']/gi));
  for (const match of idMatches) {
    let id = match[1];
    if (options.normalizeIndexes) {
      id = id.replace(/_ctl\d+_/g, "_ctlXX_").replace(/\d+(?=[^0-9]|$)/g, "N");
    }
    if (options.stripDynamicValues) {
      id = id.replace(/session[^"']*/gi, "").replace(/ts\d+/gi, "").trim();
    }
    if (id) selectors.push(`#${id}`);
  }

  // Extract stable class names (only meaningful structural classes)
  const classMatches = Array.from(html.matchAll(/\sclass=["']([^"']+)["']/gi));
  for (const match of classMatches) {
    const classes = match[1].split(/\s+/);
    for (const cls of classes) {
      // Skip purely numeric or very short classes
      if (cls.length >= 3 && !/^\d+$/.test(cls)) {
        selectors.push(`.${cls}`);
      }
    }
  }

  // Extract data-* attributes for portal-specific markers
  const dataAttrMatches = Array.from(html.matchAll(/\sdata-[\w-]+=["']([^"']+)["']/gi));
  for (const match of dataAttrMatches) {
    let val = match[1];
    if (options.stripDynamicValues) {
      val = val.replace(/\d+/g, "N").replace(/session/gi, "");
    }
    if (val.length > 2) selectors.push(`[${match[0].slice(0, match[0].indexOf("="))}]="${val}"`);
  }

  // Deduplicate and sort
  const unique = [...new Set(selectors)].sort();

  // SHA-256 of sorted selector list
  const hash = sha256TemplateHash(unique.join("\n"));

  return { hash, selectors: unique };
}

function sha256TemplateHash(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

/**
 * Compare an incoming response template hash against known-good hashes.
 * Returns a drift detection result.
 *
 * @param incomingHash Hash from incoming response
 * @param knownHashes Known-good hashes for this source+parser-version pair
 * @param source Source name (e.g. "bhulekh", "ecourts")
 * @param parserVersion Parser version (e.g. "bhulekh-ror-parser-v1")
 */
export interface DriftDetectionResult {
  drifted: boolean;
  severity: "none" | "warning" | "error";
  matchedHash: KnownTemplateHash | null;
  allKnownHashes: string[];
  incomingHash: string;
  /** Description of what changed, if drifted */
  driftDescription?: string;
}

export function detectTemplateDrift(
  incomingHash: string,
  knownHashes: KnownTemplateHash[],
  source: string,
  parserVersion: string
): DriftDetectionResult {
  const hashesForSourceAndVersion = knownHashes.filter(
    (k) => k.source === source && k.parserVersion === parserVersion
  );

  if (hashesForSourceAndVersion.length === 0) {
    // No known hash for this source/version — cannot detect drift, treat as first run
    return {
      drifted: false,
      severity: "none",
      matchedHash: null,
      allKnownHashes: [],
      incomingHash,
    };
  }

  const matched = hashesForSourceAndVersion.find((k) => k.hash === incomingHash);
  if (matched) {
    return {
      drifted: false,
      severity: "none",
      matchedHash: matched,
      allKnownHashes: hashesForSourceAndVersion.map((k) => k.hash),
      incomingHash,
    };
  }

  // Drift detected
  const knownStr = hashesForSourceAndVersion.map((k) => k.hash).join(", ");
  return {
    drifted: true,
    severity: "error",
    matchedHash: null,
    allKnownHashes: hashesForSourceAndVersion.map((k) => k.hash),
    incomingHash,
    driftDescription: `Template hash changed for source "${source}" (parser: ${parserVersion}). Expected one of [${knownStr}], got ${incomingHash}. Government portal HTML structure may have changed. Parser may need update.`,
  };
}

/**
 * Build a ValidationFinding from a drift detection result.
 * Use this in orchestrator cross-source validation.
 */
export function buildDriftFinding(
  drift: DriftDetectionResult,
  sourceName: "bhulekh" | "ecourts" | "high-court" | "drt" | "nominatim" | "bhunaksha" | "rccms" | "igr-ec" | "cersai"
): ValidationFinding | null {
  if (!drift.drifted || !drift.driftDescription) return null;

  return {
    code: "DPR-INF-005",
    dimension: "session",
    severity: drift.severity === "none" ? "info" : drift.severity,
    source: sourceName,
    description: drift.driftDescription,
    readiness: "L1",
    claimState: "partial",
    raw: {
      incomingHash: drift.incomingHash,
      knownHashes: drift.allKnownHashes,
      parserVersion: drift.matchedHash?.parserVersion,
    },
  };
}
