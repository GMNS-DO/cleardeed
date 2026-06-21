import { describe, it, expect } from "vitest";
import { buildPropertyHeader } from "../index";

const fixtureInput = {
  reportId: "CLD-TEST-001",
  plotVillage: "Chandaka",
  plotNo: "415",
  plotAreaDisplay: "0.45 acres",
  ownerName: "Krushnachandra Barajena",
  verdictHeadline: "Manual verification recommended",
  verdictSubhead: "Structural checks pass. Three items need your local SRO.",
  exposureMoney: "₹0",
  exposureCount: "3 items",
  sources: [
    { name: "Bhulekh", fetchedAt: "2026-04-12 14:32", status: "verified" },
    { name: "Bhunaksha", fetchedAt: "2026-04-12 14:32", status: "verified" },
    { name: "eCourts", fetchedAt: "2026-04-12 14:35", status: "watchout" },
  ],
};

describe("property-header (hero verdict block)", () => {
  it("renders the CRED hero verdict block", () => {
    const html = buildPropertyHeader(fixtureInput);
    expect(html).toContain('class="property-header"');
    expect(html).toContain('class="property-header-eyebrow"');
    expect(html).toContain("CLEARDEED VERDICT");
    expect(html).toContain('class="property-header-headline"');
    expect(html).toContain("Manual verification recommended");
    expect(html).toContain('class="property-header-subhead"');
    expect(html).toContain("Structural checks pass");
    expect(html).toContain('class="property-header-exposure"');
    expect(html).toContain("₹0");
    expect(html).toContain("3 items");
    expect(html).toContain('class="property-header-actions"');
    expect(html).toContain("Share with lawyer");
    expect(html).toContain("Download PDF");
  });

  it("renders one status dot per source with status color", () => {
    const html = buildPropertyHeader(fixtureInput);
    const dotCount = (html.match(/status-dot/g) ?? []).length;
    expect(dotCount).toBeGreaterThanOrEqual(3);
    expect(html).toMatch(/data-status="verified"/);
    expect(html).toMatch(/data-status="watchout"/);
  });
});
