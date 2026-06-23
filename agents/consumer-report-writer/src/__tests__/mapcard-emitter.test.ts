/**
 * MapCard v1 — server-side emitter tests.
 *
 * These tests pin the contract between the TypeScript emitter
 * (agents/consumer-report-writer/src/map-card.ts) and the
 * JavaScript bootstrap (apps/web/public/mapcard-v1.js). The
 * bootstrap reads the emitter's output via getElementById +
 * getAttribute, so any change to the emitter's HTML shape that
 * doesn't also update the bootstrap (or vice versa) is a contract
 * violation. The tests below make those contracts explicit.
 *
 * What we pin:
 *   - The #mapcard-v1 div exists in success and partial states
 *   - All geo data-* attributes are present and single-quoted
 *     (the bootstrap uses getAttribute, not .dataset, so the
 *     attribute names with hyphens like data-target-centroid
 *     work correctly)
 *   - JSON payloads are escaped — owner names with apostrophes
 *     stay inside the attribute boundary
 *   - The <script> tag is emitted only when the map div is emitted
 *     (failed state has neither)
 *   - Bounds attribute uses "lat,lat,lon,lon" CSV (matches the
 *     bootstrap's parseCsv reader)
 *   - data-target-centroid is "lat,lon" CSV (matches the bootstrap)
 *   - The poster <img> is always present in success/partial (even
 *     after the map mounts — the script hides it on 'idle')
 */

import { describe, it, expect } from "vitest";
import { renderMapCard } from "../map-card";

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

describe("emitter — verified contract", () => {
  const html = renderMapCard({
    plotDiagram: {
      status: "success",
      url: "https://x.com/diagram.svg",
      targetPolygon: SAMPLE_POLYGON,
      neighbors: SAMPLE_NEIGHBORS,
      roads: [],
      bounds: SAMPLE_BOUNDS,
      bhulekhUrl: "https://bhulekh.ori.nic.in/RoRView.aspx",
    },
    plotNo: "309",
    village: "Mendhasala",
  });

  it("emits <div id='mapcard-v1'>", () => {
    expect(html).toMatch(/<div\s+id="mapcard-v1"/);
  });

  it("emits data-state='verified' on the section AND on the div", () => {
    // The section has data-state; the div also has data-state so
    // the bootstrap can read it via getAttribute.
    expect(html).toContain('data-state="verified"');
    expect(html).toMatch(/id="mapcard-v1"[^>]*data-state="verified"|data-state="verified"[^>]*id="mapcard-v1"/);
  });

  it("emits data-plot as single-quoted JSON", () => {
    // The bootstrap reads via getAttribute("data-plot") and JSON.parses it.
    expect(html).toMatch(/data-plot='\{"type":"Polygon"/);
  });

  it("emits data-neighbors as single-quoted JSON array", () => {
    expect(html).toMatch(/data-neighbors='\[/);
  });

  it("emits data-roads as single-quoted JSON array", () => {
    expect(html).toMatch(/data-roads='\[\]/);
  });

  it("emits data-bounds as CSV: 'minLat,maxLat,minLon,maxLon'", () => {
    expect(html).toContain(`data-bounds="20.27,20.28,85.7,85.71"`);
  });

  it("emits data-target-centroid as CSV: 'lat,lon'", () => {
    // Centroid of the 5-vertex polygon: avg of all vertices.
    // (85.701+85.702+85.702+85.701+85.701)/5 = 85.7014
    // (20.272+20.272+20.273+20.273+20.272)/5 = 20.2724
    expect(html).toMatch(/data-target-centroid="20\.27\d+,85\.701\d+"/);
  });

  it("emits data-bhulekh-url as a double-quoted string", () => {
    expect(html).toContain('data-bhulekh-url="https://bhulekh.ori.nic.in/RoRView.aspx"');
  });

  it("emits data-plot-no and data-village as double-quoted strings", () => {
    expect(html).toContain('data-plot-no="309"');
    expect(html).toContain('data-village="Mendhasala"');
  });

  it("emits the <script src='/mapcard-v1.js' defer crossorigin> tag", () => {
    expect(html).toMatch(
      /<script\s+src="\/mapcard-v1\.js"\s+defer\s+crossorigin="anonymous"/
    );
  });

  it("emits a <noscript> fallback", () => {
    expect(html).toContain("<noscript>");
    expect(html).toContain("Interactive map requires JavaScript");
  });

  it("emits the <img class='mapcard-poster'> with the storage URL", () => {
    expect(html).toMatch(/<img\s+class="mapcard-poster"[^>]+src="https:\/\/x\.com\/diagram\.svg"/);
  });
});

describe("emitter — JSON escape: owner names with apostrophes", () => {
  it("backslash-escapes single quotes inside JSON payloads so the attribute boundary is preserved", () => {
    const html = renderMapCard({
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
    // The data-neighbors attribute is single-quoted. The single
    // quote in "D'Costa" must be backslash-escaped (JSON encoding
    // of `'` is `\'`). Without the escape, the attribute would
    // close early and the rest of the HTML would be malformed.
    expect(html).toMatch(/data-neighbors='[^']*D\\'Costa[^']*'/);
    // Sanity: there is no unescaped single quote followed by a
    // JSON-bracket boundary — that would mean the attribute
    // closed early.
    expect(html).not.toMatch(/D'Costa"\s+data-/);
  });
});

describe("emitter — partial contract", () => {
  const html = renderMapCard({
    plotDiagram: {
      status: "partial",
      url: "https://x.com/d.svg",
      targetPolygon: SAMPLE_POLYGON,
      neighbors: [],
      bounds: SAMPLE_BOUNDS,
    },
  });

  it("still emits the map div (partial renders the map, just without the gold glow)", () => {
    expect(html).toContain('id="mapcard-v1"');
  });

  it("sets data-state='partial' on the div", () => {
    expect(html).toContain('data-state="partial"');
  });

  it("emits data-neighbors as '[]' (no neighbour polygons)", () => {
    expect(html).toMatch(/data-neighbors='\[\]'/);
  });
});

describe("emitter — failed contract", () => {
  const html = renderMapCard({
    plotDiagram: { status: "failed", reason: "WFS timeout" },
  });

  it("does NOT emit #mapcard-v1 (no map to mount)", () => {
    expect(html).not.toContain('id="mapcard-v1"');
  });

  it("does NOT emit the <script> tag (bootstrap is unnecessary)", () => {
    expect(html).not.toContain("mapcard-v1.js");
  });

  it("does NOT emit the poster <img>", () => {
    expect(html).not.toContain("mapcard-poster");
  });

  it("still offers a 'Verify on Bhulekh' link", () => {
    expect(html).toContain("Verify on Bhulekh");
  });

  it("uses data-state='unverified' on the section so CSS can dim the badge", () => {
    expect(html).toContain('data-state="unverified"');
  });
});

describe("emitter — id stability across calls (idempotence)", () => {
  it("two identical calls produce byte-identical HTML", () => {
    const a = renderMapCard({
      plotDiagram: {
        status: "success",
        url: "https://x.com/a.svg",
        targetPolygon: SAMPLE_POLYGON,
        neighbors: SAMPLE_NEIGHBORS,
        bounds: SAMPLE_BOUNDS,
      },
    });
    const b = renderMapCard({
      plotDiagram: {
        status: "success",
        url: "https://x.com/a.svg",
        targetPolygon: SAMPLE_POLYGON,
        neighbors: SAMPLE_NEIGHBORS,
        bounds: SAMPLE_BOUNDS,
      },
    });
    expect(a).toBe(b);
  });
});

// MapCard v1.1 — approximate-mode emitter contract.
//
// Pin the wire shape between map-card.ts (emitter) and mapcard-v1.js
// (bootstrap). The bootstrap reads data-mode and data-district via
// getAttribute. If the attribute name or quoting changes here, the
// bootstrap will silently miss the mode flag and render a v1.0
// exact-mode map (district outline layer will be missing, chauhaddi
// arrows may try to draw on missing neighbours).
describe("emitter — approximate-mode contract (MapCard v1.1)", () => {
  const SAMPLE_DISTRICT = {
    data: [
      {
        type: "Feature",
        properties: { title: "Khordha" },
        geometry: {
          type: "Polygon",
          coordinates: [[[85, 19.8], [86, 19.8], [86, 20.5], [85, 20.5], [85, 19.8]]],
        },
      },
    ],
  };
  const html = renderMapCard({
    plotDiagram: {
      status: "success",
      url: "https://x.com/approx.svg",
      targetPolygon: SAMPLE_POLYGON,
      neighbors: [],
      roads: [],
      bounds: { minLat: 19.8, maxLat: 20.5, minLon: 85, maxLon: 86 },
      bhulekhUrl: "https://bhulekh.ori.nic.in/RoRView.aspx",
      approximate: true,
      approximateReason: "no_containing_polygon",
      khordhaBoundary: SAMPLE_DISTRICT,
    },
    plotNo: "415",
    village: "Somevillage",
  });

  it("emits data-mode='approximate' on the #mapcard-v1 div", () => {
    // The bootstrap reads data-mode to decide whether to add the
    // district source/layers. If the attribute name or value drifts,
    // the district layer will be missing.
    expect(html).toMatch(/id="mapcard-v1"[^>]*data-mode="approximate"|data-mode="approximate"[^>]*id="mapcard-v1"/);
  });

  it("emits data-district with the JSON-encoded Khordha boundary, single-quoted", () => {
    // Single-quoted because the value contains double quotes (JSON).
    // The bootstrap uses getAttribute + JSON.parse.
    expect(html).toMatch(/data-district='[^']*Khordha[^']*'/);
  });

  it("emits data-mode='exact' on the v1.0 success path (backwards-compatible default)", () => {
    // v1.0 reports have neither approximate nor a district boundary.
    // The bootstrap must still find a data-mode attr so its default
    // branch (no district layer) is reachable.
    const v10html = renderMapCard({
      plotDiagram: {
        status: "success",
        url: "https://x.com/v10.svg",
        targetPolygon: SAMPLE_POLYGON,
        neighbors: SAMPLE_NEIGHBORS,
        bounds: SAMPLE_BOUNDS,
      },
    });
    expect(v10html).toMatch(/id="mapcard-v1"[^>]*data-mode="exact"|data-mode="exact"[^>]*id="mapcard-v1"/);
    // data-district is empty string in exact mode (the bootstrap
    // bails on missing data-district only in approximate mode).
    expect(v10html).toMatch(/data-district=""/);
  });
});
