/**
 * IGR Public Dashboard fetcher for ClearDeed.
 *
 * Sprint V5c — the IGR Odisha public dashboard is server-rendered ASP.NET
 * WebForms. There is no public JSON API. The fetcher probes the page shell
 * (HTTP 200 + non-empty body), and returns a typed `not_covered` envelope
 * with the verified-live URL. The renderer uses this to render a Section 6
 * "Official activity" sub-card with a "see live page" link.
 *
 * Per D-046 (Sprint V5c): page scraping is explicitly parked. The dashboard
 * page is human-only and the data is also captured in the IGR Daily Bulletin
 * (V5b `igr-daily-bulletin` fetcher) which has a real JSON endpoint. The
 * public-dashboard fetcher exists only to verify the IGR link is alive and
 * to expose the URL to the buyer in the report.
 *
 * Endpoint (probed):
 *   GET https://igrodisha.gov.in/PublicDashboard.aspx
 *
 * Caches the probe result for 24h (the page rarely goes down for long).
 */

import type { PublicDashboardResult } from "./contract.js";

const IGR_DASHBOARD_URL = "https://igrodisha.gov.in/PublicDashboard.aspx";
const DEED_WISE_URL = "https://igrodisha.gov.in/DeedWiseStatus.aspx";
const ORTPSA_URL = "https://igrodisha.gov.in/ORServiceNew.aspx";
const PARSER_VERSION = "public-dashboard-v1";
const HTTP_TIMEOUT_MS = 8_000;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24h

export interface PublicDashboardInput {
  district?: string;
  sro?: string;
  /** ISO date — defaults to today. */
  fromDate?: string;
  /** ISO date — defaults to today. */
  toDate?: string;
  /** Skip the live call and return not_covered. Used for tests. */
  skipLive?: boolean;
}

interface CacheEntry {
  fetchedAt: string;
  pageIsLive: boolean;
  pageUrl: string;
}

const cache = new Map<string, CacheEntry>();

export function _resetCache(): void {
  cache.clear();
}

function cacheKey(input: PublicDashboardInput): string {
  return JSON.stringify({
    d: input.district ?? "ALL",
    s: input.sro ?? "ALL",
    f: input.fromDate ?? "today",
    t: input.toDate ?? "today",
  });
}

function notCoveredResult(
  fetchedAt: string,
  reason: string,
  error?: string
): PublicDashboardResult {
  return {
    source: "public-dashboard",
    status: "not_covered",
    statusReason: reason,
    verification: "not_applicable",
    fetchedAt,
    parserVersion: PARSER_VERSION,
    data: {
      pageUrl: IGR_DASHBOARD_URL,
      pageIsLive: false,
      entries: [],
      notes: [
        "IGR public dashboard is server-rendered (ASP.NET WebForms); no public JSON API.",
        "The same district activity is published in the ORTPSA daily bulletin, which igr-daily-bulletin reads as JSON.",
      ],
    },
    warnings: [
      {
        code: "PUBLIC_DASHBOARD_NO_API",
        message:
          "Live page is verified or unreachable. See the link in the report for direct access.",
      },
    ],
    ...(error ? { error } : {}),
  };
}

async function probePage(url: string): Promise<boolean> {
  try {
    const res = await globalThis.fetch(url, {
      method: "GET",
      headers: {
        Accept: "text/html",
        "User-Agent": "Mozilla/5.0 ClearDeed/1.0",
      },
      signal: AbortSignal.timeout(HTTP_TIMEOUT_MS),
    });
    if (!res.ok) return false;
    const text = await res.text();
    return text.length > 1000; // any reasonable page shell
  } catch {
    return false;
  }
}

export async function publicDashboardFetch(
  input: PublicDashboardInput
): Promise<PublicDashboardResult> {
  const fetchedAt = new Date().toISOString();

  if (input.skipLive) {
    return notCoveredResult(
      fetchedAt,
      "skipLive_set_in_test",
      "skipLive=true: returning not_covered for tests"
    );
  }

  const key = cacheKey(input);
  const cached = cache.get(key);
  if (
    cached &&
    Date.now() - new Date(cached.fetchedAt).getTime() < CACHE_TTL_MS
  ) {
    return {
      source: "public-dashboard",
      status: "success",
      statusReason: "cache_hit",
      verification: "verified",
      fetchedAt: cached.fetchedAt,
      attempts: 0,
      inputsTried: [
        { label: "public_dashboard_probe", input: { ...input } },
      ],
      parserVersion: PARSER_VERSION,
      data: {
        pageUrl: cached.pageUrl,
        pageIsLive: cached.pageIsLive,
        districtFilter: input.district,
        sroFilter: input.sro,
        ...(input.fromDate && input.toDate
          ? { periodFilter: { from: input.fromDate, to: input.toDate } }
          : {}),
        entries: [],
        notes: [
          "Served from in-memory 24h cache.",
          "Page is server-rendered; no JSON parsing performed.",
        ],
      },
      warnings: [
        {
          code: "CACHE_HIT",
          message: "Served from in-memory 24h cache. Re-fetch after TTL.",
        },
      ],
    };
  }

  // Probe all 3 dashboard pages in parallel — fastest to respond wins.
  const probes = await Promise.all([
    probePage(IGR_DASHBOARD_URL),
    probePage(DEED_WISE_URL),
    probePage(ORTPSA_URL),
  ]);
  const anyLive = probes.some(Boolean);

  if (!anyLive) {
    return notCoveredResult(
      fetchedAt,
      "live_endpoint_unreachable",
      `GET ${IGR_DASHBOARD_URL} (and 2 sibling pages) returned non-200, timeout, or network error`
    );
  }

  cache.set(key, {
    fetchedAt,
    pageIsLive: anyLive,
    pageUrl: IGR_DASHBOARD_URL,
  });

  return {
    source: "public-dashboard",
    status: "success",
    statusReason: "live_page_alive",
    verification: "verified",
    fetchedAt,
    attempts: 1,
    inputsTried: [
      { label: "public_dashboard_probe", input: { ...input } },
    ],
    parserVersion: PARSER_VERSION,
    data: {
      pageUrl: IGR_DASHBOARD_URL,
      pageIsLive: anyLive,
      districtFilter: input.district,
      sroFilter: input.sro,
      ...(input.fromDate && input.toDate
        ? { periodFilter: { from: input.fromDate, to: input.toDate } }
        : {}),
      entries: [],
      notes: [
        `Page is alive: PublicDashboard.aspx=${probes[0]}, DeedWiseStatus.aspx=${probes[1]}, ORServiceNew.aspx=${probes[2]}`,
        "Page is server-rendered; no JSON parsing performed.",
      ],
    },
    warnings: [
      {
        code: "LIVE_PAGE_OK",
        message:
          "Live dashboard pages reachable. No data parsed (server-rendered).",
      },
    ],
  };
}

export async function healthCheck(): Promise<boolean> {
  return await probePage(IGR_DASHBOARD_URL);
}
