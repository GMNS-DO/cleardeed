/**
 * Sprint V2 — Nominatim (OSM geocoder) fetcher contract.
 *
 * Nominatim is used as a village-centroid resolver before Bhunaksha WFS
 * queries. The contract payload is the structured `displayName` plus the
 * address components used downstream.
 */
import { z } from "zod";
import { ContractError, ContractEnvelopeBase } from "./types";
import type { NominatimResult } from "@cleardeed/schema";

export const NominatimDataSchema = z.object({
  displayName: z.string(),
  village: z.string().optional(),
  tahasil: z.string().optional(),
  district: z.string().optional(),
  state: z.string().optional(),
  postcode: z.string().optional(),
  category: z.string().optional(),
  sourceFetchedAt: z.string().datetime().optional(),
  cacheServedAt: z.string().datetime().optional(),
});
export type NominatimData = z.infer<typeof NominatimDataSchema>;

export const NominatimContract = z.discriminatedUnion("status", [
  ContractEnvelopeBase.extend({
    source: z.literal("nominatim"),
    status: z.literal("ok"),
    data: NominatimDataSchema,
  }),
  ContractEnvelopeBase.extend({
    source: z.literal("nominatim"),
    status: z.literal("no_data"),
    error: ContractError,
  }),
  ContractEnvelopeBase.extend({
    source: z.literal("nominatim"),
    status: z.literal("source_down"),
    error: ContractError,
  }),
  ContractEnvelopeBase.extend({
    source: z.literal("nominatim"),
    status: z.literal("invalid_input"),
    error: ContractError,
  }),
  ContractEnvelopeBase.extend({
    source: z.literal("nominatim"),
    status: z.literal("parse_error"),
    error: ContractError,
  }),
]);
export type NominatimContract = z.infer<typeof NominatimContract>;

/** Re-export the existing fetcher result type so schema and type stay in sync. */
export type { NominatimResult };
