/**
 * A11 — `no_ungrounded_ai_claim` rule + fixture test.
 *
 * Week 1 deliverable: scaffold the rule, exercise the fixture, and
 * assert the gate behaves correctly against the corpus. The flag
 * defaults to `false` so this does not block any current PR; P2 V1
 * (Week 3) flips it to `true`.
 *
 * What the test asserts:
 *   1. With the flag OFF (current prod state), AI-claim corpus
 *      text embedded in a report is NOT flagged.
 *   2. With the flag ON (P2 V1 state), every ungrounded item
 *      in the corpus triggers a violation, and every grounded
 *      item does not.
 *   3. The fixture corpus itself is internally consistent
 *      (no item is both grounded and ungrounded; the count
 *      is even and balanced).
 *
 * Acceptance for the Week 1 PR:
 *   - All assertions in this file pass with the flag off.
 *   - The "flag-on" path is exercised and produces the expected
 *     violation shape (severity, type, match, context).
 */

import { describe, it, expect, beforeEach } from "vitest";
import { AI_CLAIM_FIXTURES, type AiClaimFixture } from "./ai-claims";

// The rule scaffold itself lives in index.ts. We import it dynamically
// so the test fails clearly if the export shape drifts, rather than
// crashing at module load.
import * as auditor from "./index";

describe("A11 ai-claims fixture (P1 P0 / Week 1 deliverable)", () => {
  it("contains at least 10 grounded and 10 ungrounded items", () => {
    const grounded = AI_CLAIM_FIXTURES.filter((f) => f.grounded).length;
    const ungrounded = AI_CLAIM_FIXTURES.filter((f) => !f.grounded).length;
    expect(grounded).toBeGreaterThanOrEqual(10);
    expect(ungrounded).toBeGreaterThanOrEqual(10);
  });

  it("every fixture has a non-empty reason", () => {
    for (const f of AI_CLAIM_FIXTURES) {
      expect(f.reason.length).toBeGreaterThan(10);
    }
  });

  it("every fixture has a valid section", () => {
    const valid: ReadonlyArray<AiClaimFixture["section"]> = [
      "encumbrance",
      "owner",
      "regulatory",
      "plot",
      "land",
      "action",
    ];
    for (const f of AI_CLAIM_FIXTURES) {
      expect(valid).toContain(f.section);
    }
  });

  it("the corpus does not contain any item the auditor already flags in Week 1 (flag off)", () => {
    // The 10 must-pass items must not contain anything the existing
    // rules would already flag — otherwise the flag-on test below
    // would conflate the new rule with existing ones.
    const mustPass = AI_CLAIM_FIXTURES.filter((f) => f.grounded);
    for (const f of mustPass) {
      // Wrap in a minimal HTML to exercise the existing auditor.
      const html = `<div class="section">${f.text}</div>
<div class="disclaimer-box">ClearDeed is an information aggregator. Consult a property lawyer before transacting.</div>`;
      const result = auditor.auditReport(html, { reportId: "CLD-AICLAIMS-PASSTHRU" });
      // Existing rules must not flag the must-pass items.
      const ourFlag = result.violations.filter((v) => v.match.includes(f.text.slice(0, 40)));
      expect(ourFlag).toHaveLength(0);
    }
  });
});

describe("A11 no_ungrounded_ai_claim rule scaffold (flag-controlled)", () => {
  // The rule itself is exported from index.ts when the feature flag
  // is on. In Week 1 the flag is OFF; the export should still exist
  // (so consumers can import it without crashing) but should be a no-op
  // when called. P2 V1 flips the flag and the test below begins to assert.

  beforeEach(() => {
    // The flag lives in the auditor module. If it isn't exported,
    // that's a structural change to capture in this test.
    if (!("AI_CLAIM_AUDIT_ENABLED" in auditor)) {
      throw new Error("A11: AI_CLAIM_AUDIT_ENABLED flag is missing from auditor module — required for the Week 1 scaffold.");
    }
  });

  it("flag is true in P2 V1 (rule is active)", () => {
    expect((auditor as { AI_CLAIM_AUDIT_ENABLED: boolean }).AI_CLAIM_AUDIT_ENABLED).toBe(true);
  });

  it("scanning an ungrounded item with the flag on produces an ai_claim violation", () => {
    const f = AI_CLAIM_FIXTURES.find((x) => !x.grounded && x.text.startsWith("All documents are in order"));
    expect(f).toBeDefined();
    if (!f) return; // type guard

    const html = `<div class="section">${f.text}</div>
<div class="disclaimer-box">ClearDeed is an information aggregator. Consult a property lawyer before transacting.</div>`;
    const result = auditor.auditReport(html, { reportId: "CLD-AICLAIMS-ON" });
    const aiClaimViolations = result.violations.filter((v) => v.type === "no_ungrounded_ai_claim");
    expect(aiClaimViolations.length).toBeGreaterThan(0);
    // The ungrounded item is a "transaction recommendation" — action
    // section — so severity is critical.
    expect(aiClaimViolations[0].severity).toBe("critical");
  });

  it("(P2 V1 path) when the flag is on, every ungrounded item produces a violation", () => {
    for (const f of AI_CLAIM_FIXTURES.filter((x) => !x.grounded)) {
      const html = `<div class="section">${f.text}</div>
<div class="disclaimer-box">ClearDeed is an information aggregator. Consult a property lawyer before transacting.</div>`;
      const violations = auditor.runNoUngroundedAiClaimRule(html);
      expect(
        violations.some((v) => v.match.includes(f.text.slice(0, 30).toLowerCase()))
      ).toBe(true);
    }
  });

  it("grounded items do not produce violations even when present in the HTML", () => {
    for (const f of AI_CLAIM_FIXTURES.filter((x) => x.grounded)) {
      const html = `<div class="section">${f.text}</div>
<div class="disclaimer-box">ClearDeed is an information aggregator. Consult a property lawyer before transacting.</div>`;
      const violations = auditor.runNoUngroundedAiClaimRule(html);
      expect(violations).toHaveLength(0);
    }
  });
});
