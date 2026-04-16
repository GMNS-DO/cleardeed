import { NominatimResult, GPSCoordinates } from "@cleardeed/schema";
import { z } from "zod";

const NOMINATIM_BASE = "https://nominatim.openstreetmap.org";
const USER_AGENT = "ClearDeed/1.0 (property due-diligence; contact@cleardeed.in)";
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

interface CacheEntry {
  data: Awaited<ReturnType<typeof fetchFromNominatim>>;
  timestamp: number;
}

const memoryCache = new Map<string, CacheEntry>();

function cacheKey(lat: number, lon: number): string {
  return `${lat.toFixed(6)},${lon.toFixed(6)}`;
}

function isFresh(entry: CacheEntry): boolean {
  return Date.now() - entry.timestamp < CACHE_TTL_MS;
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

export async function fetch(input: {
  gps: GPSCoordinates;
}): Promise<z.infer<typeof NominatimResult>> {
  const key = cacheKey(input.gps.lat, input.gps.lon);

  const cached = memoryCache.get(key);
  if (cached && isFresh(cached)) {
    return buildResult(cached.data, "success");
  }

  const raw = await fetchFromNominatim(input.gps.lat, input.gps.lon);
  memoryCache.set(key, { data: raw, timestamp: Date.now() });
  return buildResult(raw, "success");
}

export function buildResult(
  raw: { display_name: string; address: Record<string, string> },
  status: "success" | "failed" | "partial"
): z.infer<typeof NominatimResult> {
  const addr = raw.address;

  const village =
    addr.village || addr.suburb || addr.locality || addr.town || addr.municipality || null;
  const tahasil = addr.municipality || addr.taluka || addr.taluk || null;
  const district = addr.county || addr.state_district || null;
  const state = addr.state || null;
  const postcode = addr.postcode || null;
  const category = addr.land_class || null;

  return {
    source: "nominatim",
    status,
    verification: village ? "verified" : "manual_required",
    fetchedAt: new Date().toISOString(),
    data: {
      displayName: raw.display_name,
      village,
      tahasil,
      district,
      state,
      postcode,
      category,
    },
  };
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