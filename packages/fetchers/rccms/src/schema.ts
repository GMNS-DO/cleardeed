import { z } from "zod";

const SourceResultSchemaBase = z.object({
  source: z.string(),
  status: z.enum(["success", "partial", "failed", "error"]),
  verification: z.enum(["verified", "unverified", "manual_required", "error"]).optional(),
  fetchedAt: z.string(),
  data: z.record(z.unknown()).optional(),
  error: z.string().optional(),
});

export const RCCMSCaseSchema = z.object({
  caseId: z.string(),
  caseType: z.string(),
  petitioner: z.string(),
  respondent: z.string(),
  status: z.string(),
  filingDate: z.string(),
  nextHearingDate: z.string().optional(),
});

export const RCCMSResultDataSchema = z.object({
  total: z.number(),
  cases: z.array(RCCMSCaseSchema),
});

export const RCCMSResultSchema = SourceResultSchemaBase.extend({
  source: z.literal("rccms"),
  data: RCCMSResultDataSchema.optional(),
});

export type RCCMSResult = z.infer<typeof RCCMSResultSchema>;