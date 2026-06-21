import { describe, it, expect } from "vitest";
import { buildExposureStrip, computeFinancialExposure } from "../index";

const exposureInput = (overrides: Partial<Parameters<typeof computeFinancialExposure>[0]> = {}) => ({
  riskInsights: { owner: [], land: [], encumbrance: [], regulatory: [], financial: [], completeness: [] },
  redFlagRuleIds: new Set<string>(),
  watchoutRuleIds: new Set<string>(),
  rorPayload: null,
  plotArea: { acres: 0.25, sqft: 10890 },
  landClass: { rawKisam: "ଦଣ୍ଡା", standardizedKisam: "Agricultural", displayKisam: "Agricultural (irrigated)", conversionRequired: true, prohibited: false, buildable: true },
  bhulekhUsable: true,
  backPage: null,
  dues: null,
  igrEcEntries: [],
  cersaiCharges: [],
  ...overrides,
});

describe("buildExposureStrip (legacy — exposure is now embedded in hero)", () => {
  it("shows a 'no items' state when there are no exposure items", () => {
    const html = buildExposureStrip(exposureInput(), []);
    expect(html).toContain('id="exposure-strip"');
    expect(html).toContain("Nothing to expose at this stage");
  });

  it("renders a single at-risk item with red dot and amount", () => {
    const items = [
      {
        category: "Court attachment",
        amount: "₹3,50,000",
        exposure: "₹3.5L at risk if attachment upheld",
        severity: "at-risk" as const,
        source: "Bhulekh back page",
        action: "Get attachment details from court",
      },
    ];
    const html = buildExposureStrip(exposureInput(), items);
    expect(html).toContain('id="exposure-strip"');
    expect(html).toContain('class="exposure exposure-at-risk"');
    expect(html).toContain("Court attachment");
    expect(html).toContain("₹3,50,000");
  });

  it("renders a verified-clear item with green dot", () => {
    const items = [
      {
        category: "No active mortgage",
        amount: "₹0",
        exposure: "Verified clear: no active mortgage in Bhulekh back page",
        severity: "verified-clear" as const,
        source: "Bhulekh back page",
        action: "No action",
      },
    ];
    const html = buildExposureStrip(exposureInput(), items);
    expect(html).toContain('class="exposure exposure-clear"');
    expect(html).toContain("No active mortgage");
  });

  it("renders an unquantified item with amber dot", () => {
    const items = [
      {
        category: "Municipal dues",
        amount: null,
        exposure: "Unquantified: pay outstanding dues at BMC counter before mutation",
        severity: "unquantified" as const,
        source: "Bhulekh dues section",
        action: "Visit BMC tax counter",
      },
    ];
    const html = buildExposureStrip(exposureInput(), items);
    expect(html).toContain('class="exposure exposure-unquantified"');
    expect(html).toContain("Municipal dues");
    expect(html).toContain("Visit BMC tax counter");
  });

  it("caps visible items at 4 to fit the single-screen budget", () => {
    const items = Array.from({ length: 8 }, (_, i) => ({
      category: `Risk ${i + 1}`,
      amount: `₹${(i + 1) * 1000}`,
      exposure: `Risk ${i + 1} exposure`,
      severity: "at-risk" as const,
      source: "src",
      action: "act",
    }));
    const html = buildExposureStrip(exposureInput(), items);
    // Strip shows top 4, rest summarized in a 'more' note
    expect(html).toContain("Risk 1");
    expect(html).toContain("Risk 4");
    expect(html).not.toContain("Risk 5");
    expect(html).toContain("+4 more");
  });
});
