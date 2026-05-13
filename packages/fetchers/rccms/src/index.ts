import { RCCMSResult, RCCMSResultSchema } from "./schema";
import type { SourceResult } from "@cleardeed/schema";
import { createHash } from "node:crypto";

export interface RCCMSInput {
  district: string;
  tahasil: string;
  village: string;
  khataNo?: string;
  plotNo?: string;
}

const PARSER_VERSION = "rccms-placeholder-v1";
const TEMPLATE_HASH = createHash("sha256")
  .update("rccms-placeholder-template-v1")
  .digest("hex");

/**
 * Fetches revenue court cases from RCCMS Odisha.
 * This is a placeholder and needs to be implemented.
 * The RCCMS website (rccms.odisha.gov.in) needs to be probed.
 */
// TODO: Implement live RCCMS fetcher with runWithRetry and proper circuit breakers.
// Currently this is a placeholder/mock.
export async function fetch(input: RCCMSInput): Promise<RCCMSResult> {
  const fetchedAt = new Date().toISOString();

  // Placeholder implementation
  console.warn("RCCMS fetcher is a placeholder and does not fetch real data.");

  const result: RCCMSResult = {
    source: "rccms",
    status: "partial",
    verification: "manual_required",
    fetchedAt,
    data: {
      total: 0,
      cases: [],
    },
    error: "Not implemented. RCCMS fetcher is a placeholder.",
  };

  return {
    ...RCCMSResultSchema.parse(result),
    statusReason: "not_implemented",
    attempts: 0,
    inputsTried: [{ label: "rccms_placeholder", input: { ...input } }],
    parserVersion: PARSER_VERSION,
    templateHash: TEMPLATE_HASH,
    warnings: [
      {
        code: "not_implemented",
        message: "RCCMS fetcher is a placeholder and does not fetch real data.",
      },
    ],
  } as unknown as SourceResult;
}

export async function healthCheck(): Promise<{ ok: boolean; message?: string }> {
    return { ok: false, message: "RCCMS fetcher is not implemented; manual RCCMS search is required." };
}

/**
 * Parses RCCMS case table HTML and extracts case records.
 */
export function parseRccmsTable(html: string): { cases: Array<{
  caseId: string;
  caseType: string;
  petitioner: string;
  respondent: string;
  status: string;
}>; total: number } {
  const rows = html.match(/<tr[^>]*>[\s\S]*?<\/tr>/gi) ?? [];
  const cases: Array<{
    caseId: string;
    caseType: string;
    petitioner: string;
    respondent: string;
    status: string;
  }> = [];
  const dataRows = rows.slice(1); // skip header
  for (const row of dataRows) {
    const cells = row.match(/<td[^>]*>([\s\S]*?)<\/td>/gi) ?? [];
    if (cells.length >= 9) {
      const extract = (c: string) => c.replace(/<[^>]+>/g, "").trim();
      cases.push({
        caseId: extract(cells[5]),
        caseType: extract(cells[4]),
        petitioner: extract(cells[6]),
        respondent: extract(cells[7]),
        status: extract(cells[8]),
      });
    }
  }
  return { cases, total: cases.length };
}
