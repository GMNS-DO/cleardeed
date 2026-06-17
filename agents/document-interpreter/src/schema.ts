/**
 * Zod schemas for A12 — Document Interpreter.
 *
 * Plan §3.4: FieldExtractionSchema.quote is required; plainEnglishSummary
 * lives in SummaryFieldSchema with quote optional. The union allows both
 * to coexist in `fields[]`.
 */

import { z } from "zod";

export const DocumentKindSchema = z.enum(["html", "pdfBase64", "pngBase64"]);
export type DocumentKind = z.infer<typeof DocumentKindSchema>;

export const DocumentInputSchema = z.union([
  z.object({ kind: z.literal("html"), content: z.string().min(1) }),
  z.object({ kind: z.literal("pdfBase64"), content: z.string().min(1) }),
  z.object({ kind: z.literal("pngBase64"), content: z.string().min(1) }),
]);
export type DocumentInput = z.infer<typeof DocumentInputSchema>;

export const DocTypeSchema = z.enum(["igr_ec", "bhulekh_back"]);
export type DocType = z.infer<typeof DocTypeSchema>;

export const SourceQuoteSchema = z.object({
  text: z.string().min(1),
  page: z.number().int().positive().optional(),
  bbox: z
    .object({
      x: z.number(),
      y: z.number(),
      w: z.number(),
      h: z.number(),
    })
    .optional(),
});
export type SourceQuote = z.infer<typeof SourceQuoteSchema>;

export const FieldExtractionSchema = z.object({
  field: z.string(),
  value: z.string(),
  quote: SourceQuoteSchema,
  interpretation: z.string().min(1).max(500),
  confidence: z.number().min(0).max(1),
});
export type FieldExtraction = z.infer<typeof FieldExtractionSchema>;

export const SummaryFieldSchema = z.object({
  field: z.literal("plainEnglishSummary"),
  value: z.string().min(1).max(500),
  quote: SourceQuoteSchema.optional(),
  interpretation: z.string(),
  confidence: z.number().min(0).max(1),
});
export type SummaryField = z.infer<typeof SummaryFieldSchema>;

export const FieldSchema = z.union([FieldExtractionSchema, SummaryFieldSchema]);

export const WarningSchema = z.enum([
  "low_grounding_rate",
  "no_quote_anchor",
  "low_confidence",
  "model_error",
  "rate_limited",
]);
export type Warning = z.infer<typeof WarningSchema>;

export const InterpretationResultSchema = z.object({
  docType: DocTypeSchema,
  fields: z.array(FieldSchema),
  warnings: z.array(WarningSchema),
  model: z.string(),
  costUsdCents: z.number().int().min(0),
  durationMs: z.number().int().min(0),
  cacheHit: z.boolean(),
});
export type InterpretationResult = z.infer<typeof InterpretationResultSchema>;
