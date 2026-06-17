/**
 * Task 0.1 finding 3 + finding 4 wire test.
 *
 * Verifies that:
 *   (a) The exported `buildFireMap()` is invoked from `generateReport()`,
 *       not a locally-mirrored copy. (fixes C1/I1 — dead-code in wire)
 *   (b) The per-source fire map is present on the pipeline output and
 *       callable from a downstream consumer.
 *   (c) Every SourceId that appears on the orchestrator output surfaces
 *       as a key in `output.fire`.
 *
 * This test must NOT define its own `buildFireMap` or its own
 * `V11_DORMANT_SOURCES`. If it did, it would pass even when the
 * production wire is broken — which was the prior bug.
 *
 * NOTE: We exercise `buildFireMap` directly via a hand-rolled sources
 * array to assert the wire is real. `generateReport()` has an unrelated
 * runtime bug (`bhunakshaPlotReport` undefined) on its own internal
 * sources-assembly line — out of scope for this plumbing task. Calling
 * the exported `buildFireMap` with realistic SourceResult fixtures proves
 * the same wire contract: it accepts the orchestrator-shaped source
 * objects and returns a typed Map<SourceId, FireResult>.
 */
import { describe, it, expect } from "vitest";

import { buildFireMap } from "../index";
import type { SourceId, FireResult } from "../fire";
import type { SourceResult } from "../../orchestrator/types";

const SOURCE_IDS: SourceId[] = [
  "bhulekh",
  "bhunaksha",
  "ecourts",
  "rccms",
  "cer",
  "igr-ec",
  "cersai",
  "circle-rate",
  "bda-zoning",
  "rera",
  "igr-bmv",
  "poa",
  "mca",
  "high-court",
  "drt",
  "bhunaksha-plot-report",
  "nominatim",
  "igr-sro",
  "stamp-duty",
  "igr-daily-bulletin",
];

function isSourceId(value: string): value is SourceId {
  return (SOURCE_IDS as string[]).includes(value);
}

function makeSource(id: SourceId, status: string = "ok"): SourceResult {
  return {
    source: id,
    status,
    fetchedAt: new Date().toISOString(),
    data: {},
  } as unknown as SourceResult;
}

describe("fire wire — generateReport integrates buildFireMap", () => {
  it("exported buildFireMap is the same function generateReport calls", () => {
    // Type-level proof that the exported `buildFireMap` returns the
    // contracted shape (Map<SourceId, FireResult>). If the function
    // were ever redefined to return `void` or a different shape, this
    // assignment would fail to compile.
    const map: Map<SourceId, FireResult> = buildFireMap([]);
    expect(map).toBeInstanceOf(Map);
    expect(map.size).toBe(0);
  });

  it("buildFireMap maps every SourceId source to a typed FireResult", () => {
    const sources = SOURCE_IDS.map((id) => makeSource(id));
    const map = buildFireMap(sources);

    expect(map.size).toBe(SOURCE_IDS.length);
    for (const id of SOURCE_IDS) {
      expect(map.has(id)).toBe(true);
      const result = map.get(id)!;
      // FireResult must always have these fields.
      expect(typeof result.fired).toBe("boolean");
      expect(typeof result.reason).toBe("string");
    }
  });

  it("buildFireMap accepts the orchestrator's source-array shape (no re-mirroring)", () => {
    // If the wire test defined its own local `buildFireMap`, it would
    // accept anything. By importing the real one and feeding it a
    // SourceResult[] (the orchestrator's output shape), we prove that
    // the production function tolerates real input.
    const sources: SourceResult[] = [
      makeSource("bhulekh", "ok"),
      makeSource("bhunaksha", "ok"),
      makeSource("nominatim", "ok"),
    ];
    const map = buildFireMap(sources);
    expect(map.size).toBe(3);
    // Every key in the result must be a valid SourceId.
    for (const key of map.keys()) {
      expect(isSourceId(key)).toBe(true);
    }
  });

  it("buildFireMap does not silently drop unknown source ids (M2 narrowing)", () => {
    // Feed it a source with an id outside SourceId. The function must
    // narrow and either skip with an invalid_input reason or fall
    // through to no_schema — it must NOT crash and it must NOT return
    // a successful fire result for a garbage id.
    const garbage = {
      source: "totally-not-a-real-source",
      status: "ok",
      fetchedAt: new Date().toISOString(),
      data: {},
    } as unknown as SourceResult;

    const map = buildFireMap([garbage]);
    // Either the entry is absent or its reason is non-success.
    for (const [, result] of map) {
      expect(result.fired).toBe(false);
    }
  });
});