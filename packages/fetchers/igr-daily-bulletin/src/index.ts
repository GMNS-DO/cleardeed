/**
 * IGR Daily Bulletin Fetcher for ClearDeed
 *
 * Calls the live IGR Odisha public endpoint `ORServiceNew.aspx/GetDataFromDB`
 * to retrieve registration activity (deed counts, consideration totals) for
 * a date range. Used in the buyer's report as a velocity signal — "X deeds
 * registered in Khordha in the last 7 days" gives a buyer a market-pulse
 * sense of how active the area is.
 *
 * Endpoint shape (per the V5b plan; verified against the live portal in the
 * live smoke test):
 *   POST https://igrodisha.gov.in/ORServiceNew.aspx/GetDataFromDB
 *   Content-Type: application/json
 *   Body: { "fromDate": "2026-06-08", "toDate": "2026-06-15", "distCd": "21" }
 *   Response: { "d": "<json-string>" }  (ASP.NET ScriptMethod envelope)
 *
 * Caches each successful response for 24h in an in-memory map keyed on the
 * (district, dateRange) tuple — the bulletin updates daily and intra-day
 * fetches would just hammer the portal.
 */

import { createHash } from "node:crypto";
import type { IgrDailyBulletinResult, IgrDailyBulletinData, DailyBulletinDay } from "./contract.js";

const IGR_BULLETIN_URL = "https://igrodisha.gov.in/ORServiceNew.aspx/GetDataFromDB";
const PARSER_VERSION = "igr-daily-bulletin-v1";
const HTTP_TIMEOUT_MS = 10_000;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

const DISTRICT_CODE = "21";

export interface IgrDailyBulletinInput {
  /** Date range start (YYYY-MM-DD). Defaults to 7 days ago. */
  dateFrom?: string;
  /** Date range end (YYYY-MM-DD). Defaults to today. */
  dateTo?: string;
  /** District name (default Khordha). */
  district?: string;
  /** Skip the live call and return source_down. Used for tests. */
  skipLive?: boolean;
}

interface CacheEntry {
  fetchedAt: string;
  data: IgrDailyBulletinData;
}

const cache = new Map<string, CacheEntry>();

export function _resetCache(): void {
  cache.clear();
}

function cacheKey(input: IgrDailyBulletinInput): string {
  return JSON.stringify({
    f: input.dateFrom ?? "default",
    t: input.dateTo ?? "default",
    d: input.district ?? "Khordha",
  });
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function defaultDateRange(): { from: string; to: string } {
  const now = new Date();
  const sevenAgo = new Date(now);
  sevenAgo.setDate(sevenAgo.getDate() - 7);
  return {
    from: sevenAgo.toISOString().split("T")[0],
    to: now.toISOString().split("T")[0],
  };
}

/**
 * Parse the ASP.NET ScriptMethod envelope and convert the response into
 * DailyBulletinDay[] rows. The live response shape is observed to be an
 * array of {RegDate, SRO, DeedType, Count, Consideration} objects, with
 * totals at the bottom of the page (filtered out by being summary-only).
 */
function parseBulletinResponse(rawText: string): DailyBulletinDay[] {
  let payload: unknown;
  try {
    payload = JSON.parse(rawText);
  } catch {
    return [];
  }
  if (payload && typeof payload === "object" && "d" in payload) {
    const d = (payload as { d: unknown }).d;
    if (typeof d === "string") {
      try {
        payload = JSON.parse(d);
      } catch {
        return [];
      }
    } else {
      payload = d;
    }
  }
  if (!Array.isArray(payload)) return [];
  const days: DailyBulletinDay[] = [];
  for (const item of payload) {
    if (!item || typeof item !== "object") continue;
    const r = item as Record<string, unknown>;
    const date = String(r.RegDate ?? r.regDate ?? r.Date ?? r.date ?? "").trim();
    const sro = String(r.SRO ?? r.sro ?? "").trim();
    const deedType = String(r.DeedType ?? r.deedType ?? "").trim();
    const count = Number(r.Count ?? r.count ?? r.DeedCount ?? 0);
    const consideration = Number(r.Consideration ?? r.consideration ?? 0);
    if (!date) continue;
    if (!Number.isFinite(count) || count < 0) continue;
    days.push({
      date,
      district: String(r.District ?? r.district ?? "Khordha").trim(),
      sro: sro || undefined,
      deedType: deedType || undefined,
      count: Math.round(count),
      considerationTotal: Number.isFinite(consideration) ? Math.round(consideration) : 0,
    });
  }
  return days;
}

async function fetchLive(input: IgrDailyBulletinInput): Promise<string | null> {
  const range = defaultDateRange();
  const body = JSON.stringify({
    fromDate: input.dateFrom ?? range.from,
    toDate: input.dateTo ?? range.to,
    distCd: DISTRICT_CODE,
  });
  try {
    const res = await globalThis.fetch(IGR_BULLETIN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        Accept: "application/json",
        "User-Agent": "Mozilla/5.0 ClearDeed/1.0",
      },
      body,
      signal: AbortSignal.timeout(HTTP_TIMEOUT_MS),
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

/**
 * Fetch the IGR daily bulletin for the given (district, date range) tuple.
 * Caches for 24h on success; returns `source_down` on any network error.
 */
export async function igrDailyBulletinFetch(
  input: IgrDailyBulletinInput = {}
): Promise<IgrDailyBulletinResult> {
  const fetchedAt = new Date().toISOString();
  const range = {
    from: input.dateFrom ?? defaultDateRange().from,
    to: input.dateTo ?? defaultDateRange().to,
  };
  const district = input.district ?? "Khordha";

  if (input.skipLive) {
    return {
      source: "igr-daily-bulletin",
      status: "not_covered",
      statusReason: "skipLive_set_in_test",
      verification: "manual_required",
      fetchedAt,
      parserVersion: PARSER_VERSION,
      warnings: [
        {
          code: "IGR_DAILY_BULLETIN_UNAVAILABLE",
          message: "skipLive=true: returning source_down for tests",
        },
      ],
    };
  }

  // Cache check
  const key = cacheKey(input);
  const cached = cache.get(key);
  if (cached && Date.now() - new Date(cached.fetchedAt).getTime() < CACHE_TTL_MS) {
    return {
      source: "igr-daily-bulletin",
      status: "success",
      statusReason: "cache_hit",
      verification: "verified",
      fetchedAt: cached.fetchedAt,
      attempts: 0,
      inputsTried: [
        { label: "igr_daily_bulletin_live_post", input: { ...input } },
      ],
      parserVersion: PARSER_VERSION,
      data: cached.data,
      warnings: [
        {
          code: "CACHE_HIT",
          message: "Served from in-memory 24h cache. Re-fetch after TTL.",
        },
      ],
    };
  }

  const rawText = await fetchLive(input);
  if (rawText === null) {
    return {
      source: "igr-daily-bulletin",
      status: "not_covered",
      statusReason: "live_endpoint_unreachable",
      verification: "manual_required",
      fetchedAt,
      attempts: 1,
      inputsTried: [
        { label: "igr_daily_bulletin_live_post", input: { ...input } },
      ],
      parserVersion: PARSER_VERSION,
      warnings: [
        {
          code: "IGR_DAILY_BULLETIN_UNAVAILABLE",
          message: `POST ${IGR_BULLETIN_URL} returned non-200, timeout, or network error. Velocity signal not available.`,
        },
      ],
    };
  }

  const days = parseBulletinResponse(rawText);
  if (days.length === 0) {
    return {
      source: "igr-daily-bulletin",
      status: "partial",
      statusReason: "live_response_unparseable",
      verification: "manual_required",
      fetchedAt,
      attempts: 1,
      inputsTried: [
        { label: "igr_daily_bulletin_live_post", input: { ...input } },
      ],
      parserVersion: PARSER_VERSION,
      warnings: [
        {
          code: "LIVE_RESPONSE_EMPTY",
          message: "Live endpoint returned a 200 but no parseable rows.",
        },
      ],
    };
  }

  // Summarize
  const totalDeeds = days.reduce((sum, d) => sum + d.count, 0);
  const totalConsideration = days.reduce((sum, d) => sum + d.considerationTotal, 0);
  const dateSpan = Math.max(
    1,
    Math.ceil(
      (new Date(range.to).getTime() - new Date(range.from).getTime()) /
        (24 * 60 * 60 * 1000)
    )
  );
  const data: IgrDailyBulletinData = {
    days,
    dateRange: range,
    district,
    summary: {
      totalDeeds,
      totalConsideration,
      avgDeedsPerDay: Math.round((totalDeeds / dateSpan) * 100) / 100,
    },
  };

  cache.set(key, { fetchedAt, data });

  return {
    source: "igr-daily-bulletin",
    status: "success",
    statusReason: "live_endpoint_ok",
    verification: "verified",
    fetchedAt,
    attempts: 1,
    inputsTried: [
      { label: "igr_daily_bulletin_live_post", input: { ...input } },
    ],
    rawArtifactHash: sha256(rawText),
    parserVersion: PARSER_VERSION,
    data,
    warnings: [
      {
        code: "LIVE_FETCH_OK",
        message: `Live IGR daily bulletin returned ${days.length} rows for ${range.from}..${range.to}.`,
      },
    ],
  };
}

export async function healthCheck(): Promise<boolean> {
  try {
    const res = await globalThis.fetch(IGR_BULLETIN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fromDate: "2026-01-01", toDate: "2026-01-01", distCd: DISTRICT_CODE }),
      signal: AbortSignal.timeout(5_000),
    });
    return res.ok;
  } catch {
    return false;
  }
}
