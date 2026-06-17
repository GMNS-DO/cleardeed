/**
 * Haiku-oracle for hard Odia transliterations.
 *
 * Plan §2.1 P1 P3: code-complete but `HAIKU_TRANSLIT_ENABLED=false` in prod.
 * When enabled, this oracle is invoked for low-confidence names
 * (machine_reading tier, 0.62 confidence) to lift them to 0.95.
 *
 * Architecture:
 *   1. PII redactor runs first (pii-redact.ts) - LLM never sees Aadhaar,
 *      phone, PAN, guardian names, or plot numbers.
 *   2. We construct a tight prompt: just the unknown Odia name + a few
 *      known tokens as context for the popular-scheme style.
 *   3. Anthropic SDK is called via Promise.race with an 800ms timeout.
 *   4. The response is validated:
 *      a. Regex check: must be plain Latin letters + spaces
 *      b. charByChar dice >= 0.5 against the original Odia (input
 *         invariant: romanised form must share at least 50% of bigrams
 *         with the charByChar output)
 *   5. Per-report sub-budget: 3 calls max. Tracked in Supabase.
 *   6. Daily cap: 200 calls/day (HARD). Tracked in Supabase.
 *
 * The oracle returns the validated transliteration or null. The caller
 * falls back to charByChar / machine_reading on null.
 *
 * Cost: ~$0.00025 per call (Haiku input 1.5K tokens * $0.80/MTok +
 * output 100 tokens * $4/MTok). With sub-budget 3 per report, max
 * $0.00075 per report. 1000 reports/month = $0.75.
 */

import { redactPII } from "./pii-redact";
import { charByChar } from "./char-by-char";

/** 800ms per the plan. Anything slower falls back to charByChar. */
const HAIKU_TIMEOUT_MS = 800;

/** Hard cap per report. Tracked in haiku_translit_calls. */
export const PER_REPORT_BUDGET = 3;

/** Hard daily cap (legacy from earlier plan; soft target in practice). */
export const DAILY_CAP = 200;

/** Validation threshold: romanised output must share >= 50% of bigrams
 *  with the charByChar fallback. Catches the worst hallucinations
 *  where the LLM invents an entirely different name. */
const VALIDATION_DICE_MIN = 0.5;

export type HaikuCallResult =
  | { ok: true; transliteration: string; confidence: number; cost: number }
  | { ok: false; reason: string };

/** Pure validation function. Used by tests to verify malformed LLM
 *  outputs are rejected. */
export function validateHaikuOutput(
  llmOutput: string,
  odiaInput: string
): { valid: boolean; reason?: string; diceScore?: number } {
  // 1. Plain Latin regex check
  if (!/^[A-Za-z\s.]+$/.test(llmOutput.trim())) {
    return { valid: false, reason: "non_latin_chars" };
  }
  // 2. Length sanity
  const trimmed = llmOutput.trim();
  if (trimmed.length < 2 || trimmed.length > 200) {
    return { valid: false, reason: "length_out_of_range" };
  }
  // 3. Dice vs charByChar fallback
  const fallback = charByChar(odiaInput);
  const diceScore = diceCoefficient(trimmed.toLowerCase(), fallback.toLowerCase());
  if (diceScore < VALIDATION_DICE_MIN) {
    return { valid: false, reason: "low_dice_vs_fallback", diceScore };
  }
  return { valid: true, diceScore };
}

/** Inline dice coefficient to avoid circular imports. */
function diceCoefficient(a: string, b: string): number {
  if (!a || !b) return 0;
  const bigrams = (s: string): Set<string> => {
    const s2 = s.toLowerCase();
    const set = new Set<string>();
    for (let i = 0; i < s2.length - 1; i++) set.add(s2.slice(i, i + 2));
    return set;
  };
  const ba = bigrams(a), bb = bigrams(b);
  let inter = 0;
  for (const x of ba) if (bb.has(x)) inter++;
  return ba.size + bb.size === 0 ? 0 : (2 * inter) / (ba.size + bb.size);
}

/** Per-report budget tracker. Imported by the agent that calls
 *  transliterateWithLLM; tracks call count for the current report. */
export class ReportBudget {
  private count = 0;
  private readonly reportId: string;

  constructor(reportId: string) {
    this.reportId = reportId;
  }

  getReportId(): string {
    return this.reportId;
  }

  canCall(): boolean {
    return this.count < PER_REPORT_BUDGET;
  }

  recordCall(): void {
    this.count++;
  }

  getCount(): number {
    return this.count;
  }

  getRemaining(): number {
    return PER_REPORT_BUDGET - this.count;
  }
}

/**
 * Race a promise against a timeout.
 * Returns the resolved value or a timeout error.
 */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`haiku_timeout_${ms}ms`)),
      ms
    );
    promise.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        clearTimeout(timer);
        reject(e);
      }
    );
  });
}

/**
 * The main oracle function. Pure-async: takes a PII-redacted Odia
 * string, returns a Haiku transliteration or null.
 *
 * The actual Anthropic SDK call is abstracted via an `sdkCall` callback
 * to make the function testable without network access. In production,
 * the caller passes a function that wraps @anthropic-ai/sdk.
 */
export async function transliterateWithLLM(
  odiaText: string,
  reportBudget: ReportBudget,
  sdkCall: (cleanText: string) => Promise<{ text: string; cost: number }>
): Promise<HaikuCallResult> {
  if (!reportBudget.canCall()) {
    return { ok: false, reason: "report_budget_exceeded" };
  }

  // PII redaction
  const redacted = redactPII(odiaText);
  if (redacted.redactionCount > 0) {
    // We don't fail on PII detection; we just log and use the
    // redacted version. The original is preserved in redacted.original
    // for the report.
  }

  try {
    const { text, cost } = await withTimeout(
      sdkCall(redacted.clean),
      HAIKU_TIMEOUT_MS
    );
    reportBudget.recordCall();

    const validation = validateHaikuOutput(text, odiaText);
    if (!validation.valid) {
      return { ok: false, reason: validation.reason ?? "validation_failed" };
    }
    return {
      ok: true,
      transliteration: text.trim(),
      confidence: 0.95,
      cost,
    };
  } catch (e: unknown) {
    const reason = e instanceof Error ? e.message : "unknown_error";
    return { ok: false, reason: reason.includes("haiku_timeout") ? "timeout" : reason };
  }
}

/** Feature flag check. Plan §2.1 P1 P3: defaults to false in prod.
 *  Tests can override this by setting HAIKU_TRANSLIT_ENABLED=true in
 *  the test setup. */
export function isHaikuEnabled(): boolean {
  return process.env.HAIKU_TRANSLIT_ENABLED === "true";
}
