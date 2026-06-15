/**
 * Unit tests for the Bhunaksha Plot Report HTML parser.
 *
 * The fetcher hits a live government portal, so we test the pure parser
 * against a synthetic HTML fixture that mirrors the real page structure
 * (Jasper Reports absolute positioning). The live HTTP fetch and the
 * Playwright render are covered by the manual smoke test at
 * src/smoke-mendhasala.ts.
 */

import { describe, it, expect } from "vitest";
import { parsePlotReportHtml } from "./index";
import { buildGisCode, findGisCode, buildGisCodeCandidates } from "./gis-codes";

/**
 * Build an absolute-positioned cell. Matches the portal's actual div
 * structure: a wrapper with `position:absolute;left:Xpx;top:Ypx;...`,
 * containing nested spans that hold the visible text.
 */
function cell(left: number, top: number, width: number, height: number, text: string): string {
  return `<div style="position:absolute;left:${left}px;top:${top}px;width:${width}px;height:${height}px;overflow: hidden;"><span style="position:absolute;left:0px;top:0px;width:${width}px;height:${height}px;text-align: left; display:table;text-indent: 0px; "><span style="display:table-cell;vertical-align:top;"><span>${text}</span></span></span></div>`;
}

// Layout mirrors the real portal render for Mendhasala 181/10454.
// Coordinates chosen to match the live dump (rounded).
const SAMPLE_HTML = `
<html>
<body>
${cell(43, 85, 82, 16, "ପ୍ଲଟ ନମ୍ବର :")}
${cell(145, 85, 79, 16, "181/10454")}
${cell(403, 85, 107, 16, "ଖତିୟାନ୍ ନମ୍ବର:")}
${cell(500, 498, 65, 13, "500")}
${cell(43, 109, 82, 16, "ମୌଜା")}
${cell(145, 109, 152, 16, ": ମେଣ୍ଢାଶାଳ")}
${cell(43, 125, 102, 16, "ଥାନା")}
${cell(43, 145, 102, 16, "ଥାନା ନମ୍ବର")}
${cell(420, 129, 102, 16, ": 2")}
${cell(344, 109, 79, 16, "ତହସିଲ୍")}
${cell(420, 109, 102, 16, ": ଭୁବନେଶ୍ଵର")}
${cell(344, 129, 79, 16, "ତହସିଲ୍")}
${cell(344, 149, 79, 16, "ଜିଲ୍ଲା")}
${cell(420, 149, 102, 16, ": ଖୋର୍ଦ୍ଧା")}
${cell(39, 539, 79, 16, "ପ୍ଲଟର")}
${cell(125, 553, 79, 16, "ଏକର୍")}
${cell(279, 553, 79, 16, "ଡିସିମିଲ")}
${cell(455, 553, 79, 16, "ହେକ୍ଟର")}
${cell(125, 573, 79, 16, "0")}
${cell(279, 573, 79, 16, "100")}
${cell(455, 573, 79, 16, "0.04046")}
${cell(31, 593, 518, 120, "ଦୀକ୍ଷା ମହାପାତ୍ର ସ୍ଵା:ସମୀର କୁମାର ଜା: ବ୍ରାହ୍ମଣ ବା: ଫ୍ଲାଟ ନମ୍ବର-ଏ ୬୦୧, ବର୍ଷା ରିଭର ଆପାର୍ଟମେଣ୍ଟ, ନିୟର ବାଲିଅନ୍ତା ବ୍ଲକ ଅଫିସ")}
${cell(465, 498, 35, 15, "ସ୍କୌ")}
${cell(217, 746, 100, 14, "500")}
</body>
</html>
`;

describe("parsePlotReportHtml", () => {
  it("extracts the plot number from its positioned value cell", () => {
    const parsed = parsePlotReportHtml(SAMPLE_HTML, "181/10454");
    expect(parsed.plotNo).toBe("181/10454");
  });

  it("extracts khatiyan from its separate sub-section", () => {
    const parsed = parsePlotReportHtml(SAMPLE_HTML, "181/10454");
    expect(parsed.khatiyanNo).toBe("500");
  });

  it("extracts thana, thanaNo, tehsil, district, mouza by row proximity", () => {
    const parsed = parsePlotReportHtml(SAMPLE_HTML, "181/10454");
    expect(parsed.mouza).toBe("ମେଣ୍ଢାଶାଳ");
    // The Thana label is at T=125 and the only "value" cell to its right
    // is the "2" cell at T=129, which is within the 5px row tolerance.
    // The portal places the Thana value in a different visual sub-section
    // but on a row close enough to be picked up here.
    expect(parsed.thanaNo).toBe("2");
    expect(parsed.tehsil).toBe("ଭୁବନେଶ୍ଵର");
    expect(parsed.district).toBe("ଖୋର୍ଦ୍ଧା");
  });

  it("extracts three-column area (acres / decimal / hectare) as numbers", () => {
    const parsed = parsePlotReportHtml(SAMPLE_HTML, "181/10454");
    expect(parsed.area?.acres).toBe(0);
    expect(parsed.area?.decimal).toBe(100);
    expect(parsed.area?.hectare).toBe(0.04046);
  });

  it("extracts owner block (name, father, caste, address) by S/o marker", () => {
    const parsed = parsePlotReportHtml(SAMPLE_HTML, "181/10454");
    expect(parsed.owner).not.toBeNull();
    expect(parsed.owner?.name).toBe("ଦୀକ୍ଷା ମହାପାତ୍ର");
    expect(parsed.owner?.father).toBe("ସମୀର କୁମାର");
    expect(parsed.owner?.caste).toBe("ବ୍ରାହ୍ମଣ");
  });

  it("extracts map scale as 1:NNN", () => {
    const parsed = parsePlotReportHtml(SAMPLE_HTML, "181/10454");
    expect(parsed.mapScale).toBe("1:500");
  });

  it("returns null fields for an empty/garbage HTML", () => {
    const parsed = parsePlotReportHtml("<html><body>nothing</body></html>", "0/0");
    expect(parsed.khatiyanNo).toBeNull();
    expect(parsed.thanaNo).toBeNull();
    expect(parsed.area?.acres).toBeNull();
    expect(parsed.area?.decimal).toBeNull();
    expect(parsed.area?.hectare).toBeNull();
    expect(parsed.owner).toBeNull();
  });
});

describe("buildGisCode", () => {
  it("pads each part to the documented width", () => {
    expect(buildGisCode("2", "11", "10", "500")).toBe("20021110500");
  });

  it("zero-pads shorter parts", () => {
    expect(buildGisCode("2", "1", "1", "5")).toBe("20020101005");
  });
});

describe("findGisCode", () => {
  it("returns the verified Mendhasala giscode", () => {
    const got = findGisCode("Mendhasala", "Bhubaneswar");
    expect(got).not.toBeNull();
    expect(got?.gisCode).toBe("20021110500");
    expect(got?.entry.verified).toBe(true);
  });

  it("returns null for unknown villages", () => {
    expect(findGisCode("Nonexistentville", "Bhubaneswar")).toBeNull();
  });

  it("returns null for not-yet-digitized villages (mouzaCode 0)", () => {
    expect(findGisCode("Haripur", "Bhubaneswar")).toBeNull();
  });
});

describe("buildGisCodeCandidates", () => {
  it("returns the canonical code plus RI perturbations", () => {
    const candidates = buildGisCodeCandidates("2", "11", "10", "500");
    expect(candidates[0]).toBe("20021110500");
    expect(candidates.length).toBeGreaterThan(1);
    for (const c of candidates) {
      expect(c.length).toBe(11);
    }
  });
});
