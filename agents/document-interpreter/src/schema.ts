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

/**
 * P2 V2 doc types: user-uploaded EC and RoR PDFs/PNGs.
 *
 * "user_upload_ec" — the user uploads an EC PDF/PNG they have
 *   (e.g. from a sub-registrar office, or a downloaded IGR EC
 *   screenshot). Sonnet is used because we don't know the source
 *   and EC text is legal in nature.
 *
 * "user_upload_ror" — the user uploads a Bhulekh RoR PDF/PNG
 *   (a screenshot of the back page, typically). Haiku is used
 *   because RoR is structured like bhulekh_back.
 *
 * "mutation_order_3g" — the user uploads a RoR with 3+ generations
 *   of mutation history and we extract a per-generation ordered
 *   sequence. Sonnet because the order field is critical and the
 *   model needs to reason about chronology.
 */
export const DocTypeSchema = z.enum([
  "igr_ec",
  "bhulekh_back",
  "user_upload_ec",
  "user_upload_ror",
  "mutation_order_3g",
]);
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
  "ai_not_purchased",
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
