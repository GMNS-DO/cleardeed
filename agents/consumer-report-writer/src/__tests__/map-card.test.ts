/**
 * MapCard — Phase 2 v0 tests.
 *
 * MapCard is the premium hero chrome around the existing cached plot
 * diagram SVG. The data path (Bhunaksha → SVG) is already shipped;
 * this component is the *UI shell* that the spec calls for — gold
 * border, "Verify on Bhulekh" button, status badge, layer toggle
 * stub. MapLibre / deck.gl / client JS come in Phase 2 v1; this
 * version is server-rendered only.
 *
 * Compatibility contract:
 *   - renderMapCard() returns "" when no plot diagram is available
 *     so existing reports without a diagram are byte-for-byte
 *     identical.
 *   - The "verified by one source" badge is shown on `partial`
 *     status, "Location approximate" on `unverified` (no URL),
 *     "Boundary dispute — verify manually" on `disputed` (no URL).
 *   - The "Verify on Bhulekh" link is always rendered when there is
 *     a URL — even on failed/partial — because Bhulekh is the
 *     canonical source for boundary verification.
 */

import { describe, it, expect } from "vitest";
import { renderMapCard } from "../map-card";
import { buildBuyerPage } from "../index";

function buildHeader(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    reportId: "CLD-2026-0142",
    plotVillage: "Mendhasala",
    plotNo: "309",
    plotAreaDisplay: "0.10 ac",
    ownerName: "Test Owner",
    ...overrides,
  };
}

function buildBaseProps() {
  return {
    insights: [] as never[],
    riskInsights: { redFlag: [], watchout: [], positive: [] },
    redFlagRuleIds: [],
    watchoutRuleIds: [],
    plotArea: null,
    landClass: {
      rawKisam: null,
      standardizedKisam: null,
      displayKisam: null,
      conversionRequired: null,
    },
    bhulekhUsable: true,
    encumbranceInstructions: null,
    backPage: null,
    dues: null,
    igrEcEntries: [],
    cersaiCharges: [],
    village: "Mendhasala",
    district: "Khordha",
    plotNo: "309",
    sections: {
      plot: "",
      owner: "",
      land: "",
      registryCourt: "",
      financial: "",
      verify: "",
    },
  };
}

describe("MapCard — no diagram", () => {
  it("returns '' when plotDiagram is null", () => {
    expect(renderMapCard({ plotDiagram: null })).toBe("");
  });

  it("returns '' when plotDiagram is undefined", () => {
    expect(renderMapCard({})).toBe("");
  });

  it("returns '' when plotDiagram has no url and no failure status", () => {
    expect(
      renderMapCard({ plotDiagram: { status: "not_attempted" } })
    ).toBe("");
  });
});

describe("MapCard — success", () => {
  const html = renderMapCard({
    plotDiagram: {
      status: "success",
      url: "https://cleardeed.example/diagrams/abc.svg",
      cacheHit: false,
    },
    plotNo: "309",
    village: "Mendhasala",
  });

  it("wraps the diagram in a section with id section-map", () => {
    expect(html).toContain('id="section-map"');
  });

  it("embeds the diagram via <img> with the storage URL (not inline SVG)", () => {
    expect(html).toMatch(/<img[^>]+src="https:\/\/cleardeed\.example\/diagrams\/abc\.svg"/);
    expect(html).toContain("alt=");
  });

  it("shows the 'Verified by one source' badge on success", () => {
    expect(html).toContain("Verified by one source");
  });

  it("renders the 'Verify on Bhulekh' link", () => {
    expect(html).toContain("Verify on Bhulekh");
    expect(html).toContain("bhulekh.ori.nic.in");
  });

  it("renders the layer toggle stub (Satellite / Cadastral / Both)", () => {
    expect(html).toContain("Satellite");
    expect(html).toContain("Cadastral");
    expect(html).toContain("Both");
  });

  it("includes the plot identifier in the caption", () => {
    expect(html).toContain("309");
    expect(html).toContain("Mendhasala");
  });

  it("escapes the URL (defensive — URL comes from storage)", () => {
    const html2 = renderMapCard({
      plotDiagram: {
        status: "success",
        url: 'https://x.com/?a="><script>alert(1)</script>',
      },
    });
    expect(html2).not.toContain("<script>");
    expect(html2).toContain("&lt;script&gt;");
  });
});

describe("MapCard — partial", () => {
  const html = renderMapCard({
    plotDiagram: {
      status: "partial",
      url: "https://cleardeed.example/diagrams/abc.svg",
    },
  });

  it("shows the 'Verified by one source' badge", () => {
    expect(html).toContain("Verified by one source");
  });

  it("mentions that some neighbour plots may be missing", () => {
    expect(html).toMatch(/neighbour/i);
  });
});

describe("MapCard — failed", () => {
  const html = renderMapCard({
    plotDiagram: {
      status: "failed",
      reason: "WFS timeout",
    },
  });

  it("renders a fallback message instead of the diagram", () => {
    expect(html).toContain("Map unavailable");
    expect(html).toContain("Bhulekh");
  });

  it("mentions the failure reason when present", () => {
    expect(html).toContain("WFS timeout");
  });

  it("still offers the 'Verify on Bhulekh' deep link", () => {
    expect(html).toContain("Verify on Bhulekh");
  });

  it("does NOT embed an <img> tag (no URL)", () => {
    expect(html).not.toContain("<img");
  });
});

describe("MapCard — idempotence", () => {
  it("returns identical output for identical input", () => {
    const a = renderMapCard({
      plotDiagram: { status: "success", url: "https://x.com/a.svg" },
    });
    const b = renderMapCard({
      plotDiagram: { status: "success", url: "https://x.com/a.svg" },
    });
    expect(a).toBe(b);
  });

  it("does not mutate the input", () => {
    const plotDiagram = { status: "success" as const, url: "https://x.com/a.svg" };
    const snapshot = JSON.stringify(plotDiagram);
    renderMapCard({ plotDiagram });
    expect(JSON.stringify(plotDiagram)).toBe(snapshot);
  });
});

describe("MapCard — wired into buildBuyerPage (above the fold)", () => {
  it("renders between source-strip and q-grid when plotDiagram is success", () => {
    const html = buildBuyerPage({
      reportId: "CLD-2026-0142",
      header: buildHeader(),
      ...buildBaseProps(),
      plotDiagram: { status: "success", url: "https://x.com/a.svg" },
      sections: { plot: "", owner: "", land: "", registryCourt: "", financial: "", verify: "" },
      css: "",
    } as any);
    const statusStripIdx = html.indexOf('id="source-status"');
    const mapIdx = html.indexOf('id="section-map"');
    const qGridIdx = html.indexOf('id="q-grid"');
    expect(statusStripIdx).toBeGreaterThan(-1);
    expect(mapIdx).toBeGreaterThan(statusStripIdx);
    expect(qGridIdx).toBeGreaterThan(mapIdx);
  });

  it("does not render the MapCard when plotDiagram is undefined", () => {
    const html = buildBuyerPage({
      reportId: "CLD-2026-0142",
      header: buildHeader(),
      ...buildBaseProps(),
      sections: { plot: "", owner: "", land: "", registryCourt: "", financial: "", verify: "" },
      css: "",
    } as any);
    expect(html).not.toContain('id="section-map"');
  });

  it("renders the failed-state MapCard when plotDiagram.status is 'failed'", () => {
    const html = buildBuyerPage({
      reportId: "CLD-2026-0142",
      header: buildHeader(),
      ...buildBaseProps(),
      plotDiagram: { status: "failed", reason: "WFS timeout" },
      sections: { plot: "", owner: "", land: "", registryCourt: "", financial: "", verify: "" },
      css: "",
    } as any);
    expect(html).toContain('id="section-map"');
    expect(html).toContain("Map unavailable");
  });
});
