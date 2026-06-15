/**
 * Sprint V5c — IGR Odisha Government Fee Schedule fetcher contract.
 *
 * The GovtFeeDtls.aspx page is server-rendered with no JSON API. Per D-046
 * (Sprint V5c), we ship a permanent typed cache of the schedule as a JSON
 * seed (data/odisha_govt_fee_schedule.json). The schedule rarely changes
 * (last substantive revision 2019); re-validate when `lastUpdated` is
 * older than 2 years.
 *
 * The fetcher loads the seed at module init, validates it against the
 * Zod schema, and returns it as a `success` envelope. No network call.
 */

import { z } from "zod";

export const DeedFeeSchema = z.object({
  category: z.string(),
  minStampINR: z.number().nonnegative(),
  stampPct: z.number().nonnegative(),
  registrationFeePct: z.number().nonnegative(),
  rorPostalFeeINR: z.number().nonnegative(),
  userFeeINR: z.number().nonnegative(),
  notes: z.string(),
});
export type DeedFee = z.infer<typeof DeedFeeSchema>;

export const EncumbranceCertificateFeeSchema = z.object({
  generalSearchFirstYearINR: z.number().nonnegative(),
  everySubsequentYearINR: z.number().nonnegative(),
  otherPropertyINR: z.number().nonnegative(),
  applicationFeeINR: z.number().nonnegative(),
  userChargesINR: z.number().nonnegative(),
  userChargesMaxINR: z.number().nonnegative(),
  notes: z.string(),
});
export type EncumbranceCertificateFee = z.infer<
  typeof EncumbranceCertificateFeeSchema
>;

export const CertifiedCopyFeeSchema = z.object({
  searchPerPartyINR: z.number().nonnegative(),
  inspectionFeeINR: z.number().nonnegative(),
  copyingFeePerPageINR: z.number().nonnegative(),
  immediateDeliveryINR: z.number().nonnegative(),
  applicationFeeINR: z.number().nonnegative(),
  userChargesPerPageINR: z.number().nonnegative(),
  userChargesMaxINR: z.number().nonnegative(),
  notes: z.string(),
});
export type CertifiedCopyFee = z.infer<typeof CertifiedCopyFeeSchema>;

export const AdditionalPerPlotFeesSchema = z.object({
  perPlotDemarcationFeeINR: z.number().nonnegative(),
  rorPostalDeliveryFeeINR: z.number().nonnegative(),
  perKhataRORUserFeeINR: z.number().nonnegative(),
});
export type AdditionalPerPlotFees = z.infer<typeof AdditionalPerPlotFeesSchema>;

export const GovtFeeScheduleSchema = z.object({
  source: z.string().url(),
  lastUpdated: z.string(),
  notes: z.string(),
  deedFees: z.array(DeedFeeSchema),
  encumbranceCertificate: EncumbranceCertificateFeeSchema,
  certifiedCopy: CertifiedCopyFeeSchema,
  additionalPerPlotFees: AdditionalPerPlotFeesSchema,
});
export type GovtFeeSchedule = z.infer<typeof GovtFeeScheduleSchema>;

export const GovtFeeDataSchema = z.object({
  schedule: GovtFeeScheduleSchema,
  /** Convenience: matches the requested deed category, or null. */
  matchedDeedFee: DeedFeeSchema.nullable(),
});
export type GovtFeeData = z.infer<typeof GovtFeeDataSchema>;

export const GovtFeeResultSchema = z.object({
  source: z.literal("govt-fee"),
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
  parserVersion: z.string(),
  data: GovtFeeDataSchema.optional(),
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
export type GovtFeeResult = z.infer<typeof GovtFeeResultSchema>;
