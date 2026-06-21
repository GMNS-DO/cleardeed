import { describe, it, expect } from "vitest";
import { buildBuyerPage, type Insight } from "../index";

const insights: Insight[] = [
  {
    panel: "owner",
    issueLens: "title_chain",
    evidenceStrength: "selected_plot_anchor",
    source: "Bhulekh",
    severity: "positive",
    headline: "Single owner",
    body: "Single owner recorded.",
    actionItem: "Verify with seller.",
    ruleId: "ROR-INS-001",
  },
  {
    panel: "land",
    issueLens: "land_use_permission",
    evidenceStrength: "selected_plot_anchor",
    source: "Bhulekh",
    severity: "watchout",
    headline: "Conversion required",
    body: "Land class needs conversion.",
    actionItem: "Budget for conversion fees.",
    ruleId: "ROR-INS-002",
  },
  {
    panel: "court",
    issueLens: "registry_ec",
    evidenceStrength: "case_or_order_anchor",
    source: "eCourts",
    severity: "redFlag",
    headline: "Active case found",
    body: "Active case filed.",
    actionItem: "Read the case.",
    ruleId: "ROR-INS-003",
  },
];

const baseSections = {
  plot: "<p>plot content</p>",
  owner: "<p>owner content</p>",
  land: "<p>land content</p>",
  registryCourt: "<p>rc content</p>",
  financial: "<p>financial content</p>",
  verify: "<p>verify content</p>",
};

const baseProps = {
  riskInsights: {} as Record<string, any[]>,
  redFlagRuleIds: [] as string[],
  watchoutRuleIds: [] as string[],
  plotArea: null as unknown,
  landClass: {} as Record<string, unknown>,
  bhulekhUsable: true,
  encumbranceInstructions: null as unknown,
  backPage: null as unknown,
  dues: null as unknown,
  igrEcEntries: [] as unknown[],
  cersaiCharges: [] as unknown[],
  village: "Mendhasala",
  district: "Khordha",
  plotNo: "415",
};

const buildHeader = (overrides: Record<string, unknown> = {}) => ({
  reportId: "X",
  plotVillage: "Mendhasala",
  plotNo: "415",
  plotAreaDisplay: "0.10 ac",
  ownerName: "Test Owner",
  ...overrides,
});

describe("buildBuyerPage", () => {
  it("composes the buyer page in the right order: hero, source strip, q-grid, 6 q-details, nav, footer", () => {
    const html = buildBuyerPage({
      reportId: "CLD-2026-0142",
      header: buildHeader({ reportId: "CLD-2026-0142" }),
      insights,
      ...baseProps,
      sections: baseSections,
      css: ".x{color:red}",
    } as any);
    const headerIdx = html.indexOf('id="hero-verdict"');
    const statusStripIdx = html.indexOf('id="source-status"');
    const qGridIdx = html.indexOf('id="q-grid"');
    const navIdx = html.indexOf('id="q-sticky-nav"');
    const q1DetailIdx = html.indexOf('id="q1-detail"');
    const q6DetailIdx = html.indexOf('id="q6-detail"');
    const footerIdx = html.indexOf("feedback-footer");
    expect(headerIdx).toBeGreaterThan(-1);
    expect(statusStripIdx).toBeGreaterThan(headerIdx);
    expect(qGridIdx).toBeGreaterThan(statusStripIdx);
    expect(navIdx).toBeGreaterThan(qGridIdx);
    expect(q1DetailIdx).toBeGreaterThan(navIdx);
    expect(q6DetailIdx).toBeGreaterThan(q1DetailIdx);
    expect(footerIdx).toBeGreaterThan(q6DetailIdx);
  });

  it("renders all 6 q-tiles and 6 q-detail sections", () => {
    const html = buildBuyerPage({
      reportId: "X",
      header: buildHeader({ plotVillage: "V" }),
      insights: [],
      ...baseProps,
      sections: baseSections,
      css: "",
    } as any);
    const tileCount = (html.match(/class="q-tile"/g) ?? []).length;
    expect(tileCount).toBe(6);
    for (let i = 1; i <= 6; i++) {
      expect(html).toContain(`id="q${i}-detail"`);
    }
  });

  it("colors the q3 (loss-after-paying) tile red when a court redFlag insight is present", () => {
    const html = buildBuyerPage({
      reportId: "X",
      header: buildHeader({ plotVillage: "V" }),
      insights,
      ...baseProps,
      sections: baseSections,
      css: "",
    } as any);
    // Q3 maps to encumbrance / court risk; redFlag insight on the court panel
    // should color the q3 tile with data-status="risk".
    const q3Match = html.match(/<a href="#q3-detail" class="q-tile"[^>]*data-status="([^"]+)"/);
    expect(q3Match).not.toBeNull();
    expect(q3Match![1]).toBe("risk");
  });

  it("colors the q2 (build) tile watchout when a land watchout insight is present", () => {
    const html = buildBuyerPage({
      reportId: "X",
      header: buildHeader({ plotVillage: "V" }),
      insights,
      ...baseProps,
      sections: baseSections,
      css: "",
    } as any);
    // Q2 is land/buildability. A land watchout insight should map to q2 = "watchout".
    const q2Match = html.match(/<a href="#q2-detail" class="q-tile"[^>]*data-status="([^"]+)"/);
    expect(q2Match).not.toBeNull();
    expect(q2Match![1]).toBe("watchout");
  });

  it("inlines the provided CSS into the head", () => {
    const html = buildBuyerPage({
      reportId: "X",
      header: buildHeader({ plotVillage: "V" }),
      insights: [],
      ...baseProps,
      sections: baseSections,
      css: ".buyer-page { font-family: serif; }",
    } as any);
    expect(html).toContain(".buyer-page { font-family: serif; }");
  });
});
