/**
 * Sprint V5b — IGR BMV (Benchmark Valuation) fetcher contract.
 *
 * The live IGR public BMV endpoint is `ViewFeeValue.aspx/GetMRVal` on
 * igrodisha.gov.in. It returns the official circle rate for a (district, SRO,
 * mouza, kisam) tuple. The fetcher posts JSON to that endpoint and parses
 * the response into rows of the same shape the existing circle-rate fetcher
 * uses, so the renderer swap is a 1-line change.
 *
 * The fetcher is a typed-degradation sibling: if the live endpoint is down,
 * it returns `source_down` and the pipeline falls back to the existing
 * `circle-rate` JSON seed.
 */

import { z } from "zod";

export const BMVRowSchema = z.object({
  mouza: z.string(),
  tehsil: z.string(),
  sro: z.string(),
  kisam: z.string(),
  ratePerAcre: z.number().nonnegative(),
  ratePerSqft: z.number().nonnegative(),
  ratePerDecimal: z.number().nonnegative(),
  sourceUrl: z.string().url(),
  lastUpdated: z.string(),
});
export type BMVRow = z.infer<typeof BMVRowSchema>;

export const IgrBmvDataSchema = z.object({
  rows: z.array(BMVRowSchema),
});
export type IgrBmvData = z.infer<typeof IgrBmvDataSchema>;

export const IgrBmvResultSchema = z.object({
  source: z.literal("igr-bmv"),
  status: z.enum(["success", "partial", "failed", "not_covered"]),
  statusReason: z.string(),
  verification: z.enum(["verified", "manual_required", "not_applicable"]),
  fetchedAt: z.string().datetime(),
  attempts: z.number().int().nonnegative().optional(),
  inputsTried: z
    .array(
      z.object({
        label: z.string(),
        input: z.record(z.unknown()),
      })
    )
    .optional(),
  rawArtifactHash: z.string().optional(),
  parserVersion: z.string(),
  data: IgrBmvDataSchema.optional(),
  warnings: z
    .array(
      z.object({
        code: z.string(),
        message: z.string(),
      })
    )
    .optional(),
  error: z.string().optional(),
});
export type IgrBmvResult = z.infer<typeof IgrBmvResultSchema>;
