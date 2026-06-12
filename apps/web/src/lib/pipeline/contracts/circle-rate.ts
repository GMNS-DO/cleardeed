/**
 * Sprint V2 — Circle Rate (IGR benchmark valuation) fetcher contract.
 *
 * Circle Rate is a JSON-backed local lookup keyed on (mouza, tehsil, kisam).
 * Source URL is the IGR BMV page, but the data is loaded from a local file
 * (or the inline seed fallback). The contract payload is an array of rows.
 */
import { z } from "zod";
import { ContractError, ContractEnvelopeBase } from "./types";
import type { CircleRateResult } from "@cleardeed/schema";

const CircleRateRow = z.object({
  mouza: z.string(),
  tehsil: z.string(),
  kisam: z.string(),
  ratePerAcre: z.number(),
  ratePerSqft: z.number(),
  sourceUrl: z.string(),
  lastUpdated: z.string(),
  rateType: z.enum(["rural", "urban", "peri-urban"]),
});

export const CircleRateDataSchema = z.object({
  rows: z.array(CircleRateRow),
  parserVersion: z.string().optional(),
});
export type CircleRateData = z.infer<typeof CircleRateDataSchema>;

export const CircleRateContract = z.discriminatedUnion("status", [
  ContractEnvelopeBase.extend({
    source: z.literal("circle-rate"),
    status: z.literal("ok"),
    data: CircleRateDataSchema,
  }),
  ContractEnvelopeBase.extend({
    source: z.literal("circle-rate"),
    status: z.literal("no_data"),
    error: ContractError,
  }),
  ContractEnvelopeBase.extend({
    source: z.literal("circle-rate"),
    status: z.literal("source_down"),
    error: ContractError,
  }),
  ContractEnvelopeBase.extend({
    source: z.literal("circle-rate"),
    status: z.literal("invalid_input"),
    error: ContractError,
  }),
  ContractEnvelopeBase.extend({
    source: z.literal("circle-rate"),
    status: z.literal("parse_error"),
    error: ContractError,
  }),
]);
export type CircleRateContract = z.infer<typeof CircleRateContract>;

/** Re-export the existing fetcher result type so schema and type stay in sync. */
export type { CircleRateResult };
