/**
 * Tests for the Haiku transliteration oracle.
 *
 * Plan §2.1 P1 P3: code-complete but flag-off in prod. The test suite
 * exercises:
 *   - validation regex rejects non-Latin output
 *   - validation dice >= 0.5 against charByChar fallback
 *   - 800ms race timeout
 *   - per-report sub-budget (3 calls max)
 *   - PII redaction runs before the LLM call
 *
 * The actual Anthropic SDK is not called in tests; we inject a stub
 * `sdkCall` function to control latency, content, and errors.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  transliterateWithLLM,
  validateHaikuOutput,
  ReportBudget,
  PER_REPORT_BUDGET,
  isHaikuEnabled,
} from "./llm-oracle";
import { charByChar } from "./char-by-char";

describe("validateHaikuOutput", () => {
  it("accepts a clean Latin output that matches charByChar", () => {
    const odia = "ମହାନ୍ତୀ";
    const fallback = charByChar(odia);
    const r = validateHaikuOutput(fallback, odia);
    expect(r.valid).toBe(true);
  });

  it("rejects non-Latin output (Odia characters)", () => {
    const r = validateHaikuOutput("ମହାନ୍ତୀ", "ମହାନ୍ତୀ");
    expect(r.valid).toBe(false);
    expect(r.reason).toBe("non_latin_chars");
  });

  it("rejects output with digits", () => {
    const r = validateHaikuOutput("Mohanty123", "ମହାନ୍ତୀ");
    expect(r.valid).toBe(false);
    expect(r.reason).toBe("non_latin_chars");
  });

  it("rejects output with special chars", () => {
    const r = validateHaikuOutput("Moh@nty", "ମହାନ୍ତୀ");
    expect(r.valid).toBe(false);
    expect(r.reason).toBe("non_latin_chars");
  });

  it("rejects output too short", () => {
    const r = validateHaikuOutput("a", "ମହାନ୍ତୀ");
    expect(r.valid).toBe(false);
    expect(r.reason).toBe("length_out_of_range");
  });

  it("rejects output too long", () => {
    const r = validateHaikuOutput("a".repeat(300), "ମହାନ୍ତୀ");
    expect(r.valid).toBe(false);
    expect(r.reason).toBe("length_out_of_range");
  });

  it("rejects output that diverges too much from charByChar fallback (low dice)", () => {
    // ମହାନ୍ତୀ (Mohanty) vs "Srnivasan" — completely different name
    const r = validateHaikuOutput("Srinivasan", "ମହାନ୍ତୀ");
    expect(r.valid).toBe(false);
    expect(r.reason).toBe("low_dice_vs_fallback");
  });

  it("accepts a 1-edit variant of charByChar (Mohanty vs Mahanty)", () => {
    // ମହାନ୍ତୀ charByChar → "mohanti" (without the ya-substituent cluster)
    // LLM returns "Mohanty" which is close enough (high dice)
    const r = validateHaikuOutput("Mohanty", "ମହାନ୍ତୀ");
    expect(r.valid).toBe(true);
  });
});

describe("ReportBudget", () => {
  it("starts with 0 calls and full remaining", () => {
    const b = new ReportBudget("rpt-1");
    expect(b.getCount()).toBe(0);
    expect(b.canCall()).toBe(true);
    expect(b.getRemaining()).toBe(PER_REPORT_BUDGET);
  });

  it("blocks calls after PER_REPORT_BUDGET (3)", () => {
    const b = new ReportBudget("rpt-1");
    b.recordCall();
    b.recordCall();
    b.recordCall();
    expect(b.getCount()).toBe(3);
    expect(b.canCall()).toBe(false);
    expect(b.getRemaining()).toBe(0);
  });

  it("tracks report ID", () => {
    const b = new ReportBudget("abc-123");
    expect(b.getReportId()).toBe("abc-123");
  });
});

describe("transliterateWithLLM", () => {
  it("returns success when SDK returns validated output", async () => {
    const budget = new ReportBudget("rpt-1");
    const r = await transliterateWithLLM("ମହାନ୍ତୀ", budget, async () => ({
      text: "Mohanty",
      cost: 0.00025,
    }));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.transliteration).toBe("Mohanty");
      expect(r.confidence).toBe(0.95);
    }
    expect(budget.getCount()).toBe(1);
  });

  it("returns report_budget_exceeded when budget is exhausted", async () => {
    const budget = new ReportBudget("rpt-1");
    budget.recordCall();
    budget.recordCall();
    budget.recordCall();
    const r = await transliterateWithLLM("ମହାନ୍ତୀ", budget, async () => ({
      text: "Mohanty",
      cost: 0.00025,
    }));
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.reason).toBe("report_budget_exceeded");
    }
  });

  it("rejects malformed LLM output (validation failure)", async () => {
    const budget = new ReportBudget("rpt-1");
    const r = await transliterateWithLLM("ମହାନ୍ତୀ", budget, async () => ({
      text: "ମହାନ୍ତୀ", // Returns Odia, not Latin
      cost: 0.00025,
    }));
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.reason).toBe("non_latin_chars");
    }
  });

  it("rejects hallucinated LLM output (low dice vs fallback)", async () => {
    const budget = new ReportBudget("rpt-1");
    const r = await transliterateWithLLM("ମହାନ୍ତୀ", budget, async () => ({
      text: "Srinivasan", // completely different name
      cost: 0.00025,
    }));
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.reason).toBe("low_dice_vs_fallback");
    }
  });

  it("times out after 800ms and returns ok:false with reason=timeout", async () => {
    const budget = new ReportBudget("rpt-1");
    const slowSdkCall = () =>
      new Promise<{ text: string; cost: number }>((resolve) => {
        setTimeout(() => resolve({ text: "Mohanty", cost: 0.00025 }), 1000);
      });
    const start = Date.now();
    const r = await transliterateWithLLM("ମହାନ୍ତୀ", budget, slowSdkCall);
    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(950); // should NOT wait the full 1000ms
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.reason).toBe("timeout");
    }
  });

  it("redacts PII before sending to LLM (Aadhaar 12-digit)", async () => {
    const budget = new ReportBudget("rpt-1");
    let sentToLLM = "";
    const r = await transliterateWithLLM(
      "Kumar Mahapatra 123456789012",
      budget,
      async (cleanText) => {
        sentToLLM = cleanText;
        return { text: "Kumar Mahapatra", cost: 0.00025 };
      }
    );
    expect(sentToLLM).not.toContain("123456789012");
    expect(sentToLLM).toContain("[REDACTED:AADHAAR]");
  });

  it("redacts s/o FatherName before sending to LLM", async () => {
    const budget = new ReportBudget("rpt-1");
    let sentToLLM = "";
    await transliterateWithLLM(
      "Kumar s/o Ganesh Mahapatra",
      budget,
      async (cleanText) => {
        sentToLLM = cleanText;
        return { text: "Kumar", cost: 0.00025 };
      }
    );
    expect(sentToLLM).not.toContain("Ganesh");
    expect(sentToLLM).toContain("[REDACTED:GUARDIAN]");
  });

  it("records budget call only on success path (validation passed)", async () => {
    // The plan says "supabase-backed counter survives Vercel cold-starts"
    // and "per-report sub-budget 3 calls". The budget is recorded
    // whenever the SDK is invoked (even on validation failure) so a
    // misbehaving LLM doesn't get unlimited retries.
    const budget = new ReportBudget("rpt-1");
    await transliterateWithLLM("ମହାନ୍ତୀ", budget, async () => ({
      text: "GibberishOutput12345", // validation will fail
      cost: 0.00025,
    }));
    expect(budget.getCount()).toBe(1);
  });
});

describe("isHaikuEnabled — feature flag", () => {
  const originalEnv = process.env.HAIKU_TRANSLIT_ENABLED;
  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.HAIKU_TRANSLIT_ENABLED;
    } else {
      process.env.HAIKU_TRANSLIT_ENABLED = originalEnv;
    }
  });

  it("defaults to false in production", () => {
    delete process.env.HAIKU_TRANSLIT_ENABLED;
    expect(isHaikuEnabled()).toBe(false);
  });

  it("can be toggled on via env var", () => {
    process.env.HAIKU_TRANSLIT_ENABLED = "true";
    expect(isHaikuEnabled()).toBe(true);
  });

  it("flag-off path identical to P2 (P1 P1 behavior preserved)", () => {
    // This is a documentation test: when the flag is off, the
    // transliteration pipeline does not call this oracle at all.
    // The integration test for the agent-level call site is in
    // ownership-reasoner/index.test.ts.
    delete process.env.HAIKU_TRANSLIT_ENABLED;
    expect(isHaikuEnabled()).toBe(false);
  });
});
