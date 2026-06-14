/**
 * Sprint V2 — eCourts (case search) fetcher contract.
 *
 * eCourts is the captcha-gated national portal; the contract payload is a
 * list of cases matching the search party name. The live fetcher's
 * `CourtCaseResult` type is reused for the `data` field.
 *
 * Note: this contract is shared with high-court / drt / larr in
 * `@cleardeed/schema` (all court-case sources share the same shape). V2 only
 * covers eCourts; the others are NOT in the current V1.1 pipeline.
 */
import { z } from "zod";
import { ContractError, ContractEnvelopeBase, type ContractStatus } from "./types";
import type { CourtCaseResult } from "@cleardeed/schema";

const CaseParty = z.object({
  name: z.string(),
  role: z.enum(["petitioner", "respondent", "other"]),
});

const Case = z.object({
  caseNo: z.string(),
  caseType: z.string(),
  court: z.string(),
  filingDate: z.string().optional(),
  status: z.string(),
  parties: z.array(CaseParty),
  lastHearingDate: z.string().optional(),
  nextHearingDate: z.string().optional(),
});

const SearchMetadata = z
  .object({
    districtName: z.string().optional(),
    districtCode: z.string().optional(),
    complexesTried: z.array(z.string()).optional(),
    captchaAcceptedCount: z.number().int().nonnegative().optional(),
    captchaFailedCount: z.number().int().nonnegative().optional(),
    negativeResultConfidence: z
      .enum(["high", "medium", "low", "unconfirmed"])
      .optional(),
  })
  .passthrough();

export const EcourtsDataSchema = z.object({
  cases: z.array(Case),
  total: z.number(),
  searchMetadata: SearchMetadata.optional(),
});
export type EcourtsData = z.infer<typeof EcourtsDataSchema>;

export const EcourtsContract = z.discriminatedUnion("status", [
  ContractEnvelopeBase.extend({
    source: z.literal("ecourts"),
    status: z.literal("ok"),
    data: EcourtsDataSchema,
  }),
  ContractEnvelopeBase.extend({
    source: z.literal("ecourts"),
    status: z.literal("no_data"),
    error: ContractError,
  }),
  ContractEnvelopeBase.extend({
    source: z.literal("ecourts"),
    status: z.literal("source_down"),
    error: ContractError,
  }),
  ContractEnvelopeBase.extend({
    source: z.literal("ecourts"),
    status: z.literal("invalid_input"),
    error: ContractError,
  }),
  ContractEnvelopeBase.extend({
    source: z.literal("ecourts"),
    status: z.literal("parse_error"),
    error: ContractError,
  }),
]);
export type EcourtsContract = z.infer<typeof EcourtsContract>;

/** Re-export the existing fetcher result type so schema and type stay in sync. */
export type { CourtCaseResult };

// ─── Adapter ──────────────────────────────────────────────────────────────────

function buildError(code: string, message: string, details?: Record<string, string>) {
  return { code, message, ...(details ? { details } : {}) } satisfies z.infer<typeof ContractError>;
}

const PARSE_ERROR_CODES = [
  "parse", "html_parse", "wfs_response", "wfs_response_validation_failed",
  "invalid_shape", "unexpected",
];
const INVALID_INPUT_CODES = [
  "unsupported_district", "unsupported", "not_in_dictionary",
];

function classifyEcourtsFailure(statusReason: string | undefined): ContractStatus {
  const lower = (statusReason ?? "").toLowerCase();
  if (PARSE_ERROR_CODES.some((c) => lower.includes(c))) return "parse_error";
  if (INVALID_INPUT_CODES.some((c) => lower.includes(c))) return "invalid_input";
  return "source_down";
}

export function mapEcourtsToContract(
  result: CourtCaseResult,
  fetchedAt: string,
): EcourtsContract {
  const latencyMs =
    (result as unknown as { latencyMs?: number }).latencyMs ??
    (result.inputsTried?.length ? result.inputsTried.length * 1000 : 0);

  if (result.status === "success") {
    const cases = result.data?.cases ?? [];
    const total = result.data?.total ?? cases.length;
    const searchMetadata = result.data?.searchMetadata;
    return {
      status: "ok",
      source: "ecourts",
      data: {
        cases,
        total,
        ...(searchMetadata !== undefined ? { searchMetadata } : {}),
      },
      fetchedAt,
      sourceUrl: "https://services.ecourts.gov.in/ecourtindia_v6/",
      latencyMs,
    };
  }

  if (result.status === "partial") {
    const lower = (result.statusReason ?? "").toLowerCase();
    // Captcha-failed or no-cases-found are data-complete, just negative —
    // surface them as `no_data` so Section 3 can render "no cases found".
    if (lower.includes("captcha_failed") || lower.includes("no_cases_found")) {
      return {
        status: "no_data",
        source: "ecourts",
        error: buildError(
          "no_cases_found",
          result.statusReason ?? "eCourts returned no cases for this party name",
          result.data?.searchMetadata
            ? { districtName: result.data.searchMetadata.districtName ?? undefined }
            : undefined,
        ),
        fetchedAt,
        sourceUrl: "https://services.ecourts.gov.in/ecourtindia_v6/",
        latencyMs,
      };
    }
  }

  // All other partials (portal_error, portal_unreachable, etc.) and `failed` →
  // source_down.
  const status: ContractStatus =
    result.status === "not_covered" && (result.statusReason ?? "").toLowerCase().includes("unsupported_district")
      ? "invalid_input"
      : classifyEcourtsFailure(result.statusReason);

  return {
    status,
    source: "ecourts",
    error: buildError(
      status,
      result.statusReason ?? result.error ?? "eCourts lookup failed",
    ),
    fetchedAt,
    sourceUrl: "https://services.ecourts.gov.in/ecourtindia_v6/",
    latencyMs,
  };
}
