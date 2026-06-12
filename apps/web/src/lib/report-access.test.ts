/**
 * Tests for injectReportExpiryIntoHtml — the Sprint 5 helper that injects
 * the "Expires on: <date>" line into the brand header of a cached report.
 *
 * The function is pure: it takes an HTML string + an ISO timestamp and
 * returns a (possibly mutated) HTML string. It must be a no-op when:
 *   - expiresAt is null/undefined/empty
 *   - the HTML doesn't look like a ClearDeed report (defensive)
 */
import { describe, it, expect } from "vitest";
import { injectReportExpiryIntoHtml } from "./report-access";

const SAMPLE_HEADER = `<header class="report-header">
  <div class="brand">
    <div class="brand-name">ClearDeed</div>
    <div class="brand-sub">Property Due-Diligence Report</div>
    <div class="gps-chip">20.27, 85.70</div>
  </div>
  <div class="meta">
    <div class="report-id">rep_abc</div>
    <div>Generated: 12 Jun 2026</div>
    <div>District: Khordha, Odisha</div>
  </div>
</header>`;

const FULL_REPORT = `<!doctype html><body>
${SAMPLE_HEADER}
<main>... rest of report ...</main>
</body>`;

describe("injectReportExpiryIntoHtml", () => {
  it("injects the Expires-on line after the Generated line when expiresAt is set", () => {
    const result = injectReportExpiryIntoHtml(FULL_REPORT, "2026-08-11T00:00:00.000Z");
    expect(result).toContain("Expires on:");
    expect(result).toContain("report-expires");
    // Should appear AFTER the Generated line in the source order
    const generatedIdx = result.indexOf("Generated:");
    const expiresIdx = result.indexOf("Expires on:");
    expect(generatedIdx).toBeGreaterThan(-1);
    expect(expiresIdx).toBeGreaterThan(generatedIdx);
  });

  it("renders the date in en-IN format (e.g. '11 Aug 2026')", () => {
    const result = injectReportExpiryIntoHtml(FULL_REPORT, "2026-08-11T00:00:00.000Z");
    expect(result).toMatch(/Expires on:\s*\d{2}\s+\w{3}\s+\d{4}/);
    expect(result).toContain("11 Aug 2026");
  });

  it("is a no-op when expiresAt is null", () => {
    expect(injectReportExpiryIntoHtml(FULL_REPORT, null)).toBe(FULL_REPORT);
  });

  it("is a no-op when expiresAt is undefined", () => {
    expect(injectReportExpiryIntoHtml(FULL_REPORT, undefined)).toBe(FULL_REPORT);
  });

  it("is a no-op when expiresAt is an empty string", () => {
    expect(injectReportExpiryIntoHtml(FULL_REPORT, "")).toBe(FULL_REPORT);
  });

  it("is a no-op when the HTML doesn't look like a ClearDeed report", () => {
    const otherHtml = "<html><body><div>Generated: today</div></body></html>";
    // The marker phrase "Property Due-Diligence Report" is missing.
    expect(injectReportExpiryIntoHtml(otherHtml, "2026-08-11T00:00:00.000Z")).toBe(otherHtml);
  });

  it("is a no-op when expiresAt is not a parseable date", () => {
    const result = injectReportExpiryIntoHtml(FULL_REPORT, "not-a-date");
    expect(result).toBe(FULL_REPORT);
  });
});
