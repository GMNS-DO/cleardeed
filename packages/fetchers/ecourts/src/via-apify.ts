/**
 * eCourts via Apify parseforge actor — Task 1.2 of Layer 1.
 *
 * The eCourtsIndia.com V6 portal (services.ecourts.gov.in/ecourtindia_v6) is
 * effectively dead — captcha + WAF + name-variant heuristics make the in-house
 * Playwright/OCR path brittle and slow. We pivot to the
 * `parseforge/court-records-ecourt-india-scraper` Apify actor, which solves
 * the captcha, performs the search, and returns structured rows.
 *
 * Captcha solving is the actor's responsibility (we do not use
 * `@cleardeed/captcha-breaker` here). The Apify actor's free tier gives
 * ~5 calls per month; production usage costs ₹0.60–2.00/call on PAYG.
 *
 * Per the binding brief and the ecourts contract
 * (apps/web/src/lib/pipeline/contracts/ecourts.ts), the typed envelope is:
 *   {
 *     source: "ecourts",
 *     status: "ok" | "no_data" | "source_down" | "invalid_input"
 *           | "parse_error" | "manual_required",
 *     data: { cases: EcourtsCase[] },
 *     error?: string,
 *     fetchedAt: string,
 *     sourceUrl: string,
 *     latencyMs: number
 *   }
 *
 * NOTE: We do NOT touch packages/fetchers/ecourts/src/index.ts's existing
 * Playwright/OCR fetcher. The plan keeps both in parallel; this module is
 * the new fetchEcourtsViaApify() entry. When APIFY_TOKEN is set,
 * index.ts delegates here.
 */

const APIFY_ACTOR = "parseforge/court-records-ecourt-india-scraper";
const APIFY_URL = `https://api.apify.com/v2/acts/${APIFY_ACTOR}/run-sync-get-dataset-items`;
const TIMEOUT_MS = 60_000; // Apify run-sync may take a while for cold actors

export interface EcourtsCase {
  cnr: string;
  caseNo: string;
  caseType: string;
  court: string;
  status: string;
  parties: { petitioner: string; respondent: string };
  filingDate?: string;
  nextHearingDate?: string;
}

export type EcourtsContractStatus =
  | "ok"
  | "no_data"
  | "source_down"
  | "invalid_input"
  | "parse_error"
  | "manual_required";

export interface EcourtsResult {
  source: "ecourts";
  status: EcourtsContractStatus;
  data: { cases: EcourtsCase[] };
  error?: string;
  fetchedAt: string;
  sourceUrl: string;
  latencyMs: number;
}

export interface EcourtsInput {
  partyName: string;
  courtComplex?: string;
  caseType?: string;
}

/**
 * Public entry point — searches eCourts via Apify parseforge.
 *
 * Returns a typed envelope. Never throws on transient failures (timeout,
 * 5xx, network) — returns `source_down`. Throws only on programmer error
 * (missing required field at the call site).
 *
 * If APIFY_TOKEN is not set, returns `manual_required` so the report layer
 * can render "verify manually at services.ecourts.gov.in". This is the
 * honest non-fire Bar 3 looks for.
 */
export async function fetchEcourtsViaApify(
  input: EcourtsInput
): Promise<EcourtsResult> {
  const t0 = Date.now();
  const fetchedAt = new Date().toISOString();
  const make = (
    status: EcourtsContractStatus,
    cases: EcourtsCase[] = [],
    error?: string
  ): EcourtsResult => ({
    source: "ecourts",
    status,
    data: { cases },
    ...(error ? { error } : {}),
    fetchedAt,
    sourceUrl: `${APIFY_URL}?partyName=${encodeURIComponent(input.partyName)}`,
    latencyMs: Date.now() - t0,
  });

  const token = process.env.APIFY_TOKEN;
  if (!token) {
    return make(
      "manual_required",
      [],
      "APIFY_TOKEN not set; manual fallback to services.ecourts.gov.in"
    );
  }

  const partyName = (input.partyName ?? "").trim();
  if (!partyName) {
    return make("invalid_input", [], "partyName is required");
  }

  try {
    const res = await globalThis.fetch(APIFY_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "User-Agent": "ClearDeed/1.0 (property due-diligence)",
      },
      body: JSON.stringify({
        partyName,
        courtComplex: input.courtComplex ?? "Odisha District Courts",
        caseType: input.caseType ?? "all",
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    if (!res.ok) {
      return make(
        "source_down",
        [],
        `Apify HTTP ${res.status}: ${res.statusText}`
      );
    }

    const raw = (await res.json()) as unknown;
    const rows = Array.isArray(raw)
      ? (raw as Record<string, unknown>[])
      : extractDatasetRows(raw);
    const cases = rows.map(normalizeRow).filter(isValidCase);

    return make(
      cases.length > 0 ? "ok" : "no_data",
      cases,
      cases.length === 0 ? "Apify returned 0 cases for the given party name" : undefined
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return make("source_down", [], `Apify request failed: ${msg}`);
  }
}

/**
 * Normalize one Apify dataset row to the typed EcourtsCase shape.
 *
 * The parseforge actor's schema uses snake_case for some fields and
 * TitleCase for others; we accept either and map to the brief's contract
 * shape. Missing fields default to empty string (rather than `undefined`)
 * so downstream consumers can render without null checks.
 */
function normalizeRow(r: Record<string, unknown>): EcourtsCase {
  const parties: EcourtsCase["parties"] = {
    petitioner:
      strOrEmpty(r.petitioner) ||
      strOrEmpty(r.petitioner_name) ||
      strOrEmpty(r.plaintiff) ||
      strOrEmpty(r.applicant),
    respondent:
      strOrEmpty(r.respondent) ||
      strOrEmpty(r.respondent_name) ||
      strOrEmpty(r.defendant) ||
      strOrEmpty(r.accused),
  };

  const filingDate = strOrEmpty(r.filingDate) || strOrEmpty(r.date_of_filing) || strOrEmpty(r.filing_date);
  const nextHearingDate = strOrEmpty(r.nextHearingDate) || strOrEmpty(r.next_hearing_date);

  return {
    cnr: strOrEmpty(r.cnr),
    caseNo: strOrEmpty(r.caseNo) || strOrEmpty(r.case_number) || strOrEmpty(r.case_no),
    caseType: strOrEmpty(r.caseType) || strOrEmpty(r.case_type),
    court: strOrEmpty(r.court) || strOrEmpty(r.court_complex),
    status: strOrEmpty(r.status) || strOrEmpty(r.case_status),
    parties,
    ...(filingDate ? { filingDate } : {}),
    ...(nextHearingDate ? { nextHearingDate } : {}),
  };
}

function isValidCase(c: EcourtsCase): boolean {
  // Accept rows that carry either a CNR or a case number — both are
  // required to surface something useful. Discard pure header/blank rows.
  return Boolean(c.cnr) || Boolean(c.caseNo);
}

function strOrEmpty(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

/**
 * The Apify `run-sync-get-dataset-items` endpoint normally returns a JSON
 * array of dataset items. Some actor versions wrap the items in
 * `{ items: [...] }` or `{ data: [...] }`. Accept either shape.
 */
function extractDatasetRows(raw: unknown): Record<string, unknown>[] {
  if (raw && typeof raw === "object") {
    const obj = raw as Record<string, unknown>;
    if (Array.isArray(obj.items)) return obj.items as Record<string, unknown>[];
    if (Array.isArray(obj.data)) return obj.data as Record<string, unknown>[];
  }
  return [];
}
