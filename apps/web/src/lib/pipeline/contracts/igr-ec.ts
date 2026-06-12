/**
 * Sprint V2 — IGR Odisha EC (Encumbrance Certificate) fetcher contract.
 *
 * The IGR EC fetcher primarily returns *instructions* (the EC must be
 * obtained manually from the SRO for a fee), not a structured payload. The
 * V1 contract treats this as `no_data` (correct in the buyer sense — the
 * report can't display an EC) and surfaces the structured `instructions` text
 * alongside. V2 keeps the same shape: an `ok` result carries the entries;
 * anything else is a structured error.
 */
import { z } from "zod";
import { ContractError, ContractEnvelopeBase } from "./types";
import type { IGRECResult } from "@cleardeed/schema";

const EncumbranceEntry = z.object({
  docType: z.string().optional(),
  docNo: z.string().optional(),
  regDate: z.string().optional(),
  party1: z.string().optional(),
  party2: z.string().optional(),
  propertyDesc: z.string().optional(),
  consideration: z.string().optional(),
  marketValue: z.string().optional(),
});

export const IgrEcDataSchema = z.object({
  ecAvailable: z.boolean(),
  ecDocumentRef: z.string().optional(),
  entries: z.array(EncumbranceEntry).optional(),
  searchPeriod: z
    .object({ from: z.string(), to: z.string() })
    .optional(),
  sro: z.string().optional(),
  district: z.string().optional(),
  fee: z.number().optional(),
  feeCurrency: z.string().optional(),
  instructions: z.string().optional(),
});
export type IgrEcData = z.infer<typeof IgrEcDataSchema>;

export const IgrEcContract = z.discriminatedUnion("status", [
  ContractEnvelopeBase.extend({
    source: z.literal("igr-ec"),
    status: z.literal("ok"),
    data: IgrEcDataSchema,
  }),
  ContractEnvelopeBase.extend({
    source: z.literal("igr-ec"),
    status: z.literal("no_data"),
    error: ContractError,
  }),
  ContractEnvelopeBase.extend({
    source: z.literal("igr-ec"),
    status: z.literal("source_down"),
    error: ContractError,
  }),
  ContractEnvelopeBase.extend({
    source: z.literal("igr-ec"),
    status: z.literal("invalid_input"),
    error: ContractError,
  }),
  ContractEnvelopeBase.extend({
    source: z.literal("igr-ec"),
    status: z.literal("parse_error"),
    error: ContractError,
  }),
]);
export type IgrEcContract = z.infer<typeof IgrEcContract>;

/** Re-export the existing fetcher result type so schema and type stay in sync. */
export type { IGRECResult };
