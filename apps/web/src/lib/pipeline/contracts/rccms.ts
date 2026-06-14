/**
 * Sprint V2 — RCCMS (Revenue Court Case Management System) fetcher contract.
 *
 * Known caveat (V1.1): the pipeline currently short-circuits RCCMS to
 * `status: "failed"` with `statusReason: "rccms_probe_skipped_sprint6_todo"`
 * — see qa/known_issues.md KI-001. The contract below describes the
 * *intended* shape, which the V2 contract tests assert against. When the
 * fetcher is re-enabled, the contract does not need to change.
 *
 * Note: the live fetcher has its own local `RCCMSResult` Zod schema in
 * `packages/fetchers/rccms/src/schema.ts` that uses different field names
 * (caseId, petitioner, respondent) than the schema-typed `RCCMSResult` in
 * `@cleardeed/schema` (caseNo, no party split). This is tracked in KI-002.
 */
import { z } from "zod";
import { ContractError, ContractEnvelopeBase, type ContractStatus } from "./types";
import type { RCCMSResult } from "@cleardeed/schema";

const Case = z.object({
  caseNo: z.string(),
  plotNo: z.string().optional(),
  caseType: z.string(),
  filingDate: z.string().optional(),
  status: z.string(),
  court: z.string(),
});

export const RccmsDataSchema = z.object({
  cases: z.array(Case),
  total: z.number(),
});
export type RccmsData = z.infer<typeof RccmsDataSchema>;

export const RccmsContract = z.discriminatedUnion("status", [
  ContractEnvelopeBase.extend({
    source: z.literal("rccms"),
    status: z.literal("ok"),
    data: RccmsDataSchema,
  }),
  ContractEnvelopeBase.extend({
    source: z.literal("rccms"),
    status: z.literal("no_data"),
    error: ContractError,
  }),
  ContractEnvelopeBase.extend({
    source: z.literal("rccms"),
    status: z.literal("source_down"),
    error: ContractError,
  }),
  ContractEnvelopeBase.extend({
    source: z.literal("rccms"),
    status: z.literal("invalid_input"),
    error: ContractError,
  }),
  ContractEnvelopeBase.extend({
    source: z.literal("rccms"),
    status: z.literal("parse_error"),
    error: ContractError,
  }),
]);
export type RccmsContract = z.infer<typeof RccmsContract>;

/** Re-export the existing fetcher result type so schema and type stay in sync. */
export type { RCCMSResult };

// ─── Adapter ──────────────────────────────────────────────────────────────────

function buildError(code: string, message: string, details?: Record<string, string>) {
  return { code, message, ...(details ? { details } : {}) } satisfies z.infer<typeof ContractError>;
}

const NO_DATA_CODES = [
  "no_cases_found", "probe_failed",
];
const SOURCE_DOWN_CODES = [
  "portal_unreachable", "login_required", "rccms_timeout",
  "fetch_failed", "portal_down",
];
const INVALID_INPUT_CODES = [
  "invalid_input", "unsupported_district", "village_not_in_khordha",
];
const PARSE_ERROR_CODES = [
  "parse", "html_parse", "wfs_response", "wfs_response_validation_failed",
  "invalid_shape", "unexpected",
];

function classifyRccmsFailure(statusReason: string | undefined): ContractStatus {
  const lower = (statusReason ?? "").toLowerCase();
  if (NO_DATA_CODES.some((c) => lower.includes(c))) return "no_data";
  if (PARSE_ERROR_CODES.some((c) => lower.includes(c))) return "parse_error";
  if (INVALID_INPUT_CODES.some((c) => lower.includes(c))) return "invalid_input";
  if (SOURCE_DOWN_CODES.some((c) => lower.includes(c))) return "source_down";
  return "source_down";
}

export function mapRccmsToContract(
  result: RCCMSResult,
  fetchedAt: string,
): RccmsContract {
  const latencyMs =
    (result as unknown as { latencyMs?: number }).latencyMs ??
    (result.inputsTried?.length ? result.inputsTried.length * 1000 : 0);

  if (result.status === "success" && result.data) {
    return {
      status: "ok",
      source: "rccms",
      data: {
        cases: result.data.cases,
        total: result.data.total,
      },
      fetchedAt,
      sourceUrl: result.data.searchMetadata?.portalUrl ?? "https://rccms.odisha.gov.in/",
      latencyMs,
    };
  }

  const status = classifyRccmsFailure(result.statusReason);
  return {
    status,
    source: "rccms",
    error: buildError(
      status,
      result.statusReason ?? result.error ?? "RCCMS lookup failed",
      result.data?.searchMetadata
        ? { village: result.data.searchMetadata.village }
        : undefined,
    ),
    fetchedAt,
    sourceUrl: result.data?.searchMetadata?.portalUrl ?? "https://rccms.odisha.gov.in/",
    latencyMs,
  };
}
