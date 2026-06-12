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
import { ContractError, ContractEnvelopeBase } from "./types";
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
