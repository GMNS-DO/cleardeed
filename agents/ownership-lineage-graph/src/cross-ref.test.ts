/**
 * Tests for P3 V3 cross-document reference.
 *
 * Plan §4.5: join Bhulekh mutation.docNo to IGR EC entries.docNo
 * (after normalise). Attach a `crossRef` badge to the lineage
 * event when matched.
 */
import { describe, it, expect } from "vitest";
import { joinEventsToEc, attachCrossRefs, _internal } from "./cross-ref";
import type { LineageEvent } from "./schema";

function ev(overrides: Partial<LineageEvent> = {}): LineageEvent {
  return {
    id: "evt:test:1",
    date: "2024-01-01",
    kind: "sale",
    displayName: "Sale A → B",
    ...overrides,
  };
}

const { normaliseDocNo } = _internal;

describe("normaliseDocNo", () => {
  it("lowercases and strips whitespace", () => {
    expect(normaliseDocNo("DOC 123")).toBe("doc123");
  });
  it("strips slashes", () => {
    expect(normaliseDocNo("2026/KH/12345")).toBe("kh12345");
  });
  it("drops a leading 4-digit year prefix", () => {
    expect(normaliseDocNo("2020/BH/987")).toBe("bh987");
    expect(normaliseDocNo("1999/SRO/1")).toBe("sro1");
  });
  it("drops leading zeros in numeric runs", () => {
    expect(normaliseDocNo("KH/00123")).toBe("kh123");
  });
  it("returns null for empty / whitespace / NIL", () => {
    expect(normaliseDocNo("")).toBe(null);
    expect(normaliseDocNo("   ")).toBe(null);
    expect(normaliseDocNo(null)).toBe(null);
    expect(normaliseDocNo(undefined)).toBe(null);
  });
  it("returns the normalised string for 'NIL' (after the strip)", () => {
    // 'NIL' is not a leading year, so it becomes 'nil'
    expect(normaliseDocNo("NIL")).toBe("nil");
  });
});

describe("joinEventsToEc", () => {
  it("returns an empty Map when both sides are empty", () => {
    const m = joinEventsToEc([], [], { reportId: "r1" });
    expect(m.size).toBe(0);
  });

  it("matches when docNo is identical after normalise", () => {
    const events = [ev({ id: "e1", docNo: "2024/KH/12345" })];
    const ec = [{ docNo: "2024/KH/12345" }];
    const m = joinEventsToEc(events, ec, { reportId: "r1" });
    expect(m.size).toBe(1);
    const badge = m.get("e1")!;
    expect(badge.label).toBe("Also in IGR EC");
    expect(badge.href).toBe("#igr-ec-entry-0");
    expect(badge.sourceName).toBe("igr-ec");
    expect(badge.matchedDocNo).toBe("2024/KH/12345");
  });

  it("matches across different year-prefix formats (year strip)", () => {
    // Bhulekh mutation says "2024/KH/12345"; IGR EC says "2020/KH/12345"
    // Both normalise to "kh12345" — that's a re-cite.
    const events = [ev({ id: "e1", docNo: "2024/KH/12345" })];
    const ec = [{ docNo: "2020/KH/12345" }];
    const m = joinEventsToEc(events, ec, { reportId: "r1" });
    expect(m.size).toBe(1);
  });

  it("does not match when deed numbers are genuinely different", () => {
    const events = [ev({ id: "e1", docNo: "KH/12345" })];
    const ec = [{ docNo: "KH/99999" }];
    const m = joinEventsToEc(events, ec, { reportId: "r1" });
    expect(m.size).toBe(0);
  });

  it("matches the first EC entry when multiple ECs share the same docNo", () => {
    const events = [ev({ id: "e1", docNo: "KH/100" })];
    const ec = [
      { docNo: "KH/100" },     // idx 0 - matched
      { docNo: "KH/100" },     // idx 1 - duplicate
      { docNo: "KH/200" },
    ];
    const m = joinEventsToEc(events, ec, { reportId: "r1" });
    expect(m.size).toBe(1);
    expect(m.get("e1")!.href).toBe("#igr-ec-entry-0");
  });

  it("skips events without a docNo", () => {
    const events = [ev({ id: "e1" /* no docNo */ })];
    const ec = [{ docNo: "KH/100" }];
    const m = joinEventsToEc(events, ec, { reportId: "r1" });
    expect(m.size).toBe(0);
  });

  it("skips EC entries without a docNo", () => {
    const events = [ev({ id: "e1", docNo: "KH/100" })];
    const ec = [{ /* no docNo */ }, { docNo: "KH/100" }];
    const m = joinEventsToEc(events, ec, { reportId: "r1" });
    expect(m.size).toBe(1);
    expect(m.get("e1")!.href).toBe("#igr-ec-entry-1");
  });

  it("uses a custom anchor prefix when provided", () => {
    const events = [ev({ id: "e1", docNo: "KH/1" })];
    const ec = [{ docNo: "KH/1" }];
    const m = joinEventsToEc(events, ec, {
      reportId: "r1",
      ecAnchorPrefix: "ec-row-",
    });
    expect(m.get("e1")!.href).toBe("#ec-row-0");
  });

  it("matches multiple events across multiple EC entries", () => {
    const events = [
      ev({ id: "e1", docNo: "KH/100" }),
      ev({ id: "e2", docNo: "KH/200" }),
      ev({ id: "e3", docNo: "KH/999" }), // no match
    ];
    const ec = [
      { docNo: "KH/200" },
      { docNo: "KH/100" },
    ];
    const m = joinEventsToEc(events, ec, { reportId: "r1" });
    expect(m.size).toBe(2);
    expect(m.has("e1")).toBe(true);
    expect(m.has("e2")).toBe(true);
    expect(m.has("e3")).toBe(false);
  });
});

describe("attachCrossRefs", () => {
  it("returns the original array reference when no badges", () => {
    const events = [ev({ id: "e1" })];
    const out = attachCrossRefs(events, new Map());
    expect(out).toBe(events);
  });

  it("returns new array with crossRef attached for matched events", () => {
    const events = [
      ev({ id: "e1", docNo: "KH/1" }),
      ev({ id: "e2", docNo: "KH/2" }),
    ];
    const badges = new Map([
      ["e1", { label: "Also in IGR EC", href: "#igr-ec-entry-0", sourceName: "igr-ec" }],
    ]);
    const out = attachCrossRefs(events, badges);
    expect(out).not.toBe(events);
    expect(out[0]!.crossRef).toBeDefined();
    expect(out[0]!.crossRef!.href).toBe("#igr-ec-entry-0");
    expect(out[1]!.crossRef).toBeUndefined();
    // Original events are not mutated
    expect(events[0]!.crossRef).toBeUndefined();
  });

  it("preserves all other event fields when attaching crossRef", () => {
    const events = [
      ev({
        id: "e1",
        docNo: "KH/1",
        date: "2024-06-01",
        kind: "mortgage",
        fromParty: "A",
        toParty: "B",
        displayName: "Mortgage A → B",
      }),
    ];
    const badges = new Map([
      ["e1", { label: "Also in IGR EC", href: "#0", sourceName: "igr-ec" }],
    ]);
    const out = attachCrossRefs(events, badges);
    expect(out[0]!.id).toBe("e1");
    expect(out[0]!.date).toBe("2024-06-01");
    expect(out[0]!.kind).toBe("mortgage");
    expect(out[0]!.fromParty).toBe("A");
    expect(out[0]!.toParty).toBe("B");
    expect(out[0]!.displayName).toBe("Mortgage A → B");
    expect(out[0]!.crossRef).toBeDefined();
  });
});