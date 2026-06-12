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
 */
import { z } from "zod";
import { ContractError, ContractEnvelopeBase } from "./types";
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
