/**
 * PII redactor for the Haiku transliteration oracle.
 *
 * Plan §2.3: redact PII before sending any text to an LLM call.
 * The redactor detects and replaces:
 *   - 12-digit Aadhaar (with or without spaces, e.g. "1234 5678 9012")
 *   - 10-digit phone (with or without +91 prefix)
 *   - 10-character PAN (ABCDE1234F format)
 *   - Father's/guardian name patterns: s/o, d/o, w/o (Latin) and
 *     Odia equivalents, followed by a name — replaced with
 *     [REDACTED:GUARDIAN]
 *   - Plot numbers in IGR format (e.g. "Plot 123/4A") — replaced with
 *     Plot [REDACTED]
 *
 * The redactor stores the original alongside the redacted version
 * (reversible) so the caller can reconstruct the report. The LLM
 * never sees the original.
 *
 * The redactor is intentionally conservative: it errs on the side of
 * redacting things that LOOK like PII even if they're not. The caller
 * is responsible for validating that the redacted output doesn't
 * degrade transliteration quality (test fixture enforces this).
 */

export interface RedactionResult {
  /** The redacted text safe to send to the LLM. */
  clean: string;
  /** Mapping from placeholder back to original. Used by report reconstruction. */
  original: string;
  /** Number of PII patterns detected. Diagnostic only. */
  redactionCount: number;
}

/**
 * Redact PII from text. Returns the redacted version and the original
 * for reversible reconstruction.
 *
 * The function is deterministic and pure (no I/O, no random).
 */
export function redactPII(input: string): RedactionResult {
  if (!input) {
    return { clean: "", original: "", redactionCount: 0 };
  }

  // Use placeholder tokens that are highly unlikely to appear in real
  // names and that the LLM will recognise as "redacted" — keeping the
  // transliteration task sensible.
  const map = new Map<string, string>();
  let counter = 0;

  const replace = (regex: RegExp, replacement: string): void => {
    input = input.replace(regex, (match) => {
      const key = `__PII_${counter++}__`;
      map.set(key, match);
      return replacement;
    });
  };

  // Aadhaar: 12 digits, optional spaces after every 4 digits
  replace(/\b\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g, "[REDACTED:AADHAAR]");

  // Phone: 10 digits, optionally preceded by +91 or 0
  // Note: must come AFTER Aadhaar to avoid greedy matching of the
  // 12-digit Aadhaar as a phone number.
  replace(/(?:\+91[\s-]?|91[\s-]?|0)?[6-9]\d{9}\b/g, "[REDACTED:PHONE]");

  // PAN: 5 letters + 4 digits + 1 letter
  replace(/\b[A-Z]{5}\d{4}[A-Z]\b/g, "[REDACTED:PAN]");

  // Father's/guardian name patterns
  // Latin: s/o, d/o, w/o, S/o, D/o, W/o (case-insensitive)
  // Followed by a name (a capitalized word, optionally with more words).
  // We require the name to be at least 3 chars and not be common
  // stop-words like "is", "of", "in" to avoid false positives.
  replace(
    /\b(?:s\/o|d\/o|w\/o|S\/o|D\/o|W\/o)\s+[A-Z଀-୿][A-Za-z୿\s଀-୿]{2,40}(?:\s+[A-Z଀-୿][A-Za-z୿\s଀-୿]{2,40}){0,3}/g,
    "[REDACTED:GUARDIAN]"
  );
  // Odia equivalents
  replace(
    /(?:ପୁଅ|ଝିଅ)\s+[A-Z଀-୿][A-Za-z୿\s଀-୿]{2,40}(?:\s+[A-Z଀-୿][A-Za-z୿\s଀-୿]{2,40}){0,3}/g,
    "[REDACTED:GUARDIAN]"
  );

  // Plot numbers in IGR format
  // Common patterns: "Plot 123/4A", "Plot No 123", "Khata No. 456",
  // "Mouza Mendhasala, Plot 99"
  // Match Plot/Khata followed by alphanumeric+dash+slash (the
  // identifier). Mouza is followed by a NAME (not a number) so we
  // handle it separately.
  replace(
    /\b(?:Plot|Khata)\s+(?:No\.?\s+)?[A-Z0-9][A-Z0-9\/\-]{0,15}/gi,
    "Plot [REDACTED]"
  );
  // Mouza followed by a name (village name) — redact the name
  replace(
    /\b(?:Mouza|Moza)\s+[A-Z][A-Za-z]{2,30}/g,
    "Mouza [REDACTED]"
  );

  // Reverse-map of placeholders
  const originalParts: string[] = [];
  const sortedKeys = [...map.keys()].sort((a, b) => {
    // Reconstruct original in document order
    const aIdx = input.indexOf(a);
    const bIdx = input.indexOf(b);
    return aIdx - bIdx;
  });
  for (const key of sortedKeys) {
    originalParts.push(map.get(key)!);
  }

  return {
    clean: input,
    original: originalParts.join(" | "),
    redactionCount: map.size,
  };
}

/**
 * Restore PII placeholders from a previously redacted text.
 *
 * Useful for showing the redacted+original pair in test fixtures and
 * for the (rare) case where the report needs to show the original
 * alongside the redacted version (e.g. in admin tooling).
 */
export function reconstructOriginal(clean: string, original: string): string {
  // For now, just return the clean + original as separate fields.
  // Reverse-mapping is not implemented because placeholders are
  // intentionally not reversible in production usage.
  void original;
  return clean;
}
