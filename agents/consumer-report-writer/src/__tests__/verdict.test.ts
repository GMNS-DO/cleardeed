import { describe, it, expect } from "vitest";
import { buildVerdictCard } from "../index";
import type { Insight } from "../insights/schema";

const insight = (severity: Insight["severity"], ruleId: string, headline: string, body: string): Insight => ({
  panel: "ownership",
  issueLens: "title_chain",
  evidenceStrength: "source_observation",
  source: "bhulekh:ror",
  severity,
  headline,
  body,
  actionItem: "verify manually",
  ruleId,
});

describe("buildVerdictCard", () => {
  it("renders the all-clear card when there are no redFlag/watchout insights", () => {
    const html = buildVerdictCard([insight("positive", "ROR-INS-001", "All clear", "No issues")]);
    expect(html).toContain('id="verdict"');
    expect(html).toContain('class="verdict-card"');
    expect(html).toContain('data-tier="proceed"');
    expect(html).toContain("No critical risks found");
    expect(html).toContain("Verify the remaining items below before paying");
  });

  it("renders the redFlag verdict with a red left border when one redFlag fires", () => {
    const html = buildVerdictCard([
      insight("redFlag", "ROR-INS-010", "Government-notified land", "Construction prohibited without prior permission."),
    ]);
    expect(html).toContain('class="verdict-card"');
    expect(html).toContain('data-tier="hold"');
    expect(html).toContain("Government-notified land");
    expect(html).toContain("Construction prohibited without prior permission");
  });

  it("renders the watchout verdict with a proceed-with-care tier when only watchout fires", () => {
    const html = buildVerdictCard([
      insight("watchout", "ROR-INS-020", "Subdivided plot without layout approval", "Verify BDA layout approval before paying."),
    ]);
    expect(html).toContain('class="verdict-card"');
    expect(html).toContain('data-tier="proceed-with-care"');
    expect(html).toContain("Subdivided plot without layout approval");
  });

  it("picks the most severe insight when multiple fire", () => {
    const html = buildVerdictCard([
      insight("watchout", "ROR-INS-022", "WATCHOUT headline", "WATCHOUT body"),
      insight("redFlag", "ROR-INS-011", "REDFLAG headline", "REDFLAG body"),
      insight("positive", "ROR-INS-033", "POSITIVE headline", "POSITIVE body"),
    ]);
    expect(html).toContain("REDFLAG headline");
    expect(html).not.toContain("WATCHOUT headline");
    expect(html).not.toContain("POSITIVE headline");
  });
});
