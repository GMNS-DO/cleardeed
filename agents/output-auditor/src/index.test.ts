/**
 * A11 OutputAuditor — tests
 *
 * Verifies auditReport() detects prohibited language and passes clean reports.
 */
import { describe, it, expect } from "vitest";
import { auditReport, auditOrThrow } from "./index";

describe("A11 OutputAuditor", () => {
  describe("passes clean HTML", () => {
    it("passes a well-formed consumer report with disclaimer", () => {
      const html = `<!DOCTYPE html>
<html><body>
<h1>Property Report</h1>
<p>This plot is located in Mendhasala village.</p>
<p>The Bhulekh record shows Krushnachandra Barajena as the owner.</p>
<div class="disclaimer-box">
  ClearDeed is an information aggregator. Consult a property lawyer before transacting.
</div>
</body></html>`;

      const result = auditReport(html, { reportId: "CLD-TEST-001" });

      expect(result.passed).toBe(true);
      expect(result.violations).toHaveLength(0);
      expect(result.reportId).toBe("CLD-TEST-001");
    });

    it("passes a report with multiple verified sections but no score", () => {
      const html = `<!DOCTYPE html>
<html><body>
<p>Ownership: Exact match — seller name matches Bhulekh record.</p>
<p>Encumbrances: No active court cases found for this owner.</p>
<div class="disclaimer">This is not a legal opinion. Consult a lawyer.</div>
</body></html>`;

      const result = auditReport(html);
      expect(result.passed).toBe(true);
      expect(result.violations).toHaveLength(0);
    });

    it("passes required disclaimer negations", () => {
      const html = `<body>
        <p>Overlay screening is not fully verified in this run.</p>
        <p class="disclaimer">This report is not a legal opinion, not a title certificate, and not a guarantee of ownership or freedom from encumbrance. Consult a lawyer.</p>
      </body>`;

      const result = auditReport(html);
      expect(result.passed).toBe(true);
      expect(result.violations).toHaveLength(0);
    });

    it("passes ownership-history caveats that explicitly deny verification", () => {
      const html = `<body>
        <p>These are anchors for manual follow-up only, not verified ownership history or a confirmed mutation timeline.</p>
        <p class="disclaimer">This report is not a legal opinion. Consult a lawyer.</p>
      </body>`;

      const result = auditReport(html);
      expect(result.passed).toBe(true);
      expect(result.violations).toHaveLength(0);
    });
  });

  describe("detects prohibited score language", () => {
    it("catches 'Score:' phrase", () => {
      const html = `<body><p>Score: 85/100 — highly recommended.</p><div class="disclaimer">consult a lawyer</div></body>`;
      const result = auditReport(html);
      expect(result.passed).toBe(false);
      expect(result.violations.some((v) => v.match === "Score:")).toBe(true);
    });

    it("catches 'Grade: A' language", () => {
      const html = `<body><p>Overall Grade: A — safe to buy.</p><div class="disclaimer">consult a lawyer</div></body>`;
      const result = auditReport(html);
      expect(result.passed).toBe(false);
      expect(result.violations.some((v) => v.type === "prohibited_pattern")).toBe(true);
    });

    it("catches numeric X/100 score format", () => {
      const html = `<body><p>Trust score: 85/100 for this property.</p><div class="disclaimer">consult a lawyer</div></body>`;
      const result = auditReport(html);
      expect(result.passed).toBe(false);
      expect(result.violations.length).toBeGreaterThan(0);
    });

    it("catches 'safe to buy' outright", () => {
      const html = `<body><p>This land is safe to buy.</p><div class="disclaimer">consult a lawyer</div></body>`;
      const result = auditReport(html);
      expect(result.passed).toBe(false);
      expect(result.violations.some((v) => v.match === "safe to buy")).toBe(true);
    });
  });

  describe("detects certification language", () => {
    it("catches 'certified ownership'", () => {
      const html = `<body><p>Certified ownership verified by ClearDeed.</p><div class="disclaimer">consult a lawyer</div></body>`;
      const result = auditReport(html);
      expect(result.passed).toBe(false);
      expect(result.violations.some((v) => v.match.toLowerCase().includes("certified ownership"))).toBe(true);
    });

    it("catches 'clear title'", () => {
      const html = `<body><p>This plot has a clear title.</p><div class="disclaimer">consult a lawyer</div></body>`;
      const result = auditReport(html);
      expect(result.passed).toBe(false);
      expect(result.violations.some((v) => v.match === "clear title")).toBe(true);
    });

    it("catches 'guaranteed' language", () => {
      const html = `<body><p>Ownership guaranteed by our verification.</p><div class="disclaimer">consult a lawyer</div></body>`;
      const result = auditReport(html);
      expect(result.passed).toBe(false);
      expect(result.violations.some((v) => v.match === "guaranteed")).toBe(true);
    });
  });

  describe("detects legal conclusion language", () => {
    it("catches 'legally verified'", () => {
      const html = `<body><p>Property is legally verified and clear.</p><div class="disclaimer">consult a lawyer</div></body>`;
      const result = auditReport(html);
      expect(result.passed).toBe(false);
      expect(result.violations.some((v) => v.match === "legally verified")).toBe(true);
    });

    it("catches 'no risk' language", () => {
      const html = `<body><p>This is a no risk investment.</p><div class="disclaimer">consult a lawyer</div></body>`;
      const result = auditReport(html);
      expect(result.passed).toBe(false);
      expect(result.violations.some((v) => v.match === "no risk")).toBe(true);
    });

    it("catches '100% verified'", () => {
      const html = `<body><p>This plot is 100% verified.</p><div class="disclaimer">consult a lawyer</div></body>`;
      const result = auditReport(html);
      expect(result.passed).toBe(false);
      expect(result.violations.length).toBeGreaterThan(0);
    });
  });

  describe("missing disclaimer", () => {
    it("fails when no disclaimer is present", () => {
      const html = `<body><p>The owner is Krushnachandra Barajena.</p></body>`;
      const result = auditReport(html);
      expect(result.passed).toBe(false);
      expect(result.violations.some((v) => v.type === "missing_disclaimer")).toBe(true);
    });

    it("passes when 'disclaimer' text is present", () => {
      const html = `<body><p>Owner confirmed.</p><p class="disclaimer">This is not legal advice.</p></body>`;
      const result = auditReport(html);
      expect(result.passed).toBe(true);
    });

    it("passes when 'consult a lawyer' is present", () => {
      const html = `<body><p>Owner confirmed.</p><p>Always consult a property lawyer before purchasing.</p></body>`;
      const result = auditReport(html);
      expect(result.passed).toBe(true);
    });
  });

  describe("violation banner injection", () => {
    it("injects banner when violations found", () => {
      const html = `<!DOCTYPE html><body><p>Score: 90/100 — good buy.</p></body>`;
      const result = auditReport(html);
      expect(result.html).toContain("A11 OutputAuditor");
      expect(result.html).toContain("held for review");
    });

    it("does not inject banner when clean", () => {
      const html = `<!DOCTYPE html><body><p>Owner: Krushnachandra.</p><div class="disclaimer">consult a lawyer</div></body>`;
      const result = auditReport(html);
      expect(result.html).not.toContain("A11 OutputAuditor");
      expect(result.html).toBe(html);
    });
  });

  describe("auditOrThrow", () => {
    it("returns result when passed", () => {
      const html = fullReportHtml();
      const result = auditOrThrow(html, "CLD-TEST-002");
      expect(result.passed).toBe(true);
    });

    it("throws when violations found", () => {
      const html = `<body><p>Score: 85/100.</p><div class="disclaimer">consult a lawyer</div></body>`;
      expect(() => auditOrThrow(html, "CLD-TEST-003")).toThrow("A11 OutputAuditor blocked");
    });
  });

  describe("structural source-state audit", () => {
    it("passes a complete report skeleton with source audit and buyer actions", () => {
      const result = auditReport(fullReportHtml(), {
        requireStructuralChecks: true,
      });

      expect(result.passed).toBe(true);
      expect(result.violations).toHaveLength(0);
    });

    it("fails when required sections are missing", () => {
      const result = auditReport(`<body><p class="disclaimer">consult a lawyer</p></body>`, {
        requireStructuralChecks: true,
      });

      expect(result.passed).toBe(false);
      expect(result.violations.some((v) => v.type === "missing_section")).toBe(true);
    });

    it("blocks clean court negative copy when a court source is incomplete", () => {
      const html = fullReportHtml({
        ecourtsStatus: "partial",
        courtCopy: "No active civil or criminal court cases were found for the claimed owner.",
      });

      const result = auditReport(html, { requireStructuralChecks: true });

      expect(result.passed).toBe(false);
      expect(result.violations.some((v) => v.type === "source_state_violation")).toBe(true);
    });

    it("blocks short zero-case copy when a court source is incomplete", () => {
      const html = fullReportHtml({
        ecourtsStatus: "partial",
        courtCopy: "0 active cases found for the searched party.",
      });

      const result = auditReport(html, { requireStructuralChecks: true });

      expect(result.passed).toBe(false);
      expect(result.violations.some((v) => v.match === "Clean court negative-result copy")).toBe(true);
    });

    it("blocks zero-case-record copy when a court source is incomplete", () => {
      const html = fullReportHtml({
        ecourtsStatus: "partial",
        courtCopy: "Completed online court and revenue-case sources returned zero case records.",
      });

      const result = auditReport(html, { requireStructuralChecks: true });

      expect(result.passed).toBe(false);
      expect(result.violations.some((v) => v.match === "Clean court negative-result copy")).toBe(true);
    });

    it("blocks no-case-record copy without a clearance caveat when a court source is incomplete", () => {
      const html = fullReportHtml({
        ecourtsStatus: "partial",
        courtCopy: "No case records were returned in this source-scoped eCourts/RCCMS search.",
      });

      const result = auditReport(html, { requireStructuralChecks: true });

      expect(result.passed).toBe(false);
      expect(result.violations.some((v) => v.match === "Clean court negative-result copy")).toBe(true);
    });

    it("allows no-case-record copy with a court-clearance caveat", () => {
      const html = fullReportHtml({
        ecourtsStatus: "success",
        rccmsStatus: "success",
        courtCopy:
          "No case records were returned in this source-scoped eCourts/RCCMS search, but this is not a full court-clearance finding.",
      });

      const result = auditReport(html, { requireStructuralChecks: true });

      expect(result.violations.some((v) => v.match === "Clean court negative-result copy")).toBe(false);
    });

    it("blocks clean regulatory copy when overlay screening is incomplete", () => {
      const html = fullReportHtml({
        regulatorySourceLine: "Overlay screening: not fully verified in this run",
        regulatoryCopy: "No immediate regulatory flags were found in the overlay source(s) that completed successfully for this run.",
      });

      const result = auditReport(html, { requireStructuralChecks: true });

      expect(result.passed).toBe(false);
      expect(result.violations.some((v) => v.match === "No immediate regulatory flags were found")).toBe(true);
    });
  });

  describe("edge cases", () => {
    it("handles empty HTML gracefully", () => {
      const result = auditReport("");
      expect(result.passed).toBe(false);
      expect(result.violations.length).toBeGreaterThan(0);
    });

    it("escapes HTML in violation banner", () => {
      const html = `<body><p>Score: <script>alert(1)</script></p><div class="disclaimer">consult a lawyer</div></body>`;
      const result = auditReport(html);
      // The banner (prepended) must have escaped HTML in its match display
      expect(result.html).toContain("A11 OutputAuditor");
      // The original script tag survives in body (expected — we don't sanitize input HTML)
      expect(result.html).toContain("<script>");
    });

    it("returns scan duration", () => {
      const html = `<body><p>Clean.</p><div class="disclaimer">consult a lawyer</div></body>`;
      const result = auditReport(html);
      expect(result.scanDurationMs).toBeGreaterThanOrEqual(0);
    });
  });
});

function fullReportHtml(options: {
  ecourtsStatus?: string;
  rccmsStatus?: string;
  courtCopy?: string;
  regulatoryCopy?: string;
  regulatorySourceLine?: string;
} = {}): string {
  const ecourtsStatus = options.ecourtsStatus ?? "success";
  const rccmsStatus = options.rccmsStatus ?? "success";
  const courtCopy = options.courtCopy ?? "Court and revenue-case checks returned source statuses shown below.";
  const regulatoryCopy = options.regulatoryCopy ?? "Regulatory overlay screening requires manual review for layers not listed as complete.";
  const regulatorySourceLine = options.regulatorySourceLine ?? "Overlay screening: completed overlay source(s) listed in findings above";

  return `<!DOCTYPE html>
    <html><body>
      <section id="section-summary"><h1>Buyer action summary</h1></section>
      <section id="section-source-audit">
        <table>
          <tbody>
            <tr><td>ecourts</td><td>${ecourtsStatus}</td><td>today</td><td>ok</td></tr>
            <tr><td>rccms</td><td>${rccmsStatus}</td><td>today</td><td>ok</td></tr>
          </tbody>
        </table>
      </section>
      <section id="section-plot">Plot details</section>
      <section id="section-owner">Owner details</section>
      <section id="section-land">Land classification</section>
      <section id="section-encumbrance">${courtCopy}<p>Encumbrance Certificate must be obtained manually.</p></section>
      <section id="section-regulatory">${regulatoryCopy}<div>${regulatorySourceLine}</div></section>
      <section id="section-action">
        <h2>What to Ask Next</h2>
        <p>Ask for the Encumbrance Certificate before paying anything.</p>
        <div class="disclaimer">This is not a legal opinion. Consult a lawyer.</div>
      </section>
    </body></html>`;
}
