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
import { ContractError, ContractEnvelopeBase } from "./types";
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
