/**
 * Sprint V2 — Bhulekh (Record of Rights) fetcher contract.
 *
 * The Bhulekh portal returns the Record of Rights for a plot, including
 * khatiyan number, village, and a list of tenant/owner rows. This contract
 * mirrors the existing `RoRResult` type from `@cleardeed/schema` but is
 * expressed in the V2 contract envelope (status: ok | no_data | source_down |
 * invalid_input | parse_error).
 *
 * The data schema is intentionally slightly looser than the live fetcher's
 * internal `BhulekhRoRDocumentV1` — that document is the *raw* artifact. The
 * contract is the *post-parse, post-validation* deliverable that the
 * orchestrator consumes.
 *
 * The `mapBhulekhToContract` adapter at the bottom of this file translates the
 * fetcher's internal status vocabulary (`success | failed | blank | not_found`)
 * into the contract vocabulary (`ok | no_data | source_down | invalid_input |
 * parse_error`). Put here so any consumer of `BhulekhContract` reuses the same
 * mapping, and so the fetcher itself (`@cleardeed/fetcher-bhulekh`) stays
 * decoupled from the contract layer.
 */
import { z } from "zod";
import { ContractError, ContractEnvelopeBase, type ContractStatus } from "./types";
import type { RoRResult } from "@cleardeed/schema";

const RoRLandDetail = z.object({
  surveyNo: z.string(),
  area: z.number(),
  unit: z.string().default("acre"),
  landClass: z.string(),
  tenantName: z.string(),
  fatherHusbandName: z.string().optional(),
  share: z.string().optional(),
});

const RoRMutationReference = z.object({
  caseType: z.string().optional(),
  caseNo: z.string().optional(),
  orderDate: z.string().optional(),
  plotNo: z.string().optional(),
  sourceField: z.string(),
  rawText: z.string(),
});

/** The typed data payload when status === "ok". */
export const BhulekhDataSchema = z.object({
  plotNo: z.string(),
  khataNo: z.string().optional(),
  village: z.string(),
  tenants: z.array(RoRLandDetail),
  lastUpdated: z.string().optional(),
  sourceDocument: z.string().optional(),
  mutationReferences: z.array(RoRMutationReference).optional(),
});
export type BhulekhData = z.infer<typeof BhulekhDataSchema>;

export const BhulekhContract = z.discriminatedUnion("status", [
  ContractEnvelopeBase.extend({
    source: z.literal("bhulekh"),
    status: z.literal("ok"),
    data: BhulekhDataSchema,
  }),
  ContractEnvelopeBase.extend({
    source: z.literal("bhulekh"),
    status: z.literal("no_data"),
    error: ContractError,
  }),
  ContractEnvelopeBase.extend({
    source: z.literal("bhulekh"),
    status: z.literal("source_down"),
    error: ContractError,
  }),
  ContractEnvelopeBase.extend({
    source: z.literal("bhulekh"),
    status: z.literal("invalid_input"),
    error: ContractError,
  }),
  ContractEnvelopeBase.extend({
    source: z.literal("bhulekh"),
    status: z.literal("parse_error"),
    error: ContractError,
  }),
]);
export type BhulekhContract = z.infer<typeof BhulekhContract>;

/** Re-export the existing fetcher result type so schema and type stay in sync. */
export type { RoRResult };

// ─── Adapter ──────────────────────────────────────────────────────────────────

function buildError(code: string, message: string, details?: Record<string, string>) {
  return { code, message, ...(details ? { details } : {}) } satisfies z.infer<typeof ContractError>;
}

const PARSE_ERROR_CODES = [
  "parse", "wfs_response", "wfs_response_validation_failed", "invalid_shape",
  "unexpected", "html_parse", "delta", "json", "schema",
];
const INVALID_INPUT_CODES = [
  "identifier", "not_found_in", "not_found in", "not found", "not_digitized",
  "no_bhulekh", "village_not_found", "tehsil", "unknown", "not in dictionary",
];

function classifyFailure(statusReason: string | undefined): ContractStatus {
  const lower = (statusReason ?? "").toLowerCase();
  if (PARSE_ERROR_CODES.some((c) => lower.includes(c))) return "parse_error";
  if (INVALID_INPUT_CODES.some((c) => lower.includes(c))) return "invalid_input";
  return "source_down";
}

export function mapBhulekhToContract(
  result: RoRResult,
  fetchedAt: string,
): BhulekhContract {
  const latencyMs =
    (result as unknown as { latencyMs?: number }).latencyMs ??
    (result.inputsTried?.length ? result.inputsTried.length * 1000 : 0);

  if (result.status === "success") {
    return {
      status: "ok",
      source: "bhulekh",
      data: {
        plotNo: result.data?.plotNo ?? "",
        khataNo: result.data?.khataNo,
        village: result.data?.village ?? "",
        tenants: result.data?.tenants ?? [],
        lastUpdated: result.data?.lastUpdated,
        sourceDocument: result.data?.sourceDocument,
        mutationReferences: result.data?.mutationReferences,
      },
      fetchedAt,
      sourceUrl: result.sourceDocument ?? "https://bhulekh.ori.nic.in/RoRView.aspx",
      latencyMs,
    };
  }

  const status: ContractStatus =
    result.status === "blank" || result.status === "not_found"
      ? "no_data"
      : classifyFailure(result.statusReason);

  return {
    status,
    source: "bhulekh",
    error: buildError(
      status,
      result.statusReason ?? result.error ?? "Bhulekh lookup failed",
      result.data?.village ? { village: result.data.village } : undefined,
    ),
    fetchedAt,
    sourceUrl: result.sourceDocument ?? "https://bhulekh.ori.nic.in/RoRView.aspx",
    latencyMs,
  };
}

