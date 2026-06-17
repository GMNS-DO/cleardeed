/**
 * P3 V1 test suite — 6 golden chains + A11 audit smoke + layout mode.
 *
 * Plan §4.7:
 *   - 6 golden chain fixtures; reasonA13 deterministic on repeat input.
 *   - Red-flag detection: each fixture exercises ≥ 1 flag (except
 *     SINGLE_TRANSFER and PARTITION which have no flags).
 *   - A11 audit smoke: summary matches the count-regex; no verdict
 *     language in nodes[].displayName or edges[].documentType.
 *   - Layout mode selection: 80-node fixture → list; 20-node
 *     desktop → svg; 20-node mobile → timeline.
 *
 * Plan §4.8 Go/No-Go: 6/6 golden chains + A11 smoke = GO.
 */

import { describe, it, expect } from "vitest";
import { reasonA13, chooseLayoutMode, A13InputSchema } from "./index";
import { A13ResultSchema } from "./schema";
import {
  ALL_GOLDEN_CHAINS,
  SINGLE_TRANSFER,
  PARTITION,
  MORTGAGE_NO_RELEASE,
  RAPID_FLIPS,
  INHERITANCE_UNRECORDED,
  PARTITION_MISSING_SHARES,
  type GoldenChain,
} from "../fixtures/golden-chains";

/** Verdict language that must NOT appear in A13 output (A11 rule). */
const VERDICT_LANGUAGE = [
  "ownership appears",
  "ownership seems",
  "title appears clear",
  "title looks good",
  "safe to purchase",
  "safe to buy",
  "no issues",
  "no problems",
  "legally sound",
  "verified clean",
  "all clear",
];

describe("Plan §4.8 P3 V1 gate — 6/6 golden chains", () => {
  for (const chain of ALL_GOLDEN_CHAINS) {
    it(`passes: ${chain.name}`, () => {
      const result = reasonA13(chain.input);

      // Validate against the schema
      expect(() => A13ResultSchema.parse(result)).not.toThrow();

      // Event count
      expect(result.events.length).toBe(chain.expected.eventCount);

      // Owner count
      expect(result.nodes.length).toBe(chain.expected.ownerCount);

      // Flag count (excluding OUTDATED_RECORDS which is a moving target)
      const substantiveFlags = result.flags.filter((f) => f.code !== "OUTDATED_RECORDS");
      expect(substantiveFlags.length).toBe(chain.expected.flagCount);

      // Specific flag code
      if (chain.expected.flagCode) {
        expect(result.flags.some((f) => f.code === chain.expected.flagCode)).toBe(true);
      }

      // Summary must conform to the count-regex (count-only, no prose)
      expect(result.summary).toMatch(/^\d+ events?, \d+ owners?(?:, \d+ (?:critical|warn|info) flags?)?$/);
    });
  }
});

describe("Determinism — same input gives same output", () => {
  it("is deterministic on repeated calls", () => {
    const a = reasonA13(SINGLE_TRANSFER.input);
    const b = reasonA13(SINGLE_TRANSFER.input);
    expect(a).toEqual(b);
  });

  it("produces stable node IDs (no random UUIDs)", () => {
    const r = reasonA13(SINGLE_TRANSFER.input);
    for (const node of r.nodes) {
      expect(node.id).toMatch(/^node:person:/);
    }
  });

  it("produces stable event IDs", () => {
    const r = reasonA13(SINGLE_TRANSFER.input);
    for (const event of r.events) {
      expect(event.id).toMatch(/^evt:/);
    }
  });
});

describe("Schema validation", () => {
  it("rejects invalid input with no plotNo", () => {
    expect(() => reasonA13({
      plotNo: "",
      mutationHistory: [],
      encumbranceEntries: [],
      tenants: [],
    })).toThrow();
  });

  it("rejects invalid viewport", () => {
    expect(() => reasonA13({
      plotNo: "415",
      mutationHistory: [],
      encumbranceEntries: [],
      tenants: [],
      viewport: "tablet" as any,
    })).toThrow();
  });
});

describe("Summary count-regex (plan §4.4)", () => {
  it("SINGLE_TRANSFER: '1 event, 2 owners'", () => {
    const r = reasonA13(SINGLE_TRANSFER.input);
    // Substantive flags only — OUTDATED_RECORDS is a moving target
    // and may fire on the 2010-dated fixture. We assert the summary
    // contains no warn or critical flags.
    expect(r.summary).not.toContain("warn flag");
    expect(r.summary).not.toContain("critical flag");
    expect(r.summary).toMatch(/^\d+ events?, \d+ owners?(?:, \d+ (?:critical|warn|info) flags?)?$/);
  });

  it("MORTGAGE_NO_RELEASE: critical flag in summary", () => {
    const r = reasonA13(MORTGAGE_NO_RELEASE.input);
    expect(r.summary).toContain("critical flag");
  });

  it("RAPID_FLIPS: warn flag in summary", () => {
    const r = reasonA13(RAPID_FLIPS.input);
    expect(r.summary).toContain("warn flag");
  });

  it("PARTITION: no warn or critical flags in summary", () => {
    const r = reasonA13(PARTITION.input);
    expect(r.summary).not.toContain("warn flag");
    expect(r.summary).not.toContain("critical flag");
  });

  it("singular 'event' and 'owner' are used correctly", () => {
    const r = reasonA13(SINGLE_TRANSFER.input);
    // 1 event, 2 owners (singular event, plural owners)
    expect(r.summary).toMatch(/^1 event, 2 owners/);
  });
});

describe("A11 audit smoke — no verdict language", () => {
  for (const chain of ALL_GOLDEN_CHAINS) {
    it(`summary of ${chain.name} contains no verdict language`, () => {
      const r = reasonA13(chain.input);
      const lc = r.summary.toLowerCase();
      for (const phrase of VERDICT_LANGUAGE) {
        expect(lc).not.toContain(phrase);
      }
    });

    it(`node displayName of ${chain.name} contains no verdict language`, () => {
      const r = reasonA13(chain.input);
      for (const node of r.nodes) {
        const lc = node.displayName.toLowerCase();
        for (const phrase of VERDICT_LANGUAGE) {
          expect(lc).not.toContain(phrase);
        }
      }
    });

    it(`edge documentType of ${chain.name} contains no verdict language`, () => {
      const r = reasonA13(chain.input);
      for (const edge of r.edges) {
        const docType = (edge.documentType ?? "").toLowerCase();
        for (const phrase of VERDICT_LANGUAGE) {
          expect(docType).not.toContain(phrase);
        }
      }
    });
  }
});

describe("Red-flag detection (plan §4.3)", () => {
  it("MORTGAGE_NO_RELEASE: critical, has body, has actionRequired", () => {
    const r = reasonA13(MORTGAGE_NO_RELEASE.input);
    const flag = r.flags.find((f) => f.code === "MORTGAGE_NO_RELEASE");
    expect(flag).toBeDefined();
    expect(flag!.severity).toBe("critical");
    expect(flag!.body).toMatch(/This plot has a 2010 mortgage/);
    expect(flag!.actionRequired).toMatch(/Verify with the lending bank/);
  });

  it("INHERITANCE_UNRECORDED: warn, has body", () => {
    const r = reasonA13(INHERITANCE_UNRECORDED.input);
    const flag = r.flags.find((f) => f.code === "INHERITANCE_UNRECORDED");
    expect(flag).toBeDefined();
    expect(flag!.severity).toBe("warn");
    expect(flag!.body.length).toBeGreaterThan(0);
  });

  it("RAPID_FLIPS: warn, has body", () => {
    const r = reasonA13(RAPID_FLIPS.input);
    const flag = r.flags.find((f) => f.code === "RAPID_FLIPS");
    expect(flag).toBeDefined();
    expect(flag!.severity).toBe("warn");
  });

  it("PARTITION_MISSING_SHARES: warn, has body", () => {
    const r = reasonA13(PARTITION_MISSING_SHARES.input);
    const flag = r.flags.find((f) => f.code === "PARTITION_MISSING_SHARES");
    expect(flag).toBeDefined();
    expect(flag!.severity).toBe("warn");
  });

  it("SINGLE_TRANSFER: no substantive flags (OUTDATED_RECORDS may fire)", () => {
    const r = reasonA13(SINGLE_TRANSFER.input);
    const substantive = r.flags.filter((f) => f.code !== "OUTDATED_RECORDS");
    expect(substantive).toHaveLength(0);
  });

  it("PARTITION (no missing-shares data): no flags", () => {
    const r = reasonA13(PARTITION.input);
    expect(r.flags).toHaveLength(0);
  });

  it("all flags reference the events that triggered them", () => {
    const r = reasonA13(MORTGAGE_NO_RELEASE.input);
    for (const flag of r.flags) {
      expect(flag.eventIds.length).toBeGreaterThan(0);
    }
  });
});

describe("Layout mode selection (plan §4.7)", () => {
  it("80-node fixture → 'list'", () => {
    const input = A13InputSchema.parse({
      plotNo: "BIG",
      mutationHistory: Array.from({ length: 80 }, (_, i) => ({
        mutationNumber: `M-${i}`,
        mutationDate: "2020-01-01",
        plotNo: "BIG",
        parties: [
          { name: `Owner ${i}`, role: "from" },
          { name: `Owner ${i + 1}`, role: "to" },
        ],
        docType: "sale",
      })),
      encumbranceEntries: [],
      tenants: [],
      viewport: "desktop",
    });
    const r = reasonA13(input);
    expect(r.layout.mode).toBe("list");
    expect(r.layout.reason).toContain("node_count>=80");
  });

  it("20-node desktop → 'svg'", () => {
    const input = A13InputSchema.parse({
      plotNo: "MED",
      mutationHistory: Array.from({ length: 20 }, (_, i) => ({
        mutationNumber: `M-${i}`,
        mutationDate: "2020-01-01",
        plotNo: "MED",
        parties: [
          { name: `Owner ${i}`, role: "from" },
          { name: `Owner ${i + 1}`, role: "to" },
        ],
        docType: "sale",
      })),
      encumbranceEntries: [],
      tenants: [],
      viewport: "desktop",
    });
    const r = reasonA13(input);
    expect(r.layout.mode).toBe("svg");
  });

  it("20-node mobile → 'timeline'", () => {
    const input = A13InputSchema.parse({
      plotNo: "MED-M",
      mutationHistory: Array.from({ length: 20 }, (_, i) => ({
        mutationNumber: `M-${i}`,
        mutationDate: "2020-01-01",
        plotNo: "MED-M",
        parties: [
          { name: `Owner ${i}`, role: "from" },
          { name: `Owner ${i + 1}`, role: "to" },
        ],
        docType: "sale",
      })),
      encumbranceEntries: [],
      tenants: [],
      viewport: "mobile",
    });
    const r = reasonA13(input);
    expect(r.layout.mode).toBe("timeline");
  });

  it("small plot (2 owners) → 'list'", () => {
    const r = reasonA13(SINGLE_TRANSFER.input);
    expect(r.layout.mode).toBe("list");
  });
});

describe("Confidence derivation", () => {
  it("is between 0 and 1", () => {
    for (const chain of ALL_GOLDEN_CHAINS) {
      const r = reasonA13(chain.input);
      expect(r.confidence).toBeGreaterThanOrEqual(0);
      expect(r.confidence).toBeLessThanOrEqual(1);
    }
  });

  it("richer inputs get higher confidence", () => {
    const poor = reasonA13({
      plotNo: "X",
      mutationHistory: [],
      encumbranceEntries: [],
      tenants: [],
    });
    const rich = reasonA13(RAPID_FLIPS.input);
    expect(rich.confidence).toBeGreaterThan(poor.confidence);
  });
});

describe("Edge construction", () => {
  it("sale creates 'sold_to' edge", () => {
    const r = reasonA13(SINGLE_TRANSFER.input);
    const saleEdge = r.edges.find((e) => e.relationship === "sold_to");
    expect(saleEdge).toBeDefined();
  });

  it("mortgage creates 'mortgaged_to' edge", () => {
    const r = reasonA13(MORTGAGE_NO_RELEASE.input);
    const mortgageEdge = r.edges.find((e) => e.relationship === "mortgaged_to");
    expect(mortgageEdge).toBeDefined();
  });

  it("edges have event IDs that point to real events", () => {
    const r = reasonA13(RAPID_FLIPS.input);
    const eventIds = new Set(r.events.map((e) => e.id));
    for (const edge of r.edges) {
      for (const eventId of edge.eventIds) {
        expect(eventIds.has(eventId)).toBe(true);
      }
    }
  });
});

describe("Sort — chronological ordering (plan §4.6)", () => {
  it("sorts events with mixed date formats", () => {
    const input: GoldenChain["input"] = {
      plotNo: "SORT",
      mutationHistory: [
        {
          mutationNumber: "M-2020",
          mutationDate: "2020-06-15",
          plotNo: "SORT",
          parties: [
            { name: "A", role: "from" },
            { name: "B", role: "to" },
          ],
        },
        {
          mutationNumber: "M-2010",
          mutationDate: "15/01/2010",
          plotNo: "SORT",
          parties: [
            { name: "C", role: "from" },
            { name: "A", role: "to" },
          ],
        },
        {
          mutationNumber: "M-2015",
          mutationDate: "2015-03-20",
          plotNo: "SORT",
          parties: [
            { name: "B", role: "from" },
            { name: "D", role: "to" },
          ],
        },
      ],
      encumbranceEntries: [],
      tenants: [{ tenantName: "D" }],
    };
    const r = reasonA13(input);
    // 2010 -> 2015 -> 2020
    expect(r.events[0].id).toContain("M-2010");
    expect(r.events[1].id).toContain("M-2015");
    expect(r.events[2].id).toContain("M-2020");
  });

  it("undated events go to the end", () => {
    const input: GoldenChain["input"] = {
      plotNo: "SORT2",
      mutationHistory: [
        {
          mutationNumber: "M-DATED",
          mutationDate: "2020-01-01",
          plotNo: "SORT2",
        },
        {
          mutationNumber: "M-UNDATED",
          plotNo: "SORT2",
        },
      ],
      encumbranceEntries: [],
      tenants: [],
    };
    const r = reasonA13(input);
    expect(r.events[0].id).toContain("M-DATED");
    expect(r.events[1].id).toContain("M-UNDATED");
  });
});

describe("Layout exports", () => {
  it("chooseLayoutMode is exported and pure", () => {
    const a = chooseLayoutMode(80, "desktop");
    const b = chooseLayoutMode(80, "desktop");
    expect(a).toEqual(b);
  });

  it("returns a Layout shape with mode, width, height, reason", () => {
    const l = chooseLayoutMode(20, "desktop");
    expect(["list", "svg", "timeline"]).toContain(l.mode);
    expect(l.width).toBeGreaterThan(0);
    expect(typeof l.reason).toBe("string");
  });
});
