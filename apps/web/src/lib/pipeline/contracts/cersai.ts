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
