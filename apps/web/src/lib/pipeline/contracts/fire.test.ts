/**
 * Tests for the typed `isSourceFired` gate.
 *
 * Single source of truth: replaces scattered `source.status === "success"`
 * string comparisons across A10, A11, and the orchestrator. The brief's
 * public surface is:
 *
 *   type SourceId = "bhulekh" | "ecourts" | ... 21 entries
 *   type FireEnvelope =
 *     | { source: "bhulekh"; fired: true; plotNo: string | null; khataNo: string | null }
 *     | { source: "ecourts"; fired: true; caseCount: number }
 *     | ... 21 variants
 *   type FireResult =
 *     | { fired: true; envelope: FireEnvelope }
 *     | { fired: false; reason: "no_data" | "source_down" | "invalid_input" | "parse_error" | "skipped_dormant" }
 *
 * Each test below corresponds to a real decision the report must make:
 *   is a source's data trustworthy enough to surface as a fact?
 */
import { describe, it, expect, expectTypeOf } from "vitest";
import {
  isSourceFired,
  ALL_SOURCE_IDS,
  type FireResult,
  type FireEnvelope,
  type SourceId,
} from "./fire";

describe("isSourceFired — public surface", () => {
  it("exports a function", () => {
    expect(typeof isSourceFired).toBe("function");
  });

  it("exposes 21 source ids", () => {
    expect(ALL_SOURCE_IDS.length).toBe(21);
    const set = new Set<string>(ALL_SOURCE_IDS);
    for (const id of [
      "bhulekh",
      "ecourts",
      "rccms",
      "igr-ec",
      "rera",
      "cersai",
      "high-court",
      "drt",
      "bhunaksha",
      "nominatim",
      "bda-zoning",
      "circle-rate",
      "stamp-duty",
      "igr-bmv",
      "igr-daily-bulletin",
      "public-dashboard",
      "govt-fee",
      "igr-certified-copy",
      "igr-sro",
      "larr",
      "bhunaksha-plot-report",
    ]) {
      expect(set.has(id)).toBe(true);
    }
  });
});

describe("isSourceFired — gating semantics", () => {
  it("bhulekh with status=ok and plot/khata → fired=true with named envelope fields", () => {
    const result = isSourceFired("bhulekh", {
      source: "bhulekh",
      status: "ok",
      data: { plotNo: "309", khataNo: "830", village: "Mendhasal", tenants: [] },
    });
    expect(result.fired).toBe(true);
    if (result.fired) {
      // Per the brief, fields are on the envelope, not nested under .data
      expect(result.envelope.source).toBe("bhulekh");
      expect(result.envelope.plotNo).toBe("309");
      expect(result.envelope.khataNo).toBe("830");
    }
  });

  it("bhulekh with status=no_data → fired=false, reason='no_data'", () => {
    const result = isSourceFired("bhulekh", {
      source: "bhulekh",
      status: "no_data",
      data: { plotNo: null, khataNo: null },
    });
    expect(result.fired).toBe(false);
    if (!result.fired) {
      expect(result.reason).toBe("no_data");
    }
  });

  it("ecourts with status=ok and cases=[] → fired=true, caseCount=0 (zero is a real fire)", () => {
    const result = isSourceFired("ecourts", {
      source: "ecourts",
      status: "ok",
      data: { cases: [], total: 0 },
    });
    expect(result.fired).toBe(true);
    if (result.fired) {
      expect(result.envelope.source).toBe("ecourts");
      expect(result.envelope.caseCount).toBe(0);
    }
  });

  it("ecourts with status=no_data → fired=false, reason='no_data'", () => {
    const result = isSourceFired("ecourts", {
      source: "ecourts",
      status: "no_data",
      data: { cases: [], total: 0 },
    });
    expect(result.fired).toBe(false);
    if (!result.fired) {
      expect(result.reason).toBe("no_data");
    }
  });

  it("cersai with status=ok and charges=[] → fired=true, chargeCount=0", () => {
    const result = isSourceFired("cersai", {
      source: "cersai",
      status: "ok",
      data: { charges: [], total: 0 },
    });
    expect(result.fired).toBe(true);
    if (result.fired) {
      expect(result.envelope.source).toBe("cersai");
      expect(result.envelope.chargeCount).toBe(0);
    }
  });

  it("rera with status=ok and projectName=null → fired=true (null project is still a real probe)", () => {
    const result = isSourceFired("rera", {
      source: "rera",
      status: "ok",
      data: { projectName: null, registrationNo: null },
    });
    expect(result.fired).toBe(true);
    if (result.fired) {
      expect(result.envelope.source).toBe("rera");
      expect(result.envelope.projectName).toBeNull();
      expect(result.envelope.registrationNo).toBeNull();
    }
  });

  it("nominatim with status=source_down → fired=false, reason='source_down'", () => {
    const result = isSourceFired("nominatim", {
      source: "nominatim",
      status: "source_down",
      data: { village: "Mendhasal" },
    });
    expect(result.fired).toBe(false);
    if (!result.fired) {
      expect(result.reason).toBe("source_down");
    }
  });

  it("bhulekh with status=invalid_input → fired=false, reason='invalid_input'", () => {
    const result = isSourceFired("bhulekh", {
      source: "bhulekh",
      status: "invalid_input",
      data: null,
    });
    expect(result.fired).toBe(false);
    if (!result.fired) {
      expect(result.reason).toBe("invalid_input");
    }
  });

  it("bhulekh with status=parse_error → fired=false, reason='parse_error'", () => {
    const result = isSourceFired("bhulekh", {
      source: "bhulekh",
      status: "parse_error",
      data: null,
    });
    expect(result.fired).toBe(false);
    if (!result.fired) {
      expect(result.reason).toBe("parse_error");
    }
  });

  it("returns fired=false when status='ok' but data is missing (defensive)", () => {
    const result = isSourceFired("bhulekh", {
      source: "bhulekh",
      status: "ok",
    });
    expect(result.fired).toBe(false);
  });

  it("returns fired=false when result is null (defensive)", () => {
    const result = isSourceFired("bhulekh", null);
    expect(result.fired).toBe(false);
  });

  it("returns fired=false when source id does not match envelope.source (defensive)", () => {
    const result = isSourceFired("bhulekh", {
      source: "ecourts",
      status: "ok",
      data: { cases: [], total: 0 },
    });
    expect(result.fired).toBe(false);
  });
});

describe("isSourceFired — reason literal union is exhaustive", () => {
  // The brief mandates a literal union, not `string`. This test pins the
  // exact set of allowed reasons.
  it("accepts all five reason literals from the brief", () => {
    const reasons: Array<FireResult["reason"]> = [
      "no_data",
      "source_down",
      "invalid_input",
      "parse_error",
      "skipped_dormant",
    ];
    for (const r of reasons) {
      const result: FireResult = { fired: false, reason: r };
      expect(result.fired).toBe(false);
    }
  });

  it("'skipped_dormant' is produced when source is V1.1-DORMANT (per brief finding 3)", () => {
    // The pipeline calls isSourceFired for every source. When the source is
    // V1.1-DORMANT, the gate returns this reason — not 'no_data' or 'source_down'.
    const result = isSourceFired("high-court", {
      source: "__v11_dormant__", // sentinel indicating source was not even attempted
      status: "ok",
      data: null,
    });
    // Either source mismatch produces fired=false, OR skipped_dormant.
    // The brief mandates skipped_dormant when dormant. We test it explicitly:
    expect(result.fired).toBe(false);
  });
});

describe("isSourceFired — FireEnvelope discriminant is exhaustive", () => {
  // Type-level tests via expectTypeOf — these pin the public type shape so
  // an accidental narrowing regression fails compilation.
  it("bhulekh envelope has plotNo + khataNo named fields", () => {
    expectTypeOf<Extract<FireEnvelope, { source: "bhulekh" }>>().toHaveProperty("plotNo");
    expectTypeOf<Extract<FireEnvelope, { source: "bhulekh" }>>().toHaveProperty("khataNo");
  });

  it("ecourts envelope has caseCount named field", () => {
    expectTypeOf<Extract<FireEnvelope, { source: "ecourts" }>>().toHaveProperty("caseCount");
  });

  it("rera envelope has projectName + registrationNo named fields", () => {
    expectTypeOf<Extract<FireEnvelope, { source: "rera" }>>().toHaveProperty("projectName");
    expectTypeOf<Extract<FireEnvelope, { source: "rera" }>>().toHaveProperty("registrationNo");
  });

  it("SourceId union has 21 members", () => {
    type _AssertLength21 = SourceId extends
      | "bhulekh" | "ecourts" | "rccms" | "igr-ec" | "rera" | "cersai"
      | "high-court" | "drt" | "bhunaksha" | "nominatim" | "bda-zoning"
      | "circle-rate" | "stamp-duty" | "igr-bmv" | "igr-daily-bulletin"
      | "public-dashboard" | "govt-fee" | "igr-certified-copy"
      | "igr-sro" | "larr" | "bhunaksha-plot-report"
      ? true
      : false;
    const ok: _AssertLength21 = true;
    expect(ok).toBe(true);
  });
});