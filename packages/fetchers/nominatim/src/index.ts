import { NominatimResult, GPSCoordinates, runWithRetry } from "@cleardeed/schema";
import { createHash } from "node:crypto";
import { z } from "zod";

type GPS = z.infer<typeof GPSCoordinates>;

const NOMINATIM_BASE = "https://nominatim.openstreetmap.org";
const USER_AGENT = "ClearDeed/1.0 (property due-diligence; contact@cleardeed.in)";
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const PARSER_VERSION = "nominatim-parser-v1";
const MAX_ATTEMPTS = 2;

interface CacheEntry {
  data: Awaited<ReturnType<typeof fetchFromNominatim>>;
  timestamp: number;
  sourceFetchedAt: string;
}

const memoryCache = new Map<string, CacheEntry>();

function cacheKey(lat: number, lon: number): string {
  return `${lat.toFixed(6)},${lon.toFixed(6)}`;
}

function isFresh(entry: CacheEntry): boolean {
  return Date.now() - entry.timestamp < CACHE_TTL_MS;
}

function sha256(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

async function fetchFromNominatim(lat: number, lon: number): Promise<{
  display_name: string;
  address: Record<string, string>;
}> {
  const url = `${NOMINATIM_BASE}/reverse?format=json&lat=${lat}&lon=${lon}&zoom=18&addressdetails=1`;
  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT },
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`Nominatim ${res.status} for ${lat},${lon}`);
  return res.json() as Promise<{ display_name: string; address: Record<string, string> }>;
}

export async function nominatimFetch(input: {
  gps: GPS;
}): Promise<z.infer<typeof NominatimResult>> {
  const key = cacheKey(input.gps.lat, input.gps.lon);
  const inputsTried = [{ label: "reverse_geocode", input: { gps: input.gps } }];

  const cached = memoryCache.get(key);
  if (cached && isFresh(cached)) {
    return buildResult(cached.data, "success", {
      attempts: 0,
      inputsTried,
      statusReason: "cache_hit",
      sourceFetchedAt: cached.sourceFetchedAt,
      cacheServedAt: new Date().toISOString(),
    });
  }

  const retryResult = await runWithRetry(
    () => fetchFromNominatim(input.gps.lat, input.gps.lon),
    {
      maxAttempts: MAX_ATTEMPTS,
      baseDelayMs: 250,
      shouldRetry: (error) => isRetryableError(error),
    }
  );
  const raw = retryResult.value;
  const sourceFetchedAt = new Date().toISOString();
  memoryCache.set(key, { data: raw, timestamp: Date.now(), sourceFetchedAt });
  return buildResult(raw, "success", {
    attempts: retryResult.attempts.length,
    inputsTried,
    retryAttempts: retryResult.attempts,
    sourceFetchedAt,
  });
}

export function buildResult(
  raw: { display_name: string; address: Record<string, string> },
  status: "success" | "failed" | "partial",
  provenance: {
    statusReason?: string;
    attempts?: number;
    inputsTried?: Array<{ label?: string; input: Record<string, unknown> }>;
    retryAttempts?: unknown[];
    sourceFetchedAt?: string;
    cacheServedAt?: string;
  } = {}
): z.infer<typeof NominatimResult> {
  const addr = raw.address;

  const village =
    addr.village || addr.suburb || addr.locality || addr.town || null;
  const tahasil = addr.taluka || addr.taluk || addr.municipality || null;
  const district = addr.county || addr.state_district || null;
  const state = addr.state || null;
  const postcode = addr.postcode || null;
  const category = addr.land_class || null;
  const validators = buildFieldValidators({ village, district, state, postcode, countryCode: addr.country_code, retryAttempts: provenance.retryAttempts });
  const locationVerified = Boolean(
    village &&
    state &&
    /^odisha$/i.test(state) &&
    district &&
    /khordha|khurda/i.test(district)
  );
  const sourceFetchedAt = provenance.sourceFetchedAt ?? new Date().toISOString();

  return {
    source: "nominatim",
    status,
    statusReason:
      provenance.statusReason ?? (locationVerified ? "address_resolved" : village ? "address_resolved_with_warnings" : "address_incomplete"),
    verification: locationVerified ? "verified" : "manual_required",
    fetchedAt: sourceFetchedAt,
    attempts: provenance.attempts,
    inputsTried: provenance.inputsTried,
    rawArtifactHash: sha256(raw),
    parserVersion: PARSER_VERSION,
    validators,
    data: {
      displayName: raw.display_name,
      village: village ?? undefined,
      tahasil: tahasil ?? undefined,
      district: district ?? undefined,
      state: state ?? undefined,
      postcode: postcode ?? undefined,
      category: category ?? undefined,
      sourceFetchedAt,
      cacheServedAt: provenance.cacheServedAt,
    },
  };
}

function buildFieldValidators(input: {
  village: string | null;
  district: string | null;
  state: string | null;
  postcode: string | null;
  countryCode?: string;
  retryAttempts?: unknown[];
}): z.infer<typeof NominatimResult>["validators"] {
  const validators: NonNullable<z.infer<typeof NominatimResult>["validators"]> = [
    {
      name: "state_is_odisha",
      status: input.state && /^odisha$/i.test(input.state) ? "passed" : input.state ? "failed" : "warning",
      message: input.state ? `Nominatim state=${input.state}` : "Nominatim did not return a state.",
    },
    {
      name: "district_is_khordha",
      status: input.district && /khordha|khurda/i.test(input.district) ? "passed" : input.district ? "failed" : "warning",
      message: input.district ? `Nominatim district=${input.district}` : "Nominatim did not return a district.",
    },
    {
      name: "village_present",
      status: input.village ? "passed" : "warning",
      message: input.village ? `Nominatim village=${input.village}` : "Nominatim did not return a village/locality.",
    },
    {
      name: "postcode_present",
      status: input.postcode ? "passed" : "warning",
      message: input.postcode ? `Nominatim postcode=${input.postcode}` : "Nominatim did not return a postcode.",
    },
  ];

  if (input.countryCode) {
    validators.push({
      name: "country_is_india",
      status: input.countryCode.toLowerCase() === "in" ? "passed" : "failed",
      message: `Nominatim country_code=${input.countryCode}`,
    });
  }

  if (input.retryAttempts) {
    validators.push({
      name: "retry_attempts_recorded",
      status: "passed",
      raw: { attempts: input.retryAttempts },
    });
  }

  return validators;
}

function isRetryableError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /timeout|network|fetch failed|socket|ECONNRESET|ETIMEDOUT|Nominatim 5\d\d/i.test(message);
}

export async function healthCheck(): Promise<boolean> {
  try {
    const testUrl = `${NOMINATIM_BASE}/reverse?format=json&lat=20.272688&lon=85.701271&zoom=18&addressdetails=1`;
    const res = await fetch(testUrl, {
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(8_000),
    });
    return res.ok;
  } catch {
    return false;
  }
}
