/**
 * Sprint V5b — IGR Daily Bulletin fetcher contract.
 *
 * The live endpoint is `ORServiceNew.aspx/GetDataFromDB` on igrodisha.gov.in.
 * It returns registration activity for a date range, including deed counts,
 * consideration totals, and district-level SRO breakdown. The buyer's report
 * uses this as a velocity signal: "X deeds registered in Khordha in the last
 * N days."
 */

import { z } from "zod";

export const DailyBulletinDaySchema = z.object({
  date: z.string(),
  district: z.string(),
  sro: z.string().optional(),
  deedType: z.string().optional(),
  count: z.number().int().nonnegative(),
  considerationTotal: z.number().nonnegative(),
});
export type DailyBulletinDay = z.infer<typeof DailyBulletinDaySchema>;

export const IgrDailyBulletinDataSchema = z.object({
  days: z.array(DailyBulletinDaySchema),
  dateRange: z.object({
    from: z.string(),
    to: z.string(),
  }),
  district: z.string().optional(),
  summary: z
    .object({
      totalDeeds: z.number().int().nonnegative().optional(),
      totalConsideration: z.number().nonnegative().optional(),
      avgDeedsPerDay: z.number().nonnegative().optional(),
    })
    .optional(),
});
export type IgrDailyBulletinData = z.infer<typeof IgrDailyBulletinDataSchema>;

export const IgrDailyBulletinResultSchema = z.object({
  source: z.literal("igr-daily-bulletin"),
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
  data: IgrDailyBulletinDataSchema.optional(),
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
export type IgrDailyBulletinResult = z.infer<typeof IgrDailyBulletinResultSchema>;
