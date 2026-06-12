/**
 * Sprint V2 — Bhunaksha (plot polygon / WFS) fetcher contract.
 *
 * Bhunaksha returns the cadastral polygon for a plot plus a few metadata
 * fields. The contract is the post-parse deliverable; the live fetcher's
 * internal `PlotPolygon` type is reused for the `polygon` field.
 */
import { z } from "zod";
import { ContractError, ContractEnvelopeBase } from "./types";
import type { BhunakshaResult } from "@cleardeed/schema";

const PlotPolygon = z.object({
  type: z.literal("Polygon"),
  coordinates: z.array(z.array(z.array(z.number()))),
});

export const BhunakshaDataSchema = z.object({
  plotNo: z.string(),
  village: z.string(),
  tahasil: z.string(),
  area: z.number().optional(),
  areaUnit: z.literal("sq_km").optional(),
  shapeAreaRaw: z.number().optional(),
  shapeAreaUnit: z.literal("degrees2").optional(),
  crs: z.string().optional(),
  featureId: z.string().optional(),
  layer: z.string().optional(),
  geometryHash: z.string().optional(),
  areaComputation: z.string().optional(),
  polygon: PlotPolygon.optional(),
  classification: z.string().optional(),
  sourceDocument: z.string().optional(),
});
export type BhunakshaData = z.infer<typeof BhunakshaDataSchema>;

export const BhunakshaContract = z.discriminatedUnion("status", [
  ContractEnvelopeBase.extend({
    source: z.literal("bhunaksha"),
    status: z.literal("ok"),
    data: BhunakshaDataSchema,
  }),
  ContractEnvelopeBase.extend({
    source: z.literal("bhunaksha"),
    status: z.literal("no_data"),
    error: ContractError,
  }),
  ContractEnvelopeBase.extend({
    source: z.literal("bhunaksha"),
    status: z.literal("source_down"),
    error: ContractError,
  }),
  ContractEnvelopeBase.extend({
    source: z.literal("bhunaksha"),
    status: z.literal("invalid_input"),
    error: ContractError,
  }),
  ContractEnvelopeBase.extend({
    source: z.literal("bhunaksha"),
    status: z.literal("parse_error"),
    error: ContractError,
  }),
]);
export type BhunakshaContract = z.infer<typeof BhunakshaContract>;

/** Re-export the existing fetcher result type so schema and type stay in sync. */
export type { BhunakshaResult };
