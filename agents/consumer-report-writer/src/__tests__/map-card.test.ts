/**
 * MapCard — Phase 2 v1 tests.
 *
 * MapCard v1 is the premium hero chrome around the interactive plot
 * map. It server-renders:
 *   - A poster <img> with the cached SVG (visible until the bootstrap
 *     script mounts the map; visible forever if MapLibre fails to load)
 *   - A <div id="mapcard-v1"> carrying all geo data as data-* attrs
 *   - The layer toggle buttons (now real <button>s, not <span>s)
 *   - A <script src="/mapcard-v1.js" defer> tag
 *   - A <noscript> fallback
 *   - The "Verify on Bhulekh" CTA
 *
 * Compatibility contract:
 *   - renderMapCard() returns "" when no plot diagram is available
 *     so existing reports without a diagram are byte-for-byte
 *     identical.
 *   - status="success" → data-state="verified" + the full map shell
 *   - status="partial" → data-state="partial" + the map shell (no glow)
 *   - status="failed"/"not_attempted" → the fallback CTA only, no map div
 *   - The "Verify on Bhulekh" link is always rendered when there is
 *     a URL — even on partial — because Bhulekh is the canonical
 *     source for boundary verification.
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

const SAMPLE_POLYGON = {
  type: "Polygon" as const,
  coordinates: [
    [
      [85.701, 20.272],
      [85.702, 20.272],
      [85.702, 20.273],
      [85.701, 20.273],
      [85.701, 20.272],
    ],
  ],
};
const SAMPLE_NEIGHBORS = [
  {
    plotNo: "128",
    village: "Mendhasala",
    tehsil: "Bhubaneswar",
    polygon: SAMPLE_POLYGON,
    areaSqKm: 0.1,
  },
];
const SAMPLE_BOUNDS = { minLat: 20.27, maxLat: 20.28, minLon: 85.7, maxLon: 85.71 };

describe("MapCard — no diagram", () => {
  it("returns '' when plotDiagram is null", () => {
    expect(renderMapCard({ plotDiagram: null })).toBe("");
  });

  it("returns '' when plotDiagram is undefined", () => {
    expect(renderMapCard({})).toBe("");
  });

  // v0 had this as "" too. v1 keeps the same behavior — not_attempted
  // without a URL means "the diagram step never ran" → no card.
  it("returns '' when plotDiagram is not_attempted and has no url", () => {
    expect(renderMapCard({ plotDiagram: { status: "not_attempted" } })).toBe("");
  });
});

describe("MapCard — success", () => {
  const html = renderMapCard({
    plotDiagram: {
      status: "success",
      url: "https://cleardeed.example/diagrams/abc.svg",
      cacheHit: false,
      targetPolygon: SAMPLE_POLYGON,
      neighbors: SAMPLE_NEIGHBORS,
      roads: [],
      bounds: SAMPLE_BOUNDS,
      bhulekhUrl: "https://bhulekh.ori.nic.in/RoRView.aspx",
    },
    plotNo: "309",
    village: "Mendhasala",
  });

  it("wraps the diagram in a section with id section-map", () => {
    expect(html).toContain('id="section-map"');
  });

  it("sets data-state='verified' on the section", () => {
    expect(html).toContain('data-state="verified"');
  });

  it("embeds the poster <img> with the storage URL (not inline SVG)", () => {
    expect(html).toMatch(/<img[^>]+src="https:\/\/cleardeed\.example\/diagrams\/abc\.svg"/);
    expect(html).toContain("alt=");
  });

  it("emits the #mapcard-v1 div with all geo data-* attributes", () => {
    expect(html).toContain('id="mapcard-v1"');
    expect(html).toContain("data-plot=");
    expect(html).toContain("data-neighbors=");
    expect(html).toContain("data-roads=");
    expect(html).toContain("data-bounds=");
    expect(html).toContain("data-target-centroid=");
    expect(html).toContain("data-bhulekh-url=");
    expect(html).toContain("data-plot-no=");
    expect(html).toContain("data-village=");
  });

  it("emits the <script> tag with defer + crossorigin", () => {
    expect(html).toMatch(
      /<script\s+src="\/mapcard-v1\.js"\s+defer\s+crossorigin="anonymous"\s*>\s*<\/script>/
    );
  });

  it("emits a <noscript> fallback", () => {
    expect(html).toContain("<noscript>");
    expect(html).toContain("</noscript>");
    expect(html).toContain("Interactive map requires JavaScript");
  });

  it("shows the 'Cadastral map verified' badge on success", () => {
    expect(html).toContain("Cadastral map verified");
  });

  it("renders the 'Verify on Bhulekh' link", () => {
    expect(html).toContain("Verify on Bhulekh");
    expect(html).toContain("bhulekh.ori.nic.in");
  });

  it("renders the layer toggle buttons (Satellite / Cadastral / Both)", () => {
    expect(html).toContain("Satellite");
    expect(html).toContain("Cadastral");
    expect(html).toContain("Both");
    // v1: these are <button>s, not <span>s, so the bootstrap can wire them.
    expect(html).toContain('<button class="map-card-layer-btn is-active"');
    expect(html).toContain('data-layer="satellite"');
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
        targetPolygon: SAMPLE_POLYGON,
        bounds: SAMPLE_BOUNDS,
      },
    });
    expect(html2).not.toContain('<script>alert');
    expect(html2).toContain("&lt;script&gt;");
  });

  it("escapes JSON in data-* attrs — owner names with apostrophes stay inside the attribute", () => {
    // An owner name with a single-quote inside the JSON payload
    // (e.g. {"plotNo":"D'Costa"}) must not break the data-* attr
    // boundary. The escape function should backslash-escape the
    // single quote.
    const html2 = renderMapCard({
      plotDiagram: {
        status: "success",
        url: "https://x.com/a.svg",
        targetPolygon: SAMPLE_POLYGON,
        neighbors: [
          {
            plotNo: "D'Costa",
            village: "Mendhasala",
            tehsil: "Bhubaneswar",
            polygon: SAMPLE_POLYGON,
            areaSqKm: 0.1,
          },
        ],
        bounds: SAMPLE_BOUNDS,
      },
    });
    // The data-neighbors attribute should be present and well-formed.
    expect(html2).toMatch(/data-neighbors='[^']*D\\'Costa[^']*'/);
  });
});

describe("MapCard — partial", () => {
  const html = renderMapCard({
    plotDiagram: {
      status: "partial",
      url: "https://cleardeed.example/diagrams/abc.svg",
      targetPolygon: SAMPLE_POLYGON,
      neighbors: [],
      bounds: SAMPLE_BOUNDS,
    },
  });

  it("sets data-state='partial' on the section", () => {
    expect(html).toContain('data-state="partial"');
  });

  it("shows the 'Map partially available' badge", () => {
    expect(html).toContain("Map partially available");
  });

  it("still emits the map div + script tag (the map renders, just without the gold glow)", () => {
    expect(html).toContain('id="mapcard-v1"');
    expect(html).toContain('<script src="/mapcard-v1.js"');
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

  it("sets data-state='unverified'", () => {
    expect(html).toContain('data-state="unverified"');
  });

  it("mentions the failure reason when present", () => {
    expect(html).toContain("WFS timeout");
  });

  it("still offers the 'Verify on Bhulekh' deep link", () => {
    expect(html).toContain("Verify on Bhulekh");
  });

  it("does NOT embed the #mapcard-v1 div (no map)", () => {
    expect(html).not.toContain('id="mapcard-v1"');
  });

  it("does NOT emit the <script> tag (no bootstrap, no map)", () => {
    expect(html).not.toContain("mapcard-v1.js");
  });

  it("does NOT embed an <img> tag (no URL)", () => {
    expect(html).not.toContain("<img");
  });
});

describe("MapCard — not_attempted", () => {
  it("renders the fallback CTA when status is not_attempted with a URL", () => {
    const html = renderMapCard({
      plotDiagram: {
        status: "not_attempted",
        url: "https://x.com/a.svg",
        reason: "no_target_polygon",
      },
    });
    expect(html).toContain("Map unavailable");
    expect(html).toContain("data-state=\"unverified\"");
    // No map shell.
    expect(html).not.toContain('id="mapcard-v1"');
  });
});

describe("MapCard — idempotence", () => {
  it("returns identical output for identical input", () => {
    const a = renderMapCard({
      plotDiagram: {
        status: "success",
        url: "https://x.com/a.svg",
        targetPolygon: SAMPLE_POLYGON,
        bounds: SAMPLE_BOUNDS,
      },
    });
    const b = renderMapCard({
      plotDiagram: {
        status: "success",
        url: "https://x.com/a.svg",
        targetPolygon: SAMPLE_POLYGON,
        bounds: SAMPLE_BOUNDS,
      },
    });
    expect(a).toBe(b);
  });

  it("does not mutate the input", () => {
    const plotDiagram = {
      status: "success" as const,
      url: "https://x.com/a.svg",
      targetPolygon: SAMPLE_POLYGON,
    };
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
      plotDiagram: {
        status: "success",
        url: "https://x.com/a.svg",
        targetPolygon: SAMPLE_POLYGON,
        bounds: SAMPLE_BOUNDS,
      },
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
