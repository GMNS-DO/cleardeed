// @vitest-environment jsdom
//
// Tests for the MapCard v1 bootstrap script (apps/web/public/mapcard-v1.js).
//
// We don't load the real maplibre-gl (it's a CDN bundle). Instead we
// stub `window.maplibregl` with a minimal class that records calls,
// and we verify:
//   - the script reads data-* attributes correctly
//   - the map is only instantiated for verified/partial states
//   - the toggle buttons update localStorage + setLayoutProperty
//   - bounds are clamped to the Khordha district
//   - the .mapcard-failed class is added on any error path
//
// The script is loaded by reading the file as a string and
// `eval`-ing it inside a fresh window scope. This avoids depending
// on the CDN at test time.

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const SCRIPT_PATH = resolve(__dirname, "mapcard-v1.js");

// Capture every Map constructor call and every setLayoutProperty call.
function makeMaplibreStub() {
  const calls = { constructor: [], setLayoutProperty: [] };
  class FakeMap {
    constructor(opts) {
      calls.constructor.push(opts);
      this._opts = opts;
    }
    addControl() {}
    on() { return this; }
    once(_evt, cb) {
      // Fire the callback synchronously so tests don't have to
      // await an idle frame. Real maps fire 'idle' asynchronously.
      if (typeof cb === "function") cb();
      return this;
    }
    project(coord) {
      // Simple linear projection — enough to exercise the
      // chauhaddi-arrow code path without a real map.
      return { x: coord[0] * 1000, y: coord[1] * 1000 };
    }
    getLayer() { return true; }
    setLayoutProperty(layer, prop, value) {
      calls.setLayoutProperty.push({ layer, prop, value });
    }
  }
  class NavigationControl { constructor() {} }
  return { maplibregl: { Map: FakeMap, NavigationControl }, calls };
}

const SAMPLE_POLYGON = {
  type: "Polygon",
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
// A minimal Khordha district Feature for the approximate-mode tests.
// A real one is ~1900 vertices; one vertex is enough to exercise the
// branch that adds the district source + layers.
const SAMPLE_DISTRICT = {
  type: "Feature",
  properties: { title: "Khordha" },
  geometry: {
    type: "Polygon",
    coordinates: [
      [
        [85.0, 19.8],
        [86.0, 19.8],
        [86.0, 20.5],
        [85.0, 20.5],
        [85.0, 19.8],
      ],
    ],
  },
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

/**
 * Build a #mapcard-v1 div with the supplied data attributes. Returns
 * the div so the test can also append it to document.body and trigger
 * the script's DOMContentLoaded handler.
 */
function buildMapDiv(attrs) {
  const div = document.createElement("div");
  div.id = "mapcard-v1";
  div.dataset.state = attrs.state;
  if (attrs.plot !== undefined) div.setAttribute("data-plot", JSON.stringify(attrs.plot));
  if (attrs.neighbors !== undefined) div.setAttribute("data-neighbors", JSON.stringify(attrs.neighbors));
  if (attrs.roads !== undefined) div.setAttribute("data-roads", JSON.stringify(attrs.roads));
  if (attrs.bounds) div.setAttribute("data-bounds", `${attrs.bounds.minLat},${attrs.bounds.maxLat},${attrs.bounds.minLon},${attrs.bounds.maxLon}`);
  if (attrs.centroid) div.setAttribute("data-target-centroid", `${attrs.centroid.lat},${attrs.centroid.lon}`);
  if (attrs.bhulekhUrl) div.setAttribute("data-bhulekh-url", attrs.bhulekhUrl);
  if (attrs.plotNo) div.setAttribute("data-plot-no", attrs.plotNo);
  if (attrs.village) div.setAttribute("data-village", attrs.village);
  if (attrs.mode) div.setAttribute("data-mode", attrs.mode);
  if (attrs.district !== undefined) div.setAttribute("data-district", JSON.stringify(attrs.district));
  // The bootstrap expects the div to be inside a .map-card-frame,
  // and there to be a poster <img> + toggle buttons.
  const frame = document.createElement("div");
  frame.className = "map-card-frame";
  const poster = document.createElement("img");
  poster.className = "mapcard-poster";
  frame.appendChild(poster);
  const toggle = document.createElement("div");
  toggle.className = "map-card-layer-toggle";
  ["both", "satellite", "cadastral"].forEach((layer) => {
    const b = document.createElement("button");
    b.className = "map-card-layer-btn";
    b.setAttribute("data-layer", layer);
    if (layer === "both") b.classList.add("is-active");
    toggle.appendChild(b);
  });
  frame.appendChild(div);
  frame.appendChild(toggle);
  document.body.appendChild(frame);
  return { div, frame, poster, toggle };
}

function clearDom() {
  document.body.innerHTML = "";
}

function loadAndRunScript() {
  // Read the script as a string and run it in the current window.
  // The script's IIFE installs a DOMContentLoaded handler, so we
  // dispatch the event after eval.
  const code = readFileSync(SCRIPT_PATH, "utf8");
  // eslint-disable-next-line no-eval
  eval(code);
  document.dispatchEvent(new Event("DOMContentLoaded"));
}

beforeEach(() => {
  // Reset the DOM and any stub state.
  clearDom();
  // Reset localStorage between tests so they don't leak state.
  try { window.localStorage.clear(); } catch (e) {}
  // Reset module-level state inside the script (maplibreLoading
  // is captured in the IIFE's closure; we re-eval the script on
  // every test which resets it).
});

afterEach(() => {
  clearDom();
  vi.restoreAllMocks();
});

describe("mapcard-v1.js — verified state", () => {
  it("instantiates MapLibre with the data-* attributes", async () => {
    const stub = makeMaplibreStub();
    window.maplibregl = stub.maplibregl;

    buildMapDiv({
      state: "verified",
      plot: SAMPLE_POLYGON,
      neighbors: SAMPLE_NEIGHBORS,
      roads: [],
      bounds: SAMPLE_BOUNDS,
      bhulekhUrl: "https://bhulekh.ori.nic.in/RoRView.aspx?plot=309",
      plotNo: "309",
      village: "Mendhasala",
    });

    loadAndRunScript();

    // Wait one microtask for the loadMapLibre promise to resolve.
    await new Promise((r) => setTimeout(r, 0));

    expect(stub.calls.constructor.length).toBe(1);
    const opts = stub.calls.constructor[0];
    expect(opts.style.sources.satellite.tiles[0]).toContain("arcgisonline.com");
    expect(opts.style.sources.cad.data.features.length).toBe(2); // target + 1 neighbor
    expect(opts.bounds[0]).toEqual([SAMPLE_BOUNDS.minLon, SAMPLE_BOUNDS.minLat]);
    expect(opts.bounds[1]).toEqual([SAMPLE_BOUNDS.maxLon, SAMPLE_BOUNDS.maxLat]);
  });
});

describe("mapcard-v1.js — unverified state", () => {
  it("does NOT instantiate MapLibre", async () => {
    const stub = makeMaplibreStub();
    window.maplibregl = stub.maplibregl;

    buildMapDiv({ state: "unverified" });
    loadAndRunScript();

    await new Promise((r) => setTimeout(r, 0));

    expect(stub.calls.constructor.length).toBe(0);
  });
});

describe("mapcard-v1.js — bounds clamping", () => {
  it("clamps out-of-district bounds to the Khordha box", async () => {
    const stub = makeMaplibreStub();
    window.maplibregl = stub.maplibregl;

    buildMapDiv({
      state: "verified",
      plot: SAMPLE_POLYGON,
      bounds: { minLat: 0, maxLat: 1, minLon: 0, maxLon: 1 }, // out of district
    });
    loadAndRunScript();

    await new Promise((r) => setTimeout(r, 0));

    const opts = stub.calls.constructor[0];
    // The script clamps the input bounds to Khordha (19.8/20.5 lat, 85/86 lon).
    expect(opts.bounds[0][0]).toBe(85); // minLon clamped
    expect(opts.bounds[0][1]).toBe(19.8); // minLat clamped
    expect(opts.bounds[1][0]).toBe(86); // maxLon clamped
    expect(opts.bounds[1][1]).toBe(20.5); // maxLat clamped
  });
});

describe("mapcard-v1.js — malformed data", () => {
  it("marks .mapcard-failed when data-plot is invalid JSON", async () => {
    const stub = makeMaplibreStub();
    window.maplibregl = stub.maplibregl;

    const { frame } = buildMapDiv({ state: "verified" });
    // Overwrite with invalid JSON.
    const div = frame.querySelector("#mapcard-v1");
    div.setAttribute("data-plot", "{not valid json");
    // The script reads it after we set the attribute, so we need
    // the rest of the attributes to be present too. Re-set them.
    div.setAttribute("data-neighbors", "[]");
    div.setAttribute("data-roads", "[]");

    loadAndRunScript();

    await new Promise((r) => setTimeout(r, 0));

    expect(frame.classList.contains("mapcard-failed")).toBe(true);
    expect(stub.calls.constructor.length).toBe(0);
  });

  it("marks .mapcard-failed when the polygon has < 4 vertices", async () => {
    const stub = makeMaplibreStub();
    window.maplibregl = stub.maplibregl;

    const { frame } = buildMapDiv({
      state: "verified",
      plot: {
        type: "Polygon",
        coordinates: [[[85, 20], [85, 20]]], // too few vertices
      },
    });
    loadAndRunScript();

    await new Promise((r) => setTimeout(r, 0));

    expect(frame.classList.contains("mapcard-failed")).toBe(true);
    expect(stub.calls.constructor.length).toBe(0);
  });
});

describe("mapcard-v1.js — layer toggle", () => {
  it("clicking a toggle button updates localStorage + setLayoutProperty", async () => {
    const stub = makeMaplibreStub();
    window.maplibregl = stub.maplibregl;

    const { frame, toggle } = buildMapDiv({
      state: "verified",
      plot: SAMPLE_POLYGON,
      bounds: SAMPLE_BOUNDS,
    });
    loadAndRunScript();

    await new Promise((r) => setTimeout(r, 0));

    const satBtn = toggle.querySelector('[data-layer="satellite"]');
    satBtn.click();

    expect(window.localStorage.getItem("mapcard.layers")).toBe("satellite");
    // "Satellite" = I want to see satellite (so satellite is ON, cadastral OFF).
    const sat = stub.calls.setLayoutProperty.find(
      (c) => c.layer === "satellite" && c.prop === "visibility"
    );
    expect(sat).toBeTruthy();
    expect(sat.value).toBe("visible");
    const cad = stub.calls.setLayoutProperty.find(
      (c) => c.layer === "neighbors-fill" && c.prop === "visibility"
    );
    expect(cad).toBeTruthy();
    expect(cad.value).toBe("none");
  });
});

describe("mapcard-v1.js — Verify CTA", () => {
  it("the CTA link is rendered with the data-bhulekh-url href", () => {
    // The Verify CTA is server-rendered (not by the bootstrap),
    // so this is a sanity test that the data-* attribute made it
    // through to the DOM. The bootstrap only attaches click
    // handlers if needed.
    const { div } = buildMapDiv({
      state: "verified",
      plot: SAMPLE_POLYGON,
      bhulekhUrl: "https://bhulekh.ori.nic.in/RoRView.aspx?plot=309",
    });
    expect(div.getAttribute("data-bhulekh-url")).toBe(
      "https://bhulekh.ori.nic.in/RoRView.aspx?plot=309"
    );
  });
});

describe("mapcard-v1.js — maplibre-gl load failure", () => {
  it("marks .mapcard-failed when maplibre-gl is not available", async () => {
    // Don't set window.maplibregl. The script's loadMapLibre will
    // try to inject a <script src=unpkg>, but in jsdom the load
    // event won't fire — so the promise stays pending. To make
    // the test deterministic we just verify the script does not
    // throw and does not crash the page.
    delete window.maplibregl;
    // Stub the document.createElement for <script> to fail-fast.
    const orig = document.createElement.bind(document);
    let scriptCreated = false;
    document.createElement = function (tag) {
      if (tag === "script") {
        scriptCreated = true;
        // Return a fake <script> that immediately errors.
        return {
          set src(_v) {},
          set async(_v) {},
          set crossOrigin(_v) {},
          set onload(_v) {},
          set onerror(cb) {
            // Fire the error asynchronously.
            setTimeout(() => cb(new Error("CDN unreachable")), 0);
          },
        };
      }
      return orig(tag);
    };

    const { frame } = buildMapDiv({
      state: "verified",
      plot: SAMPLE_POLYGON,
      bounds: SAMPLE_BOUNDS,
    });
    loadAndRunScript();

    // Wait for the script.onerror to fire.
    await new Promise((r) => setTimeout(r, 20));

    expect(scriptCreated).toBe(true);
    expect(frame.classList.contains("mapcard-failed")).toBe(true);

    // Restore.
    document.createElement = orig;
  });
});

describe("mapcard-v1.js — approximate mode (MapCard v1.1 fallback)", () => {
  it("instantiates MapLibre with the district source + layers, no target polygon", async () => {
    const stub = makeMaplibreStub();
    window.maplibregl = stub.maplibregl;

    buildMapDiv({
      state: "verified",
      // No `plot` — Bhunaksha returned no polygon.
      neighbors: [],
      roads: [],
      bounds: { minLat: 19.8, maxLat: 20.5, minLon: 85, maxLon: 86 },
      centroid: { lat: 20.27, lon: 85.84 },
      mode: "approximate",
      district: SAMPLE_DISTRICT,
      plotNo: "415",
      village: "Somevillage",
    });

    loadAndRunScript();
    await new Promise((r) => setTimeout(r, 0));

    expect(stub.calls.constructor.length).toBe(1);
    const opts = stub.calls.constructor[0];
    const style = opts.style;
    // District source is added; the cad source is added (with 0 features
    // because there's no target and no neighbors).
    expect(style.sources.district).toBeTruthy();
    expect(style.sources.district.data).toEqual(SAMPLE_DISTRICT);
    expect(style.sources.cad.data.features).toEqual([]);
    // Layer order: satellite → district-fill → district-line → cad-fill → cad-line → neighbors-*
    const layerIds = style.layers.map((l) => l.id);
    expect(layerIds).toContain("district-fill");
    expect(layerIds).toContain("district-line");
    // District layers come BEFORE the cad layers (so the gold target
    // marker stays in front when the user is at district zoom).
    expect(layerIds.indexOf("district-fill")).toBeLessThan(layerIds.indexOf("cad-fill"));
  });

  it("uses the Khordha bounds for fitBounds (snaps to district zoom)", async () => {
    const stub = makeMaplibreStub();
    window.maplibregl = stub.maplibregl;

    buildMapDiv({
      state: "verified",
      bounds: { minLat: 19.8, maxLat: 20.5, minLon: 85, maxLon: 86 },
      mode: "approximate",
      district: SAMPLE_DISTRICT,
    });

    loadAndRunScript();
    await new Promise((r) => setTimeout(r, 0));

    const opts = stub.calls.constructor[0];
    expect(opts.bounds[0]).toEqual([85, 19.8]);
    expect(opts.bounds[1]).toEqual([86, 20.5]);
  });

  it("bails to .mapcard-failed when in approximate mode but district is missing", async () => {
    const stub = makeMaplibreStub();
    window.maplibregl = stub.maplibregl;

    const { frame } = buildMapDiv({
      state: "verified",
      bounds: { minLat: 19.8, maxLat: 20.5, minLon: 85, maxLon: 86 },
      mode: "approximate",
      // No district — the server somehow forgot it.
    });

    loadAndRunScript();
    await new Promise((r) => setTimeout(r, 0));

    expect(frame.classList.contains("mapcard-failed")).toBe(true);
    expect(stub.calls.constructor.length).toBe(0);
  });

  it("toggling cadastral off also hides the district layers", async () => {
    const stub = makeMaplibreStub();
    window.maplibregl = stub.maplibregl;

    const { toggle } = buildMapDiv({
      state: "verified",
      bounds: { minLat: 19.8, maxLat: 20.5, minLon: 85, maxLon: 86 },
      mode: "approximate",
      district: SAMPLE_DISTRICT,
    });
    loadAndRunScript();
    await new Promise((r) => setTimeout(r, 0));

    // Switch to "satellite" (cadastral + district OFF).
    toggle.querySelector('[data-layer="satellite"]').click();

    const districtFill = stub.calls.setLayoutProperty.find(
      (c) => c.layer === "district-fill" && c.prop === "visibility"
    );
    const districtLine = stub.calls.setLayoutProperty.find(
      (c) => c.layer === "district-line" && c.prop === "visibility"
    );
    expect(districtFill).toBeTruthy();
    expect(districtFill.value).toBe("none");
    expect(districtLine.value).toBe("none");
  });

  it("default mode is 'exact' when data-mode is absent (backwards compatible)", async () => {
    const stub = makeMaplibreStub();
    window.maplibregl = stub.maplibregl;

    // No mode, no district — this is the v1.0 exact path.
    buildMapDiv({
      state: "verified",
      plot: SAMPLE_POLYGON,
      bounds: SAMPLE_BOUNDS,
    });

    loadAndRunScript();
    await new Promise((r) => setTimeout(r, 0));

    const opts = stub.calls.constructor[0];
    // No district source on the exact path.
    expect(opts.style.sources.district).toBeUndefined();
    // And the target polygon is rendered.
    const cad = opts.style.sources.cad.data.features.find(
      (f) => f.properties.role === "target"
    );
    expect(cad).toBeTruthy();
  });
});
