/**
 * Tests for PII redactor.
 *
 * Plan §2.3: 20 input cases. All redacted strings must contain:
 *   - no 12-digit runs (Aadhaar)
 *   - no 10-digit phone-shaped runs (Indian mobile)
 *   - no s/o X / d/o X / w/o X patterns
 *   - no PAN-shaped runs
 *   - no plot numbers
 */
import { describe, it, expect } from "vitest";
import { redactPII } from "./pii-redact";

describe("redactPII — Aadhaar (12 digits)", () => {
  it("redacts bare 12-digit Aadhaar", () => {
    const r = redactPII("My Aadhaar is 123456789012");
    expect(r.clean).toBe("My Aadhaar is [REDACTED:AADHAAR]");
    expect(r.redactionCount).toBe(1);
  });
  it("redacts 4-4-4 spaced Aadhaar", () => {
    const r = redactPII("Aadhaar: 1234 5678 9012");
    expect(r.clean).toBe("Aadhaar: [REDACTED:AADHAAR]");
  });
  it("redacts 4-4-4 dashed Aadhaar", () => {
    const r = redactPII("Aadhaar: 1234-5678-9012");
    expect(r.clean).toBe("Aadhaar: [REDACTED:AADHAAR]");
  });
  it("does not redact 11-digit numbers (too short to be Aadhaar)", () => {
    const r = redactPII("Order #12345678901");
    // 11 digits is not an Aadhaar. Phone pattern may still match if
    // it starts with 6-9.
    expect(r.clean).toBe("Order #12345678901");
  });
});

describe("redactPII — Phone (10 digits, Indian mobile)", () => {
  it("redacts bare 10-digit phone starting with 9", () => {
    const r = redactPII("Call 9876543210 for details");
    expect(r.clean).toBe("Call [REDACTED:PHONE] for details");
  });
  it("redacts +91 phone", () => {
    const r = redactPII("Phone: +91 9876543210");
    expect(r.clean).toBe("Phone: [REDACTED:PHONE]");
  });
  it("redacts 91-prefixed phone (no plus)", () => {
    const r = redactPII("Phone: 91 9876543210");
    expect(r.clean).toBe("Phone: [REDACTED:PHONE]");
  });
  it("does not redact 10-digit number starting with 0-5 (not mobile)", () => {
    // Indian landlines start with 0, not mobile. Our pattern requires 6-9.
    // Actually 0-prefixed mobiles are also valid in some cases. Be lenient
    // and don't redact 0-prefixed (landline) numbers.
    const r = redactPII("Landline 01123456789");
    // 0112345678 is 10 digits starting with 0 - we redact it as it's
    // potentially a phone. The pattern matches optional 0/91/+91.
    // Actually our pattern is (?:\+91[\s-]?|91[\s-]?|0)?[6-9]\d{9}\b
    // The 0-prefixed then 1123456789 (starts with 1) wouldn't match.
    expect(r.clean).toBe("Landline 01123456789");
  });
});

describe("redactPII — PAN", () => {
  it("redacts valid PAN", () => {
    const r = redactPII("PAN: ABCDE1234F");
    expect(r.clean).toBe("PAN: [REDACTED:PAN]");
  });
  it("does not redact lowercase PAN (not the canonical form)", () => {
    const r = redactPII("pan: abcde1234f");
    // Lowercase PAN doesn't match the uppercase pattern. We accept
    // this for now — admin tools can uppercase before sending.
    expect(r.clean).toBe("pan: abcde1234f");
  });
});

describe("redactPII — Guardian/parent patterns", () => {
  it("redacts s/o FatherName", () => {
    const r = redactPII("Kumar Mahapatra s/o Ganesh Mahapatra");
    expect(r.clean).toBe("Kumar Mahapatra [REDACTED:GUARDIAN]");
  });
  it("redacts d/o FatherName (daughter)", () => {
    const r = redactPII("Sunita d/o Ramakant Behera");
    expect(r.clean).toBe("Sunita [REDACTED:GUARDIAN]");
  });
  it("redacts w/o HusbandName (wife)", () => {
    const r = redactPII("Laxmi w/o Ramesh Sahoo");
    expect(r.clean).toBe("Laxmi [REDACTED:GUARDIAN]");
  });
  it("redacts Odia ପୁଅ FatherName", () => {
    const r = redactPII("କୁମାର ପୁଅ ଗଣେଶ ମହାପାତ୍ର");
    expect(r.clean).toBe("କୁମାର [REDACTED:GUARDIAN]");
  });
  it("does not redact S/O followed by lowercase (no proper name)", () => {
    // The regex requires the name after S/O to start with a capital
    // letter. If the next word is lowercase ("is", "the", etc.), it's
    // not a name, so we don't redact.
    const r = redactPII("His S/O is in Bhubaneswar");
    expect(r.clean).toBe("His S/O is in Bhubaneswar");
  });
});

describe("redactPII — Plot numbers", () => {
  it("redacts IGR plot number", () => {
    const r = redactPII("Plot 123/4A, Khordha");
    expect(r.clean).toBe("Plot [REDACTED], Khordha");
  });
  it("redacts Plot No. pattern", () => {
    const r = redactPII("Plot No. 5678/2B");
    expect(r.clean).toBe("Plot [REDACTED]");
  });
  it("redacts Khata No. pattern", () => {
    const r = redactPII("Khata No. 456/3");
    // Plan §2.3 specifies the replacement as "Plot [REDACTED]" for
    // all plot-number patterns (Plot, Plot No., Khata No., etc.).
    expect(r.clean).toBe("Plot [REDACTED]");
  });
  it("redacts Mouza pattern", () => {
    const r = redactPII("Mouza Mendhasala, Plot 99");
    expect(r.clean).toBe("Mouza [REDACTED], Plot [REDACTED]");
  });
});

describe("redactPII — multi-PII and edge cases", () => {
  it("redacts multiple PII types in one input", () => {
    const r = redactPII("Plot 123/4A, Aadhaar 1234 5678 9012, s/o Ganesh");
    expect(r.clean).toBe(
      "Plot [REDACTED], Aadhaar [REDACTED:AADHAAR], [REDACTED:GUARDIAN]"
    );
    expect(r.redactionCount).toBe(3);
  });
  it("handles empty input", () => {
    const r = redactPII("");
    expect(r.clean).toBe("");
    expect(r.redactionCount).toBe(0);
  });
  it("handles input with no PII (just a name)", () => {
    const r = redactPII("Kumar Mahapatra");
    expect(r.clean).toBe("Kumar Mahapatra");
    expect(r.redactionCount).toBe(0);
  });
  it("preserves Odia script in non-PII parts", () => {
    const r = redactPII("କୁମାର ମହାନ୍ତୀ ପୁଅ ଗଣେଶ");
    expect(r.clean).toBe("କୁମାର ମହାନ୍ତୀ [REDACTED:GUARDIAN]");
  });
  it("returns original field for diagnostic logging", () => {
    const r = redactPII("Aadhaar 123456789012");
    expect(r.original).toContain("123456789012");
    expect(r.redactionCount).toBe(1);
  });
});

describe("redactPII — total count gate (plan §2.3 20 fixtures)", () => {
  it("has at least 20 documented test cases", () => {
    // This test enforces the plan's "20 input cases" gate by failing
    // if the file has fewer than 20 `it` blocks. The plan requires
    // the test file to cover 20+ cases.
    // Count `it(` calls in the file at compile time by parsing.
    const source = require("fs").readFileSync(__filename, "utf-8");
    const itCount = (source.match(/^\s*it\(/gm) ?? []).length;
    expect(itCount).toBeGreaterThanOrEqual(20);
  });
});
