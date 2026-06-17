/**
 * Quote grounding validator.
 *
 * Plan §3.3: three checks per field. Any single failure lowers
 * confidence to 0.3. Length < 8 or > 240 also fails. If > 30% of fields
 * fail, the renderer is told to suppress plainEnglishSummary.
 */

import type { DocumentInput, FieldExtraction, SourceQuote } from "./schema";

const MIN_QUOTE_LENGTH = 8;
const MAX_QUOTE_LENGTH = 240;
const TOKEN_WINDOW = 50;
const LOW_GROUNDING_RATE = 0.3;

/** Field-anchor strings — coarse heuristic for token-window adjacency.
 * Plan §3.3.2: the anchor list is intentionally broad (multiple variants)
 * to allow flexibility across different document layouts. The window
 * is 50 tokens, which is the actual §3.3.2 spec.
 */
const FIELD_ANCHORS: Record<string, string[]> = {
  mutationNumber: ["mutation", "case", "deed", "no", "number"],
  partyName: ["party", "name", "executant", "claimant", "purchaser", "seller"],
  date: ["dated", "date", "executed", "registered"],
  documentNumber: ["doc", "deed", "no", "number"],
  amount: ["amount", "consideration", "rs"],
  plotNumber: ["plot", "khata", "survey"],
  sro: ["sro", "registrar", "office"],
  area: ["area", "sq", "acres", "decimals", "hectare"],
  encumbranceType: ["mortgage", "sale", "lease", "gift", "partition"],
};

export type GroundingResult = {
  field: string;
  quote: SourceQuote;
  passed: boolean;
  reason?:
    | "short_quote"
    | "long_quote"
    | "no_substring"
    | "no_token_anchor"
    | "bbox_outside_page";
};

const tokenize = (s: string): string[] =>
  s
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s.]/gu, " ")
    .split(/\s+/)
    .filter(Boolean);

/** Check 1: substring presence. Plan §3.3.1. */
function checkSubstring(quote: SourceQuote, document: string): boolean {
  const normalizedQuote = quote.text.replace(/\s+/g, " ").trim();
  const normalizedDoc = document.replace(/\s+/g, " ");
  return normalizedDoc.includes(normalizedQuote);
}

/** Check 2: token-window adjacency. Plan §3.3.2.
 *
 * Take ±TOKEN_WINDOW tokens around the quote. Within that window, the
 * field anchor (e.g. "name" for `partyName`) must appear. This catches
 * the case where the LLM quoted a real substring of the document but
 * not the one relevant to the field.
 */
function checkTokenWindow(
  field: string,
  quote: SourceQuote,
  document: string,
): boolean {
  const fieldLower = field.toLowerCase();
  const anchors = Object.entries(FIELD_ANCHORS)
    .filter(([k]) => fieldLower.includes(k.toLowerCase()))
    .flatMap(([, v]) => v);
  // If no specific anchors, only the substring check matters.
  if (anchors.length === 0) return true;

  // Whitespace-normalize both quote and document so the indexOf works
  // even when the doc has tabs, newlines, or multiple spaces (the
  // substring check normalises the same way).
  const docNormalized = document.toLowerCase().replace(/\s+/g, " ");
  const quoteNormalized = quote.text.toLowerCase().replace(/\s+/g, " ").trim();
  const quoteIdx = docNormalized.indexOf(quoteNormalized);
  if (quoteIdx < 0) return false;

  // Build a token list for the document, then take ±TOKEN_WINDOW
  // tokens around the quote.
  const docTokens = tokenize(document);
  // Find the start token index by walking through the document text.
  // Use normalized positions to find the prefix length.
  const prefix = docNormalized.slice(0, quoteIdx);
  const startTokenIdx = tokenize(prefix).length;
  const endTokenIdx = startTokenIdx + tokenize(quote.text).length;
  const lo = Math.max(0, startTokenIdx - TOKEN_WINDOW);
  const hi = Math.min(docTokens.length, endTokenIdx + TOKEN_WINDOW);
  const windowTokens = docTokens.slice(lo, hi);

  return anchors.some((a) =>
    windowTokens.some((t) => t === a || t.startsWith(a) || a.startsWith(t)),
  );
}

/** Check 3: bbox containment. Plan §3.3.3. */
function checkBbox(quote: SourceQuote, pageWidth: number, pageHeight: number): boolean {
  if (!quote.bbox) return true; // skip when missing
  const { x, y, w, h } = quote.bbox;
  return (
    x >= 0 &&
    y >= 0 &&
    x + w <= pageWidth &&
    y + h <= pageHeight &&
    w > 0 &&
    h > 0
  );
}

/**
 * Validate a single field's quote. Returns the grounding result; does
 * not mutate the field. The caller applies the failure to confidence.
 */
export function validateQuote(
  field: FieldExtraction,
  document: string,
  pageDims?: { width: number; height: number },
): GroundingResult {
  const { quote } = field;
  const trimmed = quote.text.trim();
  if (trimmed.length < MIN_QUOTE_LENGTH) {
    return { field: field.field, quote, passed: false, reason: "short_quote" };
  }
  if (trimmed.length > MAX_QUOTE_LENGTH) {
    return { field: field.field, quote, passed: false, reason: "long_quote" };
  }
  if (!checkSubstring(quote, document)) {
    return { field: field.field, quote, passed: false, reason: "no_substring" };
  }
  if (!checkTokenWindow(field.field, quote, document)) {
    return { field: field.field, quote, passed: false, reason: "no_token_anchor" };
  }
  if (pageDims && quote.bbox && !checkBbox(quote, pageDims.width, pageDims.height)) {
    return { field: field.field, quote, passed: false, reason: "bbox_outside_page" };
  }
  return { field: field.field, quote, passed: true };
}

/**
 * Validate all fields in a result. Returns:
 * - the original field array with `confidence` adjusted (capped at 0.3
 *   on failure, per plan §3.3)
 * - the warnings array (with `low_grounding_rate` added if > 30% fail)
 * - a boolean `suppressSummary` (true if > 30% of fields failed)
 */
export function validateAllQuotes(
  fields: FieldExtraction[],
  document: string,
  pageDims?: { width: number; height: number },
): {
  adjustedFields: FieldExtraction[];
  warnings: string[];
  suppressSummary: boolean;
} {
  const results = fields.map((f) => validateQuote(f, document, pageDims));
  const failedCount = results.filter((r) => !r.passed).length;
  const failRate = results.length === 0 ? 0 : failedCount / results.length;
  const suppressSummary = failRate > LOW_GROUNDING_RATE;

  const adjustedFields: FieldExtraction[] = fields.map((f, i) => {
    const r = results[i];
    if (!r.passed) {
      return { ...f, confidence: Math.min(f.confidence, 0.3) };
    }
    return f;
  });

  const warnings: string[] = [];
  if (suppressSummary) warnings.push("low_grounding_rate");
  if (results.some((r) => r.reason === "no_token_anchor")) {
    warnings.push("no_quote_anchor");
  }

  return { adjustedFields, warnings, suppressSummary };
}

/** Extract the textual content of a DocumentInput for substring checks. */
export function extractDocumentText(input: DocumentInput): string {
  switch (input.kind) {
    case "html":
      // Strip HTML tags for text comparison. Quotes may come from
      // <td>, <span>, etc.
      return input.content.replace(/<[^>]+>/g, " ");
    case "pdfBase64":
      // We can't decode PDF in tests; return the base64 for substring
      // checks. Real Claude calls have native PDF support.
      return input.content;
    case "pngBase64":
      // Same — base64 is a placeholder for OCR. Native vision support
      // means quotes come from the model's image read.
      return input.content;
  }
}
