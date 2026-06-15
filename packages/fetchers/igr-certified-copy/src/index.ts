/**
 * IGR Certified Copy (Phase 1: index-card only) fetcher for ClearDeed.
 *
 * Sprint V5c — the certified-copy form on igrodisha.gov.in requires login +
 * captcha. Per D-037/D-046, Phase 1 ships with typed-degradation only:
 *   1. Probe the page (HTTP 200 + page shell).
 *   2. Return a typed `not_covered` envelope with the verified-live URL +
 *      a manual-instructions fallback.
 *   3. The renderer uses this to render a Section 2 sub-card "Previous sale
 *      deed (open index entry)" with the §57 transparency note.
 *
 * Phase 2 (parked) would add the captcha dispatch (re-uses igr-ec's
 * ddddocr ensemble + adaptive K from D-035) and the post-login index
 * parsing. Blocked on captcha-vendor selection (D-037 follow-up) and
 * the Section 57 third-party resolution flow for Book 4.
 */

import type { CertifiedCopyResult } from "./contract.js";

const IGR_CC_URL = "https://igrodisha.gov.in/CertifiedCopy.aspx";
const PARSER_VERSION = "igr-certified-copy-v1";
const HTTP_TIMEOUT_MS = 8_000;

export interface CertifiedCopyInput {
  district?: string;
  sro?: string;
  /** Optional: search by deed number (post-login; Phase 1 ignored). */
  deedNo?: string;
  /** Optional: search by party name (post-login; Phase 1 ignored). */
  partyName?: string;
  /** Skip the live probe and return not_covered. Used for tests. */
  skipLive?: boolean;
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
    return text.length > 1000;
  } catch {
    return false;
  }
}

function notCoveredResult(
  fetchedAt: string,
  reason: string,
  pageIsLive: boolean,
  error?: string
): CertifiedCopyResult {
  return {
    source: "igr-certified-copy",
    status: "not_covered",
    statusReason: reason,
    verification: "manual_required",
    fetchedAt,
    parserVersion: PARSER_VERSION,
    data: {
      pageUrl: IGR_CC_URL,
      pageIsLive,
      entries: [],
      section57Note:
        "Per Section 57 of the Registration Act, 1908, Book 4 certified copies (full sale deed PDFs) are restricted to the executant, claimant, their agent, or legal representative. As a third-party buyer, you can only access the Book 1/2 index entry. For the full PDF, ask the seller for a notarised copy or hire a lawyer.",
      manualInstructions: {
        steps: [
          `Visit ${IGR_CC_URL}`,
          "Log in with your IGR credentials (or create a new user account).",
          "Search the index by deed number or party name (Book 1/2 — open to any person).",
          "View the index entry: deed number, registration date, parties, property description, consideration, market value, stamp duty.",
          "If you need the full PDF (Book 4), request it from the seller or hire a lawyer. Section 57 restricts third-party access to Book 4.",
          "Fee: ₹15 per party search + ₹10 inspection + ₹3 per page copying + ₹40/page user charges (max ₹250).",
        ],
        estimatedFeeINR: 30,
        expectedTime: "Same day for index entry; 1-3 days for full PDF (with seller's cooperation).",
      },
    },
    warnings: [
      {
        code: "IGR_CC_PHASE_1",
        message:
          "Phase 1 ships with manual-instructions fallback. Phase 2 (live captcha + index parsing) is parked behind D-037/D-046.",
      },
    ],
    ...(error ? { error } : {}),
  };
}

export async function igrCertifiedCopyFetch(
  input: CertifiedCopyInput
): Promise<CertifiedCopyResult> {
  const fetchedAt = new Date().toISOString();

  if (input.skipLive) {
    return notCoveredResult(fetchedAt, "skipLive_set_in_test", false);
  }

  const pageIsLive = await probePage(IGR_CC_URL);

  return notCoveredResult(
    fetchedAt,
    pageIsLive ? "live_page_alive_no_captcha_bypass" : "live_endpoint_unreachable",
    pageIsLive,
    pageIsLive
      ? undefined
      : `GET ${IGR_CC_URL} returned non-200, timeout, or network error`
  );
}

export async function healthCheck(): Promise<boolean> {
  return await probePage(IGR_CC_URL);
}
