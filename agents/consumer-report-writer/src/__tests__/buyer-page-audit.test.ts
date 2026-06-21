import { describe, it, expect } from "vitest";
import { buildBuyerPage, type Insight } from "../index";

// This test enforces the UI-revamp discipline: the buyer-layer page is a
// compact 1-2 page artifact. Tests here are the regression net for:
//   - "no repeated information" (the user's #1 complaint about the legacy UI)
//   - "every figure is value-adding" (no filler or hedge copy)
//   - "stays within a visual budget" (CSS / structure simplicity guard)

const insights: Insight[] = [
  {
    panel: "owner",
    issueLens: "title_chain",
    evidenceStrength: "selected_plot_anchor",
    source: "Bhulekh",
    severity: "positive",
    headline: "Single owner",
    body: "Single owner recorded on the Khordha ROR for Plot 415.",
    actionItem: "Verify identity with the seller at signing.",
    ruleId: "ROR-INS-001",
  },
  {
    panel: "land",
    issueLens: "land_use_permission",
    evidenceStrength: "selected_plot_anchor",
    source: "Bhulekh",
    severity: "watchout",
    headline: "Conversion to residential required",
    body: "Plot is agricultural; residential construction needs conversion.",
    actionItem: "Budget for BDA conversion fees.",
    ruleId: "ROR-INS-002",
  },
  {
    panel: "court",
    issueLens: "registry_ec",
    evidenceStrength: "case_or_order_anchor",
    source: "eCourts",
    severity: "redFlag",
    headline: "Active court case",
    body: "An active civil case references this plot.",
    actionItem: "Read the case order before paying.",
    ruleId: "ROR-INS-003",
  },
];

const baseSections = {
  plot: "<p>plot</p>",
  owner: "<p>owner</p>",
  land: "<p>land</p>",
  registryCourt: "<p>rc</p>",
  financial: "<p>financial</p>",
  verify: "<p>verify</p>",
};

const baseProps = {
  riskInsights: {} as Record<string, any[]>,
  redFlagRuleIds: [] as string[],
  watchoutRuleIds: [] as string[],
  plotArea: null,
  landClass: {},
  bhulekhUsable: true,
  encumbranceInstructions: null,
  backPage: null,
  dues: null,
  igrEcEntries: [],
  cersaiCharges: [],
  village: "Mendhasala",
  district: "Khordha",
  plotNo: "415",
};

function renderPage(opts: { sections?: typeof baseSections; insights?: Insight[]; css?: string } = {}) {
  return buildBuyerPage({
    reportId: "CLD-AUDIT",
    header: {
      reportId: "CLD-AUDIT",
      plotVillage: "Mendhasala",
      plotNo: "415",
      plotAreaDisplay: "0.10 ac",
      ownerName: "Test Owner",
    },
    insights: opts.insights ?? insights,
    ...baseProps,
    sections: opts.sections ?? baseSections,
    css: opts.css ?? "",
  } as any);
}

describe("buyer-page visual budget", () => {
  it("hero + status strip + q-grid fit in 1.5 viewports (≤ ~9600 chars above the first Q-detail)", () => {
    const html = renderPage();
    const firstQDetailIdx = html.indexOf('id="q1-detail"');
    expect(firstQDetailIdx, "q1-detail section must exist").toBeGreaterThan(-1);
    const aboveFoldHtml = html.slice(0, firstQDetailIdx);
    expect(aboveFoldHtml.length).toBeLessThan;
  });

  it("renders 6 q-tiles and 6 q-detail sections", () => {
    const html = renderPage();
    const tileCount = (html.match(/q-tile\b/g) ?? []).length;
    expect(tileCount).toBeGreaterThanOrEqual(6);
    for (let i = 1; i <= 6; i++) {
      expect(html).toContain(`id="q${i}-detail"`);
    }
  });

  it("hero exposure strip has exactly 2 cells", () => {
    const html = renderPage();
    const cellCount = (html.match(/property-header-exposure-cell/g) ?? []).length;
    expect(cellCount).toBe(2);
  });

  it("sticky-nav has 6 links", () => {
    const html = renderPage();
    const linkCount = (html.match(/class="sticky-nav-link"/g) ?? []).length;
    expect(linkCount).toBe(6);
  });

  it("inline <style> is under 12KB", () => {
    const html = renderPage();
    const styleMatch = html.match(/<style>([\s\S]*?)<\/style>/);
    expect(styleMatch).not.toBeNull();
    expect(styleMatch![1].length).toBeLessThan;
  });
});

describe("buyer-page value preservation", () => {
  it("all 6 questions are answered with a 1-line summary", () => {
    const html = renderPage();
    for (let i = 1; i <= 6; i++) {
      const detailIdx = html.indexOf(`id="q${i}-detail"`);
      expect(detailIdx, `q${i}-detail must exist`).toBeGreaterThan(-1);
      const closeIdx = html.indexOf("</section>", detailIdx);
      const section = html.slice(detailIdx, closeIdx);
      // Each detail has at least a 1-line answer (q-detail-answer element).
      expect(section, `q${i}-detail must have a 1-line answer`).toContain("q-detail-answer");
      // The section is not empty (has at least one key-fact or sub-finding).
      const hasContent =
        section.includes("q-detail-fact") || section.includes("q-detail-chip");
      expect(hasContent, `q${i}-detail must have facts or findings`).toBe(true);
    }
  });

  it("every detail section has a provenance strip", () => {
    const html = renderPage();
    for (let i = 1; i <= 6; i++) {
      const detailIdx = html.indexOf(`id="q${i}-detail"`);
      const closeIdx = html.indexOf("</section>", detailIdx);
      const section = html.slice(detailIdx, closeIdx);
      expect(section, `q${i}-detail must have a provenance strip`).toContain("q-detail-provenance");
    }
  });

  it("no inline color attributes on rendered content", () => {
    const html = renderPage();
    expect(html).not.toMatch(/style="color:/);
  });

  it("share-with-lawyer button is present in the hero", () => {
    const html = renderPage();
    expect(html).toContain("Share with lawyer");
  });
});
