/**
 * Sprint V5b — Stamp duty fetcher contract.
 *
 * The live endpoint is `StampDutyCalc.aspx/GetDoMRVal` on igrodisha.gov.in.
 * Given a (district, deed type, market value) tuple, it returns the
 * government-expected stamp duty + registration fee + total payable. The
 * report uses this to cross-check the seller's quoted price: if the buyer
 * agrees to a price below the government-expected stamp duty minimum (the
 * BMV), the report flags it as a Section-5 sub-card.
 */

import { z } from "zod";

export const StampDutyBreakupSchema = z.object({
  stampDuty: z.number().nonnegative(),
  registrationFee: z.number().nonnegative(),
  cess: z.number().nonnegative().optional(),
  surcharge: z.number().nonnegative().optional(),
  totalPayable: z.number().nonnegative(),
  calculationBasis: z.string(),
  /** The minimum market value the government applied (may be ≥ user input). */
  appliedMarketValue: z.number().nonnegative(),
  /** The market value the user / pipeline passed in. */
  requestedMarketValue: z.number().nonnegative(),
  /** True if the government bumped market value up to the BMV. */
  bmvFloorApplied: z.boolean(),
});
export type StampDutyBreakup = z.infer<typeof StampDutyBreakupSchema>;

export const StampDutyDataSchema = z.object({
  breakup: StampDutyBreakupSchema,
});
export type StampDutyData = z.infer<typeof StampDutyDataSchema>;

export const StampDutyResultSchema = z.object({
  source: z.literal("stamp-duty"),
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
  data: StampDutyDataSchema.optional(),
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
export type StampDutyResult = z.infer<typeof StampDutyResultSchema>;
