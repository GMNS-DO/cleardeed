/**
 * Sprint V2 — BDA Master Plan zoning fetcher contract.
 *
 * BDA zoning is a JSON-backed local lookup keyed on (village, tehsil). The
 * contract payload is an array of zone rows. The data file
 * `data/bda_zones.json` is produced by `scripts/probe/bluis-scraper.ts`;
 * an inline 10-row seed is the fallback.
 */
import { z } from "zod";
import { ContractError, ContractEnvelopeBase } from "./types";
import type { BdaZoneResult } from "@cleardeed/schema";

const ZoneId = z.enum([
  "residential",
  "commercial",
  "industrial",
  "green_belt",
  "special",
  "mixed_use",
  "institutional",
]);

const Zone = z.object({
  id: ZoneId,
  name: z.string(),
  description: z.string(),
  permittedUses: z.array(z.string()),
  restrictions: z.array(z.string()),
  zoneCode: z.string(),
});

const BdaZoneRow = z.object({
  tehsil: z.string(),
  village: z.string(),
  locality: z.string().optional(),
  zone: Zone,
  centroid: z
    .object({
      latitude: z.number(),
      longitude: z.number(),
    })
    .optional(),
});

export const BdaZoningDataSchema = z.object({
  rows: z.array(BdaZoneRow),
  parserVersion: z.string().optional(),
});
export type BdaZoningData = z.infer<typeof BdaZoningDataSchema>;

export const BdaZoningContract = z.discriminatedUnion("status", [
  ContractEnvelopeBase.extend({
    source: z.literal("bda-zoning"),
    status: z.literal("ok"),
    data: BdaZoningDataSchema,
  }),
  ContractEnvelopeBase.extend({
    source: z.literal("bda-zoning"),
    status: z.literal("no_data"),
    error: ContractError,
  }),
  ContractEnvelopeBase.extend({
    source: z.literal("bda-zoning"),
    status: z.literal("source_down"),
    error: ContractError,
  }),
  ContractEnvelopeBase.extend({
    source: z.literal("bda-zoning"),
    status: z.literal("invalid_input"),
    error: ContractError,
  }),
  ContractEnvelopeBase.extend({
    source: z.literal("bda-zoning"),
    status: z.literal("parse_error"),
    error: ContractError,
  }),
  // Plot is outside the BDA planning area (e.g., a village not in BDA's
  // Master Plan jurisdiction). Neutral outcome — not a failure.
  ContractEnvelopeBase.extend({
    source: z.literal("bda-zoning"),
    status: z.literal("out_of_scope"),
  }),
]);
export type BdaZoningContract = z.infer<typeof BdaZoningContract>;

/** Re-export the existing fetcher result type so schema and type stay in sync. */
export type { BdaZoneResult };
