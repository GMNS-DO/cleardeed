/**
 * Contract schema for IGR SRO (Sub-Registrar Office) fetcher.
 *
 * Maps tahasil → SRO with contact details, EC portal URL, and operational metadata.
 * Used to generate precise manual EC retrieval instructions for the buyer report.
 */

import { z } from "zod";

export const SROInfoSchema = z.object({
  sro: z.string(),
  sroCode: z.string(),
  tahasilPatterns: z.array(z.string()),
  address: z.string(),
  contactUrl: z.string().url(),
  ecUrl: z.string().url(),
  operatingHours: z.string(),
  estimatedFee: z.string(),
  expectedTime: z.string(),
});

export const SROCacheSchema = z.object({
  version: z.string(),
  lastUpdated: z.string(),
  districts: z.array(
    z.object({
      district: z.string(),
      sros: z.array(SROInfoSchema),
    })
  ),
});

export const SROLookupResultSchema = z.object({
  source: z.literal("igr-sro"),
  status: z.enum(["success", "not_found", "error"]),
  statusReason: z.string(),
  fetchedAt: z.string(),
  parserVersion: z.string(),
  data: z
    .object({
      district: z.string(),
      sro: z.string(),
      sroCode: z.string(),
      address: z.string(),
      contactUrl: z.string().url(),
      ecUrl: z.string().url(),
      operatingHours: z.string(),
      estimatedFee: z.string(),
      expectedTime: z.string(),
      matchedTahasilPattern: z.string().optional(),
    })
    .nullable(),
  warnings: z.array(
    z.object({
      code: z.string(),
      message: z.string(),
    })
  ),
});

export type SROInfo = z.infer<typeof SROInfoSchema>;
export type SROCache = z.infer<typeof SROCacheSchema>;
export type SROLookupResult = z.infer<typeof SROLookupResultSchema>;
