/**
 * Sprint V2 — CERSAI (Central Registry of Securitisation Asset Reconstruction)
 * fetcher contract.
 *
 * CERSAI returns a list of charges against a borrower (Active / Satisfied /
 * Unknown). The V2 contract mirrors the existing `CERSAIResult` shape.
 *
 * Captcha accuracy: CERSAI is the most captcha-fragile source. The
 * `qa/fetcher_tests/cersai_ocr/` directory is the dedicated OCR accuracy
 * tracking scaffold; the contract itself only checks the post-parse shape.
 */
import { z } from "zod";
import { ContractError, ContractEnvelopeBase } from "./types";
import type { CERSAIResult } from "@cleardeed/schema";

const CERSAICharge = z.object({
  chargeType: z.string().optional(),
  borrowerName: z.string().optional(),
  propertyDesc: z.string().optional(),
  securedCreditor: z.string().optional(),
  chargeCreationDate: z.string().optional(),
  chargeAmount: z.string().optional(),
  chargeStatus: z.enum(["Active", "Satisfied", "Unknown"]).optional(),
  caseRef: z.string().optional(),
});

const SearchMetadata = z.object({
  nameVariantsTried: z.array(z.string()).optional(),
  searchAttempts: z.number().int().nonnegative().optional(),
});

export const CersaiDataSchema = z.object({
  searchType: z.enum(["borrower", "asset"]).optional(),
  searchName: z.string().optional(),
  charges: z.array(CERSAICharge).optional(),
  totalCharges: z.number().int().nonnegative().optional(),
  activeCharges: z.number().int().nonnegative().optional(),
  satisfiedCharges: z.number().int().nonnegative().optional(),
  searchMetadata: SearchMetadata.optional(),
});
export type CersaiData = z.infer<typeof CersaiDataSchema>;

export const CersaiContract = z.discriminatedUnion("status", [
  ContractEnvelopeBase.extend({
    source: z.literal("cersai"),
    status: z.literal("ok"),
    data: CersaiDataSchema,
  }),
  ContractEnvelopeBase.extend({
    source: z.literal("cersai"),
    status: z.literal("no_data"),
    error: ContractError,
  }),
  ContractEnvelopeBase.extend({
    source: z.literal("cersai"),
    status: z.literal("source_down"),
    error: ContractError,
  }),
  ContractEnvelopeBase.extend({
    source: z.literal("cersai"),
    status: z.literal("invalid_input"),
    error: ContractError,
  }),
  ContractEnvelopeBase.extend({
    source: z.literal("cersai"),
    status: z.literal("parse_error"),
    error: ContractError,
  }),
]);
export type CersaiContract = z.infer<typeof CersaiContract>;

/** Re-export the existing fetcher result type so schema and type stay in sync. */
export type { CERSAIResult };

// ─── Adapter ──────────────────────────────────────────────────────────────────

function buildError(code: string, message: string, details?: Record<string, string>) {
  return { code, message, ...(details ? { details } : {}) } satisfies z.infer<typeof ContractError>;
}

const NO_DATA_CODES = [
  "no_charges_found", "no_cerai_records", "no_cases",
  "portal_no_records",
];
const SOURCE_DOWN_CODES = [
  "portal_error", "fetch_failed", "network_error",
  "portal_unreachable", "cerai_portal_requires_login",
  "cerai_search_form_not_found",
];
const INVALID_INPUT_CODES = [
  "invalid_input", "unsupported_party_type",
];
const PARSE_ERROR_CODES = [
  "parse", "html_parse", "captcha", "ocr", "wfs_response",
  "unexpected",
];

function classifyCersaiFailure(statusReason: string | undefined): z.infer<typeof ContractStatus> {
  const lower = (statusReason ?? "").toLowerCase();
  if (NO_DATA_CODES.some((c) => lower.includes(c))) return "no_data";
  if (PARSE_ERROR_CODES.some((c) => lower.includes(c))) return "parse_error";
  if (INVALID_INPUT_CODES.some((c) => lower.includes(c))) return "invalid_input";
  if (SOURCE_DOWN_CODES.some((c) => lower.includes(c))) return "source_down";
  return "source_down";
}

export function mapCersaiToContract(
  result: CERSAIResult,
  fetchedAt: string,
): CersaiContract {
  const latencyMs =
    (result as unknown as { latencyMs?: number }).latencyMs ??
    (result.inputsTried?.length ? result.inputsTried.length * 1000 : 0);

  if (result.status === "success" && result.data) {
    const d = result.data;
    return {
      status: "ok",
      source: "cersai",
      data: {
        searchType: d.searchType,
        searchName: d.searchName,
        charges: d.charges,
        totalCharges: d.totalCharges,
        activeCharges: d.activeCharges,
        satisfiedCharges: d.satisfiedCharges,
        searchMetadata: d.searchMetadata
          ? {
              nameVariantsTried: d.searchMetadata.nameVariantsTried,
              searchAttempts: d.searchMetadata.searchAttempts,
            }
          : undefined,
      },
      fetchedAt,
      sourceUrl: "https://www.cersai.gov.in/",
      latencyMs,
    };
  }

  // `partial` with no charges → `no_data` (equivalent to "no mortgage/charge found")
  if (result.status === "partial" && (!result.data || !result.data.charges)) {
    return {
      status: "no_data",
      source: "cersai",
      error: buildError(
        "no_charges_found",
        result.statusReason ?? "No charges or mortgages found for this borrower.",
      ),
      fetchedAt,
      sourceUrl: "https://www.cersai.gov.in/",
      latencyMs,
    };
  }

  // Everything else: map by statusReason vocabulary.
  const status = classifyCersaiFailure(result.statusReason);
  return {
    status,
    source: "cersai",
    error: buildError(
      status,
      result.statusReason ?? result.error ?? "CERSAI lookup failed",
    ),
    fetchedAt,
    sourceUrl: "https://www.cersai.gov.in/",
    latencyMs,
  };
}
