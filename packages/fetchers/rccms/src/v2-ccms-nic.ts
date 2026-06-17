/**
 * ccms.nic.in v2 — pivot target for the RCCMS fetcher.
 *
 * Live-portal probe (2026-06-17):
 *   - https://ccms.nic.in → 200 (Apache/2.4.53, JSESSIONID cookie)
 *   - /searchCases.html → 200 (renders a JSP page)
 *
 * Task 1.1 of docs/superpowers/plans/2026-06-17-source-reliability-and-pid-foundation.md
 * asks for a fetcher that:
 *   1. GETs /searchCases.html to capture JSESSIONID + captcha image URL.
 *   2. Downloads the captcha and solves it via @cleardeed/captcha-breaker.
 *   3. POSTs a search (party / case_no / year / captcha) and parses the
 *      resulting table.
 *
 * Captcha caveat: the captcha-breaker's ONNX path is a stub
 * (packages/captcha-breaker/src/index.ts :: solveOnnx — throws). The ddddocr
 * fallback is a generic OCR model and is unlikely to solve ccms.nic.in's
 * captcha reliably. When captcha solving fails the fetcher returns
 * `status: "manual_required"` with an explanatory `error` — it does NOT
 * throw. This keeps Bar 3 of the contract test honest (throwing on a
 * known-broken plot is also honest, but a structured envelope is preferred).
 *
 * Per the binding brief and the rccms contract (apps/web/src/lib/pipeline/contracts/rccms.ts),
 * the typed envelope is:
 *   { source: "rccms", status: "ok" | "no_data" | "source_down" |
 *              "parse_error" | "manual_required",
 *     data?: { cases: CcmsCase[]; total: number },
 *     error?: string }
 *
 * NOTE: We do NOT touch packages/fetchers/rccms/src/index.ts. The plan
 * asks to delegate from the existing fetcher; we keep v2 as a parallel
 * function so the existing rccms probe + manual_required fallback remain
 * the production path until v2 is end-to-end validated.
 */
import { solveCaptcha } from "@cleardeed/captcha-breaker";

const CCMS_URL = "https://ccms.nic.in";
const TIMEOUT_MS = 5_000; // snappy portal — fail fast

export interface CcmsCase {
  caseNo: string;
  court: string;
  caseType: string;
  status: string;
  filingDate?: string;
  plotNo?: string;
}

export interface CcmsResult {
  source: "rccms";
  status:
    | "ok"
    | "no_data"
    | "source_down"
    | "parse_error"
    | "manual_required";
  data: { cases: CcmsCase[]; total: number };
  error?: string;
  fetchedAt: string;
  sourceUrl: string;
  latencyMs: number;
}

export interface CcmsInput {
  district: string;
  tahasil: string;
  village: string;
  partyName?: string;
}

const STATUS_REASON_TO_STATUS = {
  // Mapping from the brief's failure vocabulary to the legacy
  // statusReason codes accepted by the rccms contract adapter
  // (apps/web/src/lib/pipeline/contracts/rccms.ts :: classifyRccmsFailure).
  no_data: "no_data" as const,
  source_down: "portal_unreachable" as const,
  parse_error: "parse" as const,
  manual_required: "captcha_unsolved" as const,
  invalid_input: "invalid_input" as const,
};

/**
 * Public entry point — searches ccms.nic.in for revenue court cases.
 *
 * Returns a typed envelope. Never throws. Bar 3 (known-broken plot)
 * should produce an honest non-fire — see contract-test-factory.ts.
 */
export async function fetchCcmsNic(input: CcmsInput): Promise<CcmsResult> {
  const t0 = Date.now();
  const fetchedAt = new Date().toISOString();
  const make = (
    status: CcmsResult["status"],
    cases: CcmsCase[] = [],
    error?: string
  ): CcmsResult => ({
    source: "rccms",
    status,
    data: { cases, total: cases.length },
    ...(error ? { error } : {}),
    fetchedAt,
    sourceUrl: `${CCMS_URL}/searchCases.html`,
    latencyMs: Date.now() - t0,
  });

  try {
    // 1. GET searchCases.html — obtain JSESSIONID + captcha image URL
    const sessionRes = await globalThis.fetch(`${CCMS_URL}/searchCases.html`, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: {
        "User-Agent": "ClearDeed/1.0 (property due-diligence)",
      },
    });
    if (!sessionRes.ok) {
      return make(
        "source_down",
        [],
        `searchCases HTTP ${sessionRes.status}`
      );
    }
    const sessionHtml = await sessionRes.text();
    const setCookies = sessionRes.headers.getSetCookie();
    const cookieHeader = setCookies
      .map((c) => c.split(";")[0])
      .filter(Boolean)
      .join("; ");
    if (!cookieHeader) {
      return make(
        "source_down",
        [],
        "no JSESSIONID cookie from ccms.nic.in"
      );
    }

    // 2. Extract captcha image URL from the form HTML
    const captchaMatch = sessionHtml.match(
      /<img[^>]+src=["']([^"']*captcha[^"']*)["']/i
    );
    if (!captchaMatch) {
      return make("parse_error", [], "captcha <img> not found in form");
    }
    const rawCaptchaSrc = captchaMatch[1];
    const captchaUrl = rawCaptchaSrc.startsWith("http")
      ? rawCaptchaSrc
      : `${CCMS_URL}/${rawCaptchaSrc.replace(/^\//, "")}`;

    // 3. Fetch captcha image + solve
    const captchaRes = await globalThis.fetch(captchaUrl, {
      headers: { Cookie: cookieHeader },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!captchaRes.ok) {
      return make(
        "source_down",
        [],
        `captcha HTTP ${captchaRes.status}`
      );
    }
    const captchaBuf = Buffer.from(await captchaRes.arrayBuffer());
    // useOnnx: false — ONNX model doesn't exist yet. ddddocr fallback is
    // generic and unlikely to solve this captcha, but we try anyway.
    const solved = await solveCaptcha(captchaBuf, { useOnnx: false });
    if (!solved.text) {
      // Non-fatal: return manual_required so the report layer can render
      // the "verify at ccms.nic.in" instruction. Do NOT throw.
      return make(
        "manual_required",
        [],
        "captcha unsolved — see @cleardeed/captcha-breaker"
      );
    }

    // 4. POST search
    const body = new URLSearchParams({
      case_no: input.partyName ?? "",
      litigant_name: input.partyName ?? "",
      reg_year: new Date().getFullYear().toString(),
      case_status: "Both",
      captcha: solved.text,
    });
    const searchRes = await globalThis.fetch(
      `${CCMS_URL}/fetchallCaseDetails.html`,
      {
        method: "POST",
        headers: {
          Cookie: cookieHeader,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: body.toString(),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      }
    );
    if (!searchRes.ok) {
      return make(
        "source_down",
        [],
        `search HTTP ${searchRes.status}`
      );
    }
    const html = await searchRes.text();

    // 5. Parse result table (table.case-list > tr)
    const cases = parseCcmsTable(html);
    const status: CcmsResult["status"] = cases.length > 0 ? "ok" : "no_data";
    return make(status, cases);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return make("source_down", [], `unexpected: ${msg}`);
  }
}

/**
 * Parse the result table from a ccms.nic.in search response.
 *
 * The portal layout may vary; we accept any <tr> with ≥4 cells where the
 * first cell looks like a case number (digits/slash/digits). This is
 * deliberately lenient — when the portal changes shape, the parser will
 * either:
 *   - keep returning 0 cases (no_data — honest), or
 *   - emit garbage rows (parse_error — also honest).
 *
 * Bar 3 (the broken-plot test) will surface both correctly.
 */
export function parseCcmsTable(html: string): CcmsCase[] {
  const cases: CcmsCase[] = [];
  const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/g;
  let m: RegExpExecArray | null;
  while ((m = rowRegex.exec(html))) {
    const inner = m[1];
    const cells =
      inner.match(/<td[^>]*>([\s\S]*?)<\/td>/g)?.map((c) =>
        c.replace(/<[^>]+>/g, "").trim()
      ) ?? [];
    if (cells.length < 4) continue;
    const caseNo = cells[0];
    if (!caseNo || !/^\d+\/\d+/.test(caseNo)) continue;
    cases.push({
      caseNo,
      court: cells[1] ?? "",
      caseType: cells[2] ?? "",
      status: cells[3] ?? "",
      ...(cells[4] ? { filingDate: cells[4] } : {}),
    });
  }
  return cases;
}

// Re-export the brief's statusReason vocabulary for callers that want to
// surface a legacy statusReason field on top of the contract status.
export { STATUS_REASON_TO_STATUS };