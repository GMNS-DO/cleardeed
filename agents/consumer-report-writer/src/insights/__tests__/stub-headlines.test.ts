// agents/consumer-report-writer/src/insights/__tests__/stub-headlines.test.ts
//
// T12 — assert every stub-rule emits a rule-specific headline, not the
// shared "Manual verification recommended" wall-of-grey. Each rule's
// headline is the buyer's first read; it must name the source gap and the
// verification action in one line.

import { describe, it, expect } from "vitest";
import { runInsights } from "../engine";
import { ALL_RULES } from "../registry";
import { stubFor } from "../registry/_shared";
import type { RuleInput, Rule } from "../schema";


const rorVerifiedInput: RuleInput = {
  ror: {
    status: "verified",
    page1: { kisam: "sthitiban", ownerField: "Krushna", area: "10.5" },
  } as any,
  bhunaksha: { status: "verified" } as any,
} as any;


// Every rule whose id is in this set should produce a rule-specific
// headline when its stub fires. We test the headline is NOT the shared
// fallback AND matches the unique pattern we set per rule.
const STUB_RULES_WITH_UNIQUE_HEADLINE: Array<{
  ruleId: string;
  expectedSubstring: string;
}> = [
  { ruleId: "ROR-INS-016", expectedSubstring: "RoR not retrieved" },
  { ruleId: "ROR-INS-025", expectedSubstring: "owner field unreadable" },
  { ruleId: "ROR-INS-033", expectedSubstring: "lease-deed" },
  { ruleId: "ROR-INS-034", expectedSubstring: "RoR not retrieved" },
  { ruleId: "ROR-INS-073", expectedSubstring: "Bhunaksha map" },
  { ruleId: "ROR-INS-083", expectedSubstring: "road access" },
  { ruleId: "ROR-INS-100", expectedSubstring: "Encumbrance Certificate" },
  { ruleId: "ROR-INS-101", expectedSubstring: "NOC" },
  { ruleId: "ROR-INS-102", expectedSubstring: "satisfaction" },
  { ruleId: "ROR-INS-103", expectedSubstring: "CERSAI" },
  { ruleId: "ROR-INS-104", expectedSubstring: "30-year" },
  { ruleId: "ROR-INS-110", expectedSubstring: "sale deed" },
  { ruleId: "ROR-INS-111", expectedSubstring: "PoA" },
  { ruleId: "ROR-INS-112", expectedSubstring: "circle rate" },
  { ruleId: "ROR-INS-113", expectedSubstring: "SRO" },
  { ruleId: "ROR-INS-114", expectedSubstring: "partition deed" },
  { ruleId: "ROR-INS-120", expectedSubstring: "eCourts" },
  { ruleId: "ROR-INS-121", expectedSubstring: "disposal order" },
  { ruleId: "ROR-INS-122", expectedSubstring: "not a clean negative" },
  { ruleId: "ROR-INS-130", expectedSubstring: "circle rate" },
  { ruleId: "ROR-INS-131", expectedSubstring: "clearance" },
  { ruleId: "ROR-INS-132", expectedSubstring: "lawyer must" },
  { ruleId: "ROR-INS-150", expectedSubstring: "sale deeds" },
  { ruleId: "ROR-INS-151", expectedSubstring: "4 sides" },
  // ROR-INS-152 was a stub in the recursive/zoning rules but T-052
  // moved it to bhulekh/bda-layout.ts as a real rule that fires on
  // sub-plot indicators. Drop it from STUB_RULES_WITH_UNIQUE_HEADLINE
  // — it's no longer a stub.
  { ruleId: "ROR-INS-153", expectedSubstring: "BDA" },
  { ruleId: "ROR-INS-201", expectedSubstring: "Bhuvan" },
];

// Build an input that triggers EVERY stub. ror.status="verified" is the
// gate every stub checks (per HIGH #4 design).
const STUB_FIRING_INPUT: RuleInput = {
  ror: {
    status: "verified",
    page1: {
      kisam: "sthitiban", // also fires ROR-INS-033
      ownerField: "Krushna",
      area: "10.5",
    },
  } as any,
  bhunaksha: { status: "missing" } as any, // forces ROR-INS-073 stub
  cersai: { activeCharge: false } as any, // forces ROR-INS-103 stub branch
  bhuvanFlood: undefined, // forces ROR-INS-201 stub
} as any;

describe("T12 — stub headlines are rule-specific, not the shared fallback", () => {
  it("no stub rule fires the wall-of-grey fallback", () => {
    const insights = runInsights(ALL_RULES, STUB_FIRING_INPUT);
    const wallOfGrey = insights.filter(
      (i) => i.headline === "Manual verification recommended"
    );
    expect(wallOfGrey).toEqual([]);
  });

  it.each(STUB_RULES_WITH_UNIQUE_HEADLINE)(
    "rule $ruleId emits rule-specific headline (matches /$expectedSubstring/)",
    ({ ruleId, expectedSubstring }) => {
      // Find the rule definition and run it with a stub-firing input.
      // Some rule ids collide across panels — find by id AND panel
      // when the test cares about a specific panel.
      const expectedPanel = expectedPanelFor(ruleId);
      const rule: Rule | undefined = ALL_RULES.find(
        (r) => r.id === ruleId && (expectedPanel ? r.panel === expectedPanel : true)
      );
      expect(rule, `rule ${ruleId} (panel=${expectedPanel ?? "any"}) should be in the registry`).toBeDefined();
      if (!rule) return;

      const input = stubFiringInputFor(ruleId);

      const insights = rule.fn(input) ?? [];
      expect(insights.length, `${ruleId} (panel=${rule.panel}) expected stub to fire with this input`).toBeGreaterThan(0);
      const headline = insights[0].headline;
      expect(
        headline,
        `${ruleId} should have a rule-specific headline containing "${expectedSubstring}", got: "${headline}"`
      ).toMatch(new RegExp(expectedSubstring, "i"));
    }
  );

  it("every rule-specific headline is under 100 characters", () => {
    for (const { ruleId } of STUB_RULES_WITH_UNIQUE_HEADLINE) {
      const expectedPanel = expectedPanelFor(ruleId);
      const rule = ALL_RULES.find(
        (r) => r.id === ruleId && (expectedPanel ? r.panel === expectedPanel : true)
      );
      if (!rule) continue;
      const input = stubFiringInputFor(ruleId);
      const insights = rule.fn(input) ?? [];
      for (const ins of insights) {
        expect(
          ins.headline.length,
          `${ruleId} headline too long: "${ins.headline}" (${ins.headline.length} chars)`
        ).toBeLessThan(100);
      }
    }
  });

  it("every rule-specific headline avoids the prohibited safe-to-buy language", () => {
    // StubFor returns watchout severity with a gap description; we
    // additionally check that no rule's headline accidentally contains
    // banned phrases like "safe to buy" or "guaranteed".
    const banned = [/safe to buy/i, /guaranteed clear/i, /no risk/i];
    for (const { ruleId } of STUB_RULES_WITH_UNIQUE_HEADLINE) {
      const expectedPanel = expectedPanelFor(ruleId);
      const rule = ALL_RULES.find(
        (r) => r.id === ruleId && (expectedPanel ? r.panel === expectedPanel : true)
      );
      if (!rule) continue;
      const input = stubFiringInputFor(ruleId);
      const insights = rule.fn(input) ?? [];
      for (const ins of insights) {
        for (const b of banned) {
          expect(ins.headline, `${ruleId} banned: ${ins.headline}`).not.toMatch(b);
        }
      }
    }
  });
});

// Some rule ids collide across panels. Map the test rule → expected
// panel so we find the right rule definition when id is shared.
//
// KNOWN COLLISION: ROR-INS-073 is registered TWICE — once in
// bhulekh/back-page-recency.ts (panel=backPage, fires when recent
// mutations lack sale-deed anchors) and once in bhunaksha/plot.ts
// (panel=plot, fires when Bhunaksha is missing). Each is a distinct
// rule but they share the id. We pin to panel="plot" for the stub-rule
// test, which is the one that calls stubFor. The back-page one emits its
// own non-stub headline. Resolving this id collision is a separate task.
function expectedPanelFor(ruleId: string): string | undefined {
  if (ruleId === "ROR-INS-073") return "plot"; // bhunaksha/plot.ts (Bhunaksha missing source)
  return undefined; // unique ids — match by id alone
}

// Per-rule stub-firing input. Each stub gates on a different condition.
// Pulling this into a function keeps the test body readable.
function stubFiringInputFor(ruleId: string): RuleInput {
  switch (ruleId) {
    case "ROR-INS-016":
      // ror present but NOT verified
      return { ror: { status: "partial" } } as any;
    case "ROR-INS-025":
      // ror verified, ownerFieldMissing flag set
      return {
        ror: { status: "verified", page1: { ownerFieldMissing: true } },
      } as any;
    case "ROR-033":
      // ror verified, kisam is sthitiban
      return {
        ror: { status: "verified", page1: { kisam: "sthitiban" } },
      } as any;
    case "ROR-INS-034":
      // ror not verified, kisam unknown
      return {
        ror: { status: "partial", page1: { kisam: "unknown_kisam_value" } },
      } as any;
    case "ROR-INS-073":
      // ror verified, bhunaksha absent (not just status="missing" —
      // liveDataPresent returns true for any non-empty object, so we
      // need the field itself to be undefined).
      return {
        ror: { status: "verified" },
      } as any;
    default:
      return rorVerifiedInput;
  }
}

// Bare-bones test that stubFor() still defaults to the wall-of-grey when
// called WITHOUT a custom headline. This protects backward compatibility
// — external callers that don't pass a headline still get the fallback.
describe("stubFor fallback behavior", () => {
  it("returns the fallback headline when no specific headline is passed", () => {
    const s = stubFor(
      "ROR-INS-EXTERNAL",
      "court",
      "title_chain",
      "parser_uncertain",
      "Body",
      "Action"
    );
    expect(s.headline).toBe("Manual verification recommended");
  });

  it("uses the custom headline when one is passed", () => {
    const s = stubFor(
      "ROR-INS-EXTERNAL",
      "court",
      "title_chain",
      "parser_uncertain",
      "Body",
      "Action",
      "EC not retrieved — request a 30-year EC"
    );
    expect(s.headline).toBe("EC not retrieved — request a 30-year EC");
  });
});
