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

describe("buildBuyerPage — trust strip plumbing from sourceMeta", () => {
  it("Q1 trust strip pulls rawArtifactHash, parserVersion, fetchedAt from sourceMeta.bhulekh", () => {
    const html = buildBuyerPage({
      reportId: "X",
      header: buildHeader({ plotVillage: "Mendhasala" }),
      insights: [],
      ...baseProps,
      sections: baseSections,
      sourceMeta: {
        bhulekh: {
          fetchedAt: "2026-04-12T14:32:00.000Z",
          rawArtifactHash: "7a3f9b2c8d1e4f6a5b9c0d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a",
          parserVersion: "Bhulekh v3.2",
          warnings: [],
        },
      },
      css: "",
    } as any);
    // The summary line in the rendered trust strip should include the
    // real hash and parser version, not the demo strings.
    const q1Section = html.match(/<section class="q-detail" id="q1-detail"[\s\S]*?<\/section>/)?.[0] ?? "";
    expect(q1Section).toContain("q-trust-strip");
    expect(q1Section).toContain("7a3f9b2c8d1e");
    expect(q1Section).toContain("Bhulekh v3.2");
    // Demo strings should NOT be present.
    expect(q1Section).not.toContain("7a3f9b2c... (sha256 of raw HTML)");
  });

  it("Q1 trust strip falls back to minimal summary when sourceMeta is absent", () => {
    const html = buildBuyerPage({
      reportId: "X",
      header: buildHeader({ plotVillage: "Mendhasala" }),
      insights: [],
      ...baseProps,
      sections: baseSections,
      css: "",
    } as any);
    const q1Section = html.match(/<section class="q-detail" id="q1-detail"[\s\S]*?<\/section>/)?.[0] ?? "";
    // No sourceMeta — summary line shows only the source URL and "2h ago"
    // (no fake hash, no fake parser version). Trust strip still renders
    // because buyers must always see it, but with minimal content.
    expect(q1Section).toContain("q-trust-strip");
    expect(q1Section).toContain("2h ago");
    expect(q1Section).not.toContain("🔒 hash 7a3f9b2c");
  });

  it("Q1 trust strip shows casteFlag when casteOdia is provided", () => {
    const html = buildBuyerPage({
      reportId: "X",
      header: buildHeader({ plotVillage: "Mendhasala" }),
      insights: [],
      ...baseProps,
      sections: baseSections,
      sourceMeta: {
        bhulekh: {
          fetchedAt: "2026-04-12T14:32:00.000Z",
          rawArtifactHash: "abc123",
          casteOdia: "SC",
        },
      },
      css: "",
    } as any);
    const q1Section = html.match(/<section class="q-detail" id="q1-detail"[\s\S]*?<\/section>/)?.[0] ?? "";
    expect(q1Section).toContain("⚖️ Transferability");
    expect(q1Section).toContain("RoR shows SC owner");
    expect(q1Section).toContain("Odisha Land Reforms Act §22");
  });

  it("Q1 trust strip omits casteFlag when casteOdia is null or empty", () => {
    const html = buildBuyerPage({
      reportId: "X",
      header: buildHeader({ plotVillage: "Mendhasala" }),
      insights: [],
      ...baseProps,
      sections: baseSections,
      sourceMeta: {
        bhulekh: {
          fetchedAt: "2026-04-12T14:32:00.000Z",
          rawArtifactHash: "abc123",
          casteOdia: null,
        },
      },
      css: "",
    } as any);
    const q1Section = html.match(/<section class="q-detail" id="q1-detail"[\s\S]*?<\/section>/)?.[0] ?? "";
    expect(q1Section).not.toContain("⚖️ Transferability");
  });

  it("Q3 trust strip pulls attempts from sourceMeta.eCourts", () => {
    const html = buildBuyerPage({
      reportId: "X",
      header: buildHeader({ plotVillage: "Mendhasala" }),
      insights: [],
      ...baseProps,
      sections: baseSections,
      sourceMeta: {
        eCourts: {
          fetchedAt: "2026-04-12T14:32:00.000Z",
          rawArtifactHash: "captcha-response-hash",
          parserVersion: "ecourts-apify-v1",
          attempts: "2 captcha attempt(s) accepted",
          warnings: ["Captcha hard — Tesseract confidence 65%"],
        },
      },
      css: "",
    } as any);
    const q3Section = html.match(/<section class="q-detail" id="q3-detail"[\s\S]*?<\/section>/)?.[0] ?? "";
    expect(q3Section).toContain("q-trust-strip");
    expect(q3Section).toContain("2 captcha attempt(s) accepted");
    expect(q3Section).toContain("Captcha hard — Tesseract confidence 65%");
  });

  it("Q3 trust strip falls back to minimal summary when eCourts sourceMeta is absent", () => {
    const html = buildBuyerPage({
      reportId: "X",
      header: buildHeader({ plotVillage: "Mendhasala" }),
      insights: [],
      ...baseProps,
      sections: baseSections,
      css: "",
    } as any);
    const q3Section = html.match(/<section class="q-detail" id="q3-detail"[\s\S]*?<\/section>/)?.[0] ?? "";
    expect(q3Section).toContain("q-trust-strip");
    // Without sourceMeta, the summary line falls back to "2h ago" only
    // — no real hash, no real parser version, no real attempts to display.
    expect(q3Section).toContain("2h ago");
    expect(q3Section).not.toContain("🔁");
    expect(q3Section).not.toContain("1 captcha");
  });

  it("renders rawOdia in Q1 when sourceMeta provides it", () => {
    const html = buildBuyerPage({
      reportId: "X",
      header: buildHeader({ plotVillage: "Mendhasala" }),
      insights: [],
      ...baseProps,
      sections: baseSections,
      sourceMeta: {
        bhulekh: {
          fetchedAt: "2026-04-12T14:32:00.000Z",
          rawArtifactHash: "abc",
          rawOdia: { odia: "କୃଷ୍ଣଚନ୍ଦ୍ର", english: "Krushnachandra" },
        },
      },
      css: "",
    } as any);
    const q1Section = html.match(/<section class="q-detail" id="q1-detail"[\s\S]*?<\/section>/)?.[0] ?? "";
    expect(q1Section).toContain("📜 Original (Odia)");
    expect(q1Section).toContain("କୃଷ୍ଣଚନ୍ଦ୍ର");
    expect(q1Section).toContain("Krushnachandra");
  });
});
