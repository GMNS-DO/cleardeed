/**
 * IGR BMV (Benchmark Valuation) Fetcher for ClearDeed
 *
 * Calls the live IGR Odisha public endpoint `ViewFeeValue.aspx/GetMRVal` to
 * retrieve the official circle rate (minimum property value for stamp duty)
 * for a (district, SRO, mouza, kisam) tuple.
 *
 * The endpoint is public and does not require login (per the V5b plan risk
 * register). Caches each successful response for 7 days in an in-memory
 * cache keyed on the request tuple. The renderer treats this as a strict
 * superset of `circle-rate`: if BMV is live we use BMV; if BMV is down we
 * fall back to the existing `circle-rate` JSON seed.
 *
 * Endpoint shape (observed from the live portal):
 *   POST https://igrodisha.gov.in/ViewFeeValue.aspx/GetMRVal
 *   Content-Type: application/json
 *   Body: { "distCd": "21", "sroCd": "10", "mouzaCd": "...", "kisam": "Bari" }
 *   Response: { "d": "..." }  (ASP.NET WebForms ScriptMethod JSON envelope)
 *
 * Sprint V5b live smoke plan:
 *   1. Run igr-bmv against Mendhasala (P001) and verify the response is
 *      within 5% of the existing circle-rate seed.
 *   2. Capture the response shape and add typed parsing here.
 *
 * If the live endpoint returns a 5xx, the fetcher degrades to `source_down`.
 * The pipeline (and the renderer) must treat this as a fallback signal —
 * not as a buyer-visible error.
 */

import { createHash } from "node:crypto";
import type { IgrBmvResult, BMVRow } from "./contract.js";

const IGR_BMV_URL = "https://igrodisha.gov.in/ViewFeeValue.aspx/GetMRVal";
const PARSER_VERSION = "igr-bmv-v1";
const HTTP_TIMEOUT_MS = 10_000;
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

// Khordha district code is 21 (IGR Odisha). SRO codes mirror the igr-sro
// cache: 10 = Bhubaneswar, 11 = Jatni, 12 = Balipatna, 13 = Banapur.
const DISTRICT_CODE = "21";
const SRO_CODE_MAP: Record<string, string> = {
  Bhubaneswar: "10",
  Jatni: "11",
  Balipatna: "12",
  Banapur: "13",
};

export interface IgrBmvInput {
  district?: string;
  sro: string;
  village: string;
  /** Land classification (Bari / Abadi / Bagayat / Agricultural). */
  kisam?: string;
  /** Mouza code if known; otherwise looked up by village name. */
  mouzaCd?: string;
  /** Area in acres — needed to compute scaled rate; defaults to 0 (rate-only). */
  area?: number;
  /** Unit for area (used to compute sqft-scale rate); defaults to "acre". */
  unit?: "acre" | "decimal" | "sqft";
  /** Skip the live call and return source_down. Used for tests. */
  skipLive?: boolean;
}

interface CacheEntry {
  fetchedAt: string;
  rows: BMVRow[];
}

const cache = new Map<string, CacheEntry>();

/** Reset the cache (used by tests). */
export function _resetCache(): void {
  cache.clear();
}

function cacheKey(input: IgrBmvInput): string {
  return JSON.stringify({
    d: input.district ?? "Khordha",
    s: input.sro,
    v: input.village.toLowerCase().trim(),
    k: input.kisam ?? "Bari",
    a: input.area ?? 0,
  });
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function emptyResult(
  status: "failed" | "partial" | "not_covered",
  reason: string,
  fetchedAt: string,
  error?: string
): IgrBmvResult {
  return {
    source: "igr-bmv",
    status,
    statusReason: reason,
    verification: "manual_required",
    fetchedAt,
    parserVersion: PARSER_VERSION,
    data: { rows: [] },
    warnings: [
      {
        code: "IGR_BMV_UNAVAILABLE",
        message: error ?? "IGR BMV endpoint not reachable. Falling back to circle-rate JSON seed.",
      },
    ],
    ...(error ? { error } : {}),
  };
}

/**
 * Parse the ASP.NET ScriptMethod JSON envelope `{ "d": "<stringified-json>" }`
 * or a plain object payload. The live endpoint may return either depending
 * on the Content-Type negotiation.
 */
function parseBmvResponse(rawText: string): BMVRow[] {
  let payload: unknown;
  try {
    payload = JSON.parse(rawText);
  } catch {
    return [];
  }
  // ASP.NET WebForms ScriptMethod wraps the payload in `d`.
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
  const rows: BMVRow[] = [];
  for (const item of payload) {
    if (!item || typeof item !== "object") continue;
    const r = item as Record<string, unknown>;
    const mouza = String(r.MouzaName ?? r.mouza ?? r.MOUZA ?? "").trim();
    const sro = String(r.SRO ?? r.sro ?? r.SROName ?? "").trim();
    const tehsil = String(r.Tahsil ?? r.tehsil ?? "").trim();
    const kisam = String(r.Kisam ?? r.kisam ?? "").trim();
    const ratePerSqft = Number(r.PerSqFt ?? r.ratePerSqft ?? r.SQFT_RATE ?? 0);
    const ratePerAcre = Number(r.PerAcre ?? r.ratePerAcre ?? r.ACRE_RATE ?? 0);
    const ratePerDecimal = Number(r.PerDecimal ?? r.ratePerDecimal ?? r.DECIMAL_RATE ?? 0);
    if (!mouza || !sro) continue;
    rows.push({
      mouza,
      tehsil: tehsil || inputTehsilForSro(sro),
      sro,
      kisam: kisam || "Bari",
      ratePerAcre: Number.isFinite(ratePerAcre) ? ratePerAcre : 0,
      ratePerSqft: Number.isFinite(ratePerSqft) ? ratePerSqft : 0,
      ratePerDecimal: Number.isFinite(ratePerDecimal) ? ratePerDecimal : 0,
      sourceUrl: IGR_BMV_URL,
      lastUpdated: new Date().toISOString().split("T")[0],
    });
  }
  return rows;
}

function inputTehsilForSro(sro: string): string {
  return sro;
}

/**
 * POST to the live IGR BMV endpoint. Returns the response text or null on
 * any non-200 / timeout / network error.
 */
async function fetchLive(input: IgrBmvInput): Promise<string | null> {
  const sroCode = SRO_CODE_MAP[input.sro] ?? input.sro;
  const body = JSON.stringify({
    distCd: DISTRICT_CODE,
    sroCd: sroCode,
    mouzaCd: input.mouzaCd ?? input.village,
    kisam: input.kisam ?? "Bari",
  });
  try {
    const res = await globalThis.fetch(IGR_BMV_URL, {
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
 * Fetch the live BMV rate for a (district, sro, village, kisam) tuple.
 * Returns an IgrBmvResult; on any failure returns `source_down` with empty
 * rows so the pipeline can fall back to the circle-rate JSON seed.
 */
export async function igrBmvFetch(input: IgrBmvInput): Promise<IgrBmvResult> {
  const fetchedAt = new Date().toISOString();

  if (!input.sro || !input.village) {
    return {
      source: "igr-bmv",
      status: "failed",
      statusReason: "missing_input",
      verification: "manual_required",
      fetchedAt,
      parserVersion: PARSER_VERSION,
      data: { rows: [] },
      warnings: [
        {
          code: "INVALID_INPUT",
          message: "sro and village are required",
        },
      ],
      error: "missing sro or village",
    };
  }

  if (input.skipLive) {
    return emptyResult(
      "not_covered",
      "skipLive_set_in_test",
      fetchedAt,
      "skipLive=true: returning source_down for tests"
    );
  }

  // Cache check
  const key = cacheKey(input);
  const cached = cache.get(key);
  if (cached && Date.now() - new Date(cached.fetchedAt).getTime() < CACHE_TTL_MS) {
    return {
      source: "igr-bmv",
      status: "success",
      statusReason: "cache_hit",
      verification: "verified",
      fetchedAt: cached.fetchedAt,
      attempts: 0,
      inputsTried: [
        { label: "igr_bmv_live_post", input: { ...input } },
      ],
      parserVersion: PARSER_VERSION,
      data: { rows: cached.rows },
      warnings: [
        {
          code: "CACHE_HIT",
          message: "Served from in-memory 7-day cache. Re-fetch after TTL.",
        },
      ],
    };
  }

  const rawText = await fetchLive(input);
  if (rawText === null) {
    return emptyResult(
      "not_covered",
      "live_endpoint_unreachable",
      fetchedAt,
      `POST ${IGR_BMV_URL} returned non-200, timeout, or network error`
    );
  }

  const rows = parseBmvResponse(rawText);
  if (rows.length === 0) {
    return emptyResult(
      "partial",
      "live_response_unparseable",
      fetchedAt,
      "Live endpoint returned a 200 but no parseable rows. Verify portal contract."
    );
  }

  cache.set(key, { fetchedAt, rows });

  return {
    source: "igr-bmv",
    status: "success",
    statusReason: "live_endpoint_ok",
    verification: "verified",
    fetchedAt,
    attempts: 1,
    inputsTried: [
      { label: "igr_bmv_live_post", input: { ...input } },
    ],
    rawArtifactHash: sha256(rawText),
    parserVersion: PARSER_VERSION,
    data: { rows },
    warnings: [
      {
        code: "LIVE_FETCH_OK",
        message: `Live IGR BMV endpoint returned ${rows.length} row(s) for ${input.village} / ${input.kisam ?? "Bari"}.`,
      },
    ],
  };
}

/**
 * Health check — returns true if the live endpoint is reachable. The check
 * itself does not cache; a `not_covered` response is the signal.
 */
export async function healthCheck(): Promise<boolean> {
  try {
    const res = await globalThis.fetch(IGR_BMV_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ distCd: DISTRICT_CODE, sroCd: "10", mouzaCd: "PING", kisam: "PING" }),
      signal: AbortSignal.timeout(5_000),
    });
    return res.ok;
  } catch {
    return false;
  }
}
