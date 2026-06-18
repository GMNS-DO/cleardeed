/**
 * IGR Odisha EC — V3 (captcha-breaker ONNX) fetcher.
 *
 * Task 1.3 — Layer 1.3: integrate IGR EC with the @cleardeed/captcha-breaker
 * ONNX solver. The V1 path (Playwright + login wall → manual instructions)
 * and V2 path (Tesseract + 2Captcha fallback, OTP-gated citizen login) are
 * preserved; V3 is the HTTP-only path that uses the captcha-breaker's ONNX
 * solver to crack the captcha on the public EncumbranceSearch page without
 * a citizen login.
 *
 * Architecture (D-035):
 *   1. GET EncumbranceSearch page → session cookie + captcha <img>
 *   2. Solve captcha with @cleardeed/captcha-breaker (ONNX if model present)
 *   3. POST search → table of EC entries
 *   4. Parse → typed entries
 *
 * Degradation:
 *   - All errors return a typed IgrEcContract envelope (status ∈
 *     { ok, no_data, source_down, invalid_input, parse_error }).
 *   - Captcha failures map to `parse_error` (the captcha is the parser's
 *     input — if it's unsolvable, parsing cannot proceed).
 *   - Network errors map to `source_down`.
 *
 * NOTE: This fetcher is wired only when the captcha-breaker package is
 * importable. `index.ts` falls back to V1 manual-instructions if the
 * dynamic import fails.
 */

import { solveCaptcha } from "@cleardeed/captcha-breaker";
import { IgrEcContract } from "../../../../apps/web/src/lib/pipeline/contracts/igr-ec";

// ── Public interface (matches the binding brief) ────────────────────────────

export interface IgrEcV3Input {
  /** Party name to search (used as the EC search criterion). */
  partyName: string;
  /** SRO code (e.g. "BHUBANESWAR", "JATNI", "BALIPATNA"). */
  sroCode: string;
  /** Search period (years back). Defaults to 1 (D-033 launch window). */
  deedPeriod?: string;
}

export type IgrEcV3Envelope = IgrEcContract;

export interface IgrEcV3Options {
  /** Override the per-step timeout (ms). Default 15s for form/captcha, 30s for search. */
  timeoutMs?: number;
  /**
   * Inject a custom captcha solver (used by the unit-test battery to bypass
   * the real OCR pipeline). Defaults to `solveCaptcha` from
   * `@cleardeed/captcha-breaker`.
   */
  captchaSolver?: (
    image: Buffer,
    options: { useOnnx?: boolean; onnxModelPath?: string }
  ) => Promise<{ text: string; confidence: number; attempts: number }>;
}

// ── Constants ───────────────────────────────────────────────────────────────

const IGR_EC_SEARCH_URL = "https://igrodisha.gov.in/igrsearch/EncumbranceSearch";
const ONNX_MODEL_PATH = "packages/captcha-breaker/onnx/khordha-captcha-resnet18.onnx";

export const V3_PARSER_VERSION = "igr-ec-fetcher-v3-captcha-breaker";

// Per-attempt timeouts (per the brief — keep these short to fit the 60s
// contract test window once the ONNX model is available).
const FORM_TIMEOUT_MS = 15_000;
const CAPTCHA_TIMEOUT_MS = 15_000;
const SEARCH_TIMEOUT_MS = 30_000;

// ── Helpers ─────────────────────────────────────────────────────────────────

function buildCookieHeader(rawSetCookie: string[]): string {
  // Keep just the "name=value" pair of each Set-Cookie header. Drop
  // attributes like Path, HttpOnly, etc.
  return rawSetCookie
    .map((c) => c.split(";")[0])
    .filter((c) => c.length > 0)
    .join("; ");
}

function buildError(code: string, message: string) {
  return { code, message };
}

/**
 * Pull a captcha <img> URL out of the form HTML. The IGR search page
 * embeds the captcha as `<img id="captcha" src="CImage.aspx?...">` or
 * similar — we accept any `<img>` whose src mentions captcha/CImage.
 */
function findCaptchaUrl(html: string): string | null {
  // First try the explicit `id="captcha"` pattern (most stable).
  const explicit = html.match(/<img[^>]+id=["']captcha["'][^>]+src=["']([^"']+)["']/i);
  if (explicit) return explicit[1];
  // Fallback: any img whose src looks like the captcha generator endpoint.
  const fallback = html.match(/<img[^>]+src=["']([^"']*CImage\.aspx[^"']*)["']/i);
  if (fallback) return fallback[1];
  // Last resort: an img with "captcha" in its src.
  const anyCaptcha = html.match(/<img[^>]+src=["']([^"']*[Cc]aptcha[^"']*)["']/i);
  if (anyCaptcha) return anyCaptcha[1];
  // Final fallback: an img with "captcha" in its class attribute.
  const classCaptcha = html.match(/<img[^>]+class=["'][^"']*[Cc]aptcha[^"']*["'][^>]+src=["']([^"']+)["']/i);
  if (classCaptcha) return classCaptcha[1];
  return null;
}

function absolutizeUrl(captchaUrl: string): string {
  if (/^https?:\/\//i.test(captchaUrl)) return captchaUrl;
  // Strip leading slash, prepend IGR origin.
  return `https://igrodisha.gov.in/${captchaUrl.replace(/^\//, "")}`;
}

/**
 * Parse the IGR EC results table into typed entries matching the shared
 * `EncumbranceEntry` schema (docType, docNo, regDate, party1, party2,
 * consideration).
 *
 * Expected row layout (from observed IGR layout, best-effort — degrades
 * gracefully if columns differ):
 *   [DocType, DocNo, RegDate, Party1, Party2, Consideration, ...]
 *
 * Returns `null` if no results table could be identified at all. An empty
 * array means the table was found and parsed but contained zero rows
 * (which is the "no encumbrances" signal from IGR).
 */
function parseResultsTable(html: string): Array<{
  docType?: string;
  docNo?: string;
  regDate?: string;
  party1?: string;
  party2?: string;
  consideration?: string;
}> | null {
  const entries: Array<{
    docType?: string;
    docNo?: string;
    regDate?: string;
    party1?: string;
    party2?: string;
    consideration?: string;
  }> = [];

  // Heuristic: detect nil-EC message in any cell/text and return empty
  // (the IGR portal often renders "No records found" inside the table
  // or alongside it). Check this BEFORE requiring a <table>, since the
  // "no records" page is sometimes a single <div> with no <table>.
  if (/no\s*(records?|encumbrance|results?)\s*found/i.test(html)) {
    return entries;
  }

  // No-table signal: if the HTML has no <table> at all, we can't extract anything.
  if (!/<table[\s>]/i.test(html)) {
    return null;
  }

  const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let rowMatch: RegExpExecArray | null;
  while ((rowMatch = rowRegex.exec(html)) !== null) {
    const cellRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
    const cells: string[] = [];
    let cellMatch: RegExpExecArray | null;
    while ((cellMatch = cellRegex.exec(rowMatch[1])) !== null) {
      cells.push(cellMatch[1].replace(/<[^>]+>/g, "").trim());
    }
    if (cells.length < 4) continue;
    // Heuristic: a data row must have at least one cell with a 4-digit run
    // (a year or a docNo like "1234/2024").
    const hasYearish = cells.some((c) => /\d{4,}/.test(c));
    if (!hasYearish) continue;

    entries.push({
      docType: cells[0],
      docNo: cells[1],
      regDate: cells[2],
      party1: cells[3],
      party2: cells[4],
      consideration: cells[5],
    });
  }

  return entries;
}

// ── Main export ──────────────────────────────────────────────────────────────

/**
 * Fetch EC entries from IGR Odisha using the captcha-breaker ONNX solver.
 *
 * Returns a typed IgrEcContract envelope. `status === "ok"` means we got a
 * structured response from IGR (whether the entries list is non-empty or
 * empty is reflected in `data.entries.length`).
 */
export async function fetchIgrEcV3(
  input: IgrEcV3Input,
  options: IgrEcV3Options = {},
): Promise<IgrEcV3Envelope> {
  const fetchedAt = new Date().toISOString();
  const formTimeoutMs = options.timeoutMs ?? 15_000;
  const captchaTimeoutMs = options.timeoutMs ?? 15_000;
  const searchTimeoutMs = options.timeoutMs ?? 30_000;

  // Pre-flight input check.
  if (!input.partyName || input.partyName.trim().length === 0) {
    return {
      source: "igr-ec",
      status: "invalid_input",
      error: buildError("MISSING_INPUT", "partyName is required"),
      fetchedAt,
      sourceUrl: IGR_EC_SEARCH_URL,
      latencyMs: 0,
    };
  }
  if (!input.sroCode || input.sroCode.trim().length === 0) {
    return {
      source: "igr-ec",
      status: "invalid_input",
      error: buildError("MISSING_INPUT", "sroCode is required"),
      fetchedAt,
      sourceUrl: IGR_EC_SEARCH_URL,
      latencyMs: 0,
    };
  }

  const t0 = Date.now();
  try {
    // Step 1: GET form → session cookie + captcha URL
    const formRes = await fetch(IGR_EC_SEARCH_URL, {
      method: "GET",
      signal: AbortSignal.timeout(formTimeoutMs),
    });
    if (!formRes.ok) {
      return {
        source: "igr-ec",
        status: "source_down",
        error: buildError("HTTP_ERROR", `IGR EC form HTTP ${formRes.status}`),
        fetchedAt,
        sourceUrl: IGR_EC_SEARCH_URL,
        latencyMs: Date.now() - t0,
      };
    }
    const setCookies = formRes.headers.getSetCookie();
    const cookieHeader = buildCookieHeader(setCookies);
    const formHtml = await formRes.text();

    const captchaPath = findCaptchaUrl(formHtml);
    if (!captchaPath) {
      return {
        source: "igr-ec",
        status: "parse_error",
        error: buildError("CAPTCHA_NOT_FOUND", "captcha image not found in form HTML"),
        fetchedAt,
        sourceUrl: IGR_EC_SEARCH_URL,
        latencyMs: Date.now() - t0,
      };
    }
    const captchaUrl = absolutizeUrl(captchaPath);

    // Step 2: Fetch captcha image bytes
    const captchaRes = await fetch(captchaUrl, {
      headers: cookieHeader ? { Cookie: cookieHeader } : undefined,
      signal: AbortSignal.timeout(captchaTimeoutMs),
    });
    if (!captchaRes.ok) {
      return {
        source: "igr-ec",
        status: "source_down",
        error: buildError("HTTP_ERROR", `captcha HTTP ${captchaRes.status}`),
        fetchedAt,
        sourceUrl: IGR_EC_SEARCH_URL,
        latencyMs: Date.now() - t0,
      };
    }
    const captchaBuf = Buffer.from(await captchaRes.arrayBuffer());

    // Step 3: Solve captcha
    let solvedText: string;
    try {
      const solver = options.captchaSolver ?? solveCaptcha;
      const solved = await solver(captchaBuf, {
        useOnnx: true,
        onnxModelPath: ONNX_MODEL_PATH,
      });
      solvedText = solved.text;
    } catch (err) {
      return {
        source: "igr-ec",
        status: "parse_error",
        error: buildError(
          "CAPTCHA_UNSOLVED",
          `captcha solver failed: ${(err as Error).message}`,
        ),
        fetchedAt,
        sourceUrl: IGR_EC_SEARCH_URL,
        latencyMs: Date.now() - t0,
      };
    }
    if (!solvedText || solvedText.length < 4) {
      return {
        source: "igr-ec",
        status: "parse_error",
        error: buildError("CAPTCHA_UNSOLVED", "captcha solver returned empty text"),
        fetchedAt,
        sourceUrl: IGR_EC_SEARCH_URL,
        latencyMs: Date.now() - t0,
      };
    }

    // Step 4: POST search
    const body = new URLSearchParams({
      sroCode: input.sroCode,
      partyName: input.partyName,
      deedPeriod: input.deedPeriod ?? "1",
      captcha: solvedText,
    });

    const searchRes = await fetch(IGR_EC_SEARCH_URL, {
      method: "POST",
      headers: {
        ...(cookieHeader ? { Cookie: cookieHeader } : {}),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: body.toString(),
      signal: AbortSignal.timeout(searchTimeoutMs),
    });
    if (!searchRes.ok) {
      return {
        source: "igr-ec",
        status: "source_down",
        error: buildError("HTTP_ERROR", `IGR EC search HTTP ${searchRes.status}`),
        fetchedAt,
        sourceUrl: IGR_EC_SEARCH_URL,
        latencyMs: Date.now() - t0,
      };
    }
    const html = await searchRes.text();

    // Step 5: Parse results
    let parsedEntries: ReturnType<typeof parseResultsTable>;
    try {
      parsedEntries = parseResultsTable(html);
    } catch (err) {
      return {
        source: "igr-ec",
        status: "parse_error",
        error: buildError("TABLE_NOT_FOUND", `result-table parse failed: ${(err as Error).message}`),
        fetchedAt,
        sourceUrl: IGR_EC_SEARCH_URL,
        latencyMs: Date.now() - t0,
      };
    }
    if (parsedEntries === null) {
      return {
        source: "igr-ec",
        status: "parse_error",
        error: buildError("TABLE_NOT_FOUND", "no <table> found in IGR EC response"),
        fetchedAt,
        sourceUrl: IGR_EC_SEARCH_URL,
        latencyMs: Date.now() - t0,
      };
    }

    const entries = parsedEntries;

    const fromYear = new Date().getFullYear() - (parseInt(input.deedPeriod ?? "1", 10) || 1);
    const toYear = new Date().getFullYear();

    // Build the IgrEcData payload.
    // - Zero rows (or nil-EC message) → ecAvailable=false, no entries array.
    // - ≥1 rows → ecAvailable=true, entries array present.
    const ecData: Record<string, unknown> = {
      ecAvailable: entries.length > 0,
      searchPeriod: { from: String(fromYear), to: String(toYear) },
      sro: input.sroCode,
      district: "Khordha",
      fee: 50,
      feeCurrency: "INR",
    };
    if (entries.length > 0) {
      ecData.entries = entries;
    }

    return {
      source: "igr-ec",
      status: "ok",
      data: ecData,
      fetchedAt,
      sourceUrl: IGR_EC_SEARCH_URL,
      latencyMs: Date.now() - t0,
    };
  } catch (err) {
    const e = err as Error;
    // Map AbortError to TIMEOUT (the test suite uses AbortSignal-based
    // timeouts and asserts the TIMEOUT error code).
    const isAbort = e?.name === "AbortError" || /aborted/i.test(e?.message ?? "");
    return {
      source: "igr-ec",
      status: "source_down",
      error: buildError(
        isAbort ? "TIMEOUT" : "NETWORK_ERROR",
        isAbort
          ? `request timed out: ${e.message}`
          : `network error: ${e.message}`,
      ),
      fetchedAt,
      sourceUrl: IGR_EC_SEARCH_URL,
      latencyMs: Date.now() - t0,
    };
  }
}

// ── Re-exports for tests / pipeline ──────────────────────────────────────────

export const V3_PARSER_VERSION_PUBLIC = V3_PARSER_VERSION;
export const V3_ONNX_MODEL_PATH_PUBLIC = ONNX_MODEL_PATH;
export { parseResultsTable as _parseResultsTableForTests };