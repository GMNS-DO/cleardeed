import { describe, it, expect } from "vitest";
import {
  buildPatternPayload,
  computePatternCandidateKey,
} from "./build-pattern-payload";
import { PATTERN_EVENT_TYPE, PATTERN_FACT_PREDICATE_PREFIX } from "./types";
import type { Insight } from "@cleardeed/consumer-report-writer";

// Fixtures: representative insights that match what real Khordha reports fire.
function makeInsight(overrides: Partial<Insight> = {}): Insight {
  return {
    panel: "land",
    issueLens: "title_chain",
    evidenceStrength: "document_anchor",
    source: "bhulekh:ror:page-1",
    severity: "redFlag",
    headline: "Patia industrial-lease red flag",
    body: "Lease tenure on Raiyati khata",
    actionItem: "Verify IGR cross-check",
    ruleId: "ROR-INS-180",
    ...overrides,
  };
}

const baseRuleInput = {
  ror: {
    page1: {
      khatiyanNumber: "830",
      village: "Mendhasala",
      tahasil: "Bhubaneswar",
      tenant: { name: "Ram Kumar" },
    },
    page2: {
      selectedPlotNumber: "309",
    },
  },
  claimedOwnerName: "Ram Kumar",
  tehsil: "Bhubaneswar",
  village: "Mendhasala",
  plotGPS: { lat: 20.272688, lon: 85.701271 },
};

describe("computePatternCandidateKey", () => {
  it("is deterministic — same input → same key", () => {
    const insight = makeInsight({ ruleId: "ROR-INS-180" });
    const k1 = computePatternCandidateKey(insight, baseRuleInput);
    const k2 = computePatternCandidateKey(insight, baseRuleInput);
    expect(k1).toBe(k2);
  });

  it("starts with the ruleId", () => {
    const insight = makeInsight({ ruleId: "ROR-INS-040" });
    const k = computePatternCandidateKey(insight, baseRuleInput);
    expect(k.startsWith("ROR-INS-040:")).toBe(true);
  });

  it("differs across distinct subjects", () => {
    const insight = makeInsight({ ruleId: "ROR-INS-180" });
    const k1 = computePatternCandidateKey(insight, baseRuleInput);
    const k2 = computePatternCandidateKey(insight, {
      ...baseRuleInput,
      ror: {
        ...baseRuleInput.ror,
        page2: { selectedPlotNumber: "999" },
      },
    });
    expect(k1).not.toBe(k2);
  });

  it("hashes canonicalized inputs — case and whitespace don't matter", () => {
    const insight = makeInsight({ ruleId: "ROR-INS-180" });
    const k1 = computePatternCandidateKey(insight, baseRuleInput);
    const k2 = computePatternCandidateKey(insight, {
      ...baseRuleInput,
      ror: {
        page1: {
          khatiyanNumber: "  830  ",
          village: "MENDHASALA",
          tahasil: "  Bhubaneswar ",
          tenant: { name: "RAM KUMAR" },
        },
        page2: { selectedPlotNumber: "309" },
      },
    });
    expect(k1).toBe(k2);
  });

  it("includes plotNo even when the detector doesn't read it (ROR-INS-026)", () => {
    // ROR-INS-026 doesn't read input.ror.page2.selectedPlotNumber directly,
    // but the mapper must thread it from baseRuleInput into the hash so the
    // candidateKey differentiates between plots.
    const insight = makeInsight({ ruleId: "ROR-INS-026" });
    const kPlot309 = computePatternCandidateKey(insight, baseRuleInput);
    const kPlot999 = computePatternCandidateKey(insight, {
      ...baseRuleInput,
      ror: {
        ...baseRuleInput.ror,
        page2: { selectedPlotNumber: "999" },
      },
    });
    expect(kPlot309).not.toBe(kPlot999);
  });

  it("includes khataNo even when the detector doesn't read it (ROR-INS-040)", () => {
    const insight = makeInsight({ ruleId: "ROR-INS-040" });
    const kKhata830 = computePatternCandidateKey(insight, baseRuleInput);
    const kKhata999 = computePatternCandidateKey(insight, {
      ...baseRuleInput,
      ror: {
        ...baseRuleInput.ror,
        page1: { ...baseRuleInput.ror.page1, khatiyanNumber: "999" },
      },
    });
    expect(kKhata830).not.toBe(kKhata999);
  });

  it("still produces a stable key when RuleInput is mostly empty", () => {
    const insight = makeInsight({ ruleId: "ROR-INS-180" });
    const k = computePatternCandidateKey(insight, {});
    expect(k.startsWith("ROR-INS-180:")).toBe(true);
    expect(k.length).toBe("ROR-INS-180:".length + 16);
  });
});

describe("buildPatternPayload — empty / filtered input", () => {
  it("returns empty output for empty insights", () => {
    const out = buildPatternPayload({
      insights: [],
      ctx: { reportId: "r1", ruleInput: baseRuleInput },
    });
    expect(out.candidates).toEqual([]);
    expect(out.events).toEqual([]);
    expect(out.facts).toEqual([]);
  });

  it("filters out positive severity (not a fraud pattern)", () => {
    const positive = makeInsight({
      ruleId: "ROR-INS-180",
      severity: "positive",
    });
    const out = buildPatternPayload({
      insights: [positive],
      ctx: { reportId: "r1", ruleInput: baseRuleInput },
    });
    expect(out.candidates).toEqual([]);
  });

  it("filters out parser_uncertain evidence (any stub detector, not just BDA)", () => {
    const stub180 = makeInsight({
      ruleId: "ROR-INS-180",
      evidenceStrength: "parser_uncertain",
    });
    const stub153 = makeInsight({
      ruleId: "ROR-INS-153",
      evidenceStrength: "parser_uncertain",
    });
    const out = buildPatternPayload({
      insights: [stub180, stub153],
      ctx: { reportId: "r1", ruleInput: baseRuleInput },
    });
    expect(out.candidates).toEqual([]);
  });
});

describe("buildPatternPayload — single fired insight", () => {
  it("emits one candidate, one event, one fact for one fired redFlag", () => {
    const insight = makeInsight({ ruleId: "ROR-INS-180", severity: "redFlag" });
    const out = buildPatternPayload({
      insights: [insight],
      ctx: { reportId: "rpt-1", propertyId: "prop-1", ruleInput: baseRuleInput },
    });
    expect(out.candidates).toHaveLength(1);
    expect(out.events).toHaveLength(1);
    expect(out.facts).toHaveLength(1);

    // Candidate
    expect(out.candidates[0].candidateKey).toMatch(/^ROR-INS-180:[0-9a-f]{16}$/);
    expect(out.candidates[0].patternFamily).toBe("lease_resumption");
    expect(out.candidates[0].status).toBe("RAW_SIGNAL");
    expect(out.candidates[0].evidenceCount).toBe(1);
    expect(out.candidates[0].candidateName).toBe(insight.headline);
    expect(out.candidates[0].logicDescription).toBe(insight.body);
    expect(out.candidates[0].metadata).toMatchObject({
      ruleId: "ROR-INS-180",
      panel: "land",
      source: "bhulekh:ror:page-1",
    });

    // Event
    expect(out.events[0].eventType).toBe(PATTERN_EVENT_TYPE);
    expect(out.events[0].reviewStatus).toBe("unreviewed");
    expect(out.events[0].metadata).toMatchObject({
      ruleId: "ROR-INS-180",
      candidateKey: out.candidates[0].candidateKey,
      severity: "redFlag",
      reportId: "rpt-1",
    });

    // Fact
    expect(out.facts[0].predicate).toBe(
      `${PATTERN_FACT_PREDICATE_PREFIX}ROR-INS-180`,
    );
    expect(out.facts[0].rawValue).toBe(insight.headline);
    expect(out.facts[0].normalizedValue).toBe("redFlag");
    expect(out.facts[0].subjectType).toBe("pattern");
    expect(out.facts[0].valueJson).toMatchObject({
      ruleId: "ROR-INS-180",
      candidateKey: out.candidates[0].candidateKey,
      severity: "redFlag",
      panel: "land",
      headline: insight.headline,
    });
  });
});

describe("buildPatternPayload — multiple insights, dedup correctness", () => {
  it("dedupes by candidateKey — same rule firing twice → evidenceCount 2, two events, two facts", () => {
    const i1 = makeInsight({ ruleId: "ROR-INS-180", severity: "redFlag" });
    const i2 = makeInsight({ ruleId: "ROR-INS-180", severity: "redFlag" });
    const out = buildPatternPayload({
      insights: [i1, i2],
      ctx: { reportId: "r1", ruleInput: baseRuleInput },
    });
    expect(out.candidates).toHaveLength(1);
    expect(out.candidates[0].evidenceCount).toBe(2);
    expect(out.events).toHaveLength(2);
    expect(out.facts).toHaveLength(2);
  });

  it("does NOT collapse ROR-INS-210 + ROR-INS-211 on the same EOW hit (different candidateKeys)", () => {
    const i210 = makeInsight({
      ruleId: "ROR-INS-210",
      severity: "redFlag",
      panel: "ownershipChain",
      source: "eow:blacklist:plot",
    });
    const i211 = makeInsight({
      ruleId: "ROR-INS-211",
      severity: "redFlag",
      panel: "ownershipChain",
      source: "eow:blacklist:owner",
    });
    const out = buildPatternPayload({
      insights: [i210, i211],
      ctx: { reportId: "r1", ruleInput: baseRuleInput },
    });
    expect(out.candidates).toHaveLength(2);
    expect(out.candidates[0].candidateKey).not.toBe(out.candidates[1].candidateKey);
    expect(out.candidates[0].patternFamily).toBe("eow_blacklist_plot");
    expect(out.candidates[1].patternFamily).toBe("eow_blacklist_owner");
    expect(out.events).toHaveLength(2);
    expect(out.facts).toHaveLength(2);
  });

  it("emits one of each for distinct rules on distinct subjects", () => {
    const a = makeInsight({ ruleId: "ROR-INS-180" });
    const b = makeInsight({
      ruleId: "ROR-INS-040",
      panel: "plotTable",
      source: "bhulekh:ror:page-2",
    });
    const out = buildPatternPayload({
      insights: [a, b],
      ctx: { reportId: "r1", ruleInput: baseRuleInput },
    });
    expect(out.candidates).toHaveLength(2);
    expect(out.events).toHaveLength(2);
    expect(out.facts).toHaveLength(2);
  });
});

describe("buildPatternPayload — pattern family mapping", () => {
  it("maps each known ROR-INS to its documented pattern family", () => {
    const cases: Array<{ ruleId: string; family: string }> = [
      { ruleId: "ROR-INS-180", family: "lease_resumption" },
      { ruleId: "ROR-INS-210", family: "eow_blacklist_plot" },
      { ruleId: "ROR-INS-211", family: "eow_blacklist_owner" },
      { ruleId: "ROR-INS-026", family: "impersonation_residence_distance" },
      { ruleId: "ROR-INS-153", family: "industrial_zone_residential_sale" },
      { ruleId: "ROR-INS-040", family: "subdivided_plot_no_bda_approval" },
    ];
    for (const { ruleId, family } of cases) {
      const insight = makeInsight({ ruleId, severity: "redFlag" });
      const out = buildPatternPayload({
        insights: [insight],
        ctx: { reportId: "r1", ruleInput: baseRuleInput },
      });
      expect(out.candidates[0].patternFamily).toBe(family);
    }
  });

  it("falls back to 'unmapped' for unknown ruleIds", () => {
    const insight = makeInsight({ ruleId: "ROR-INS-999", severity: "redFlag" });
    const out = buildPatternPayload({
      insights: [insight],
      ctx: { reportId: "r1", ruleInput: baseRuleInput },
    });
    expect(out.candidates[0].patternFamily).toBe("unmapped");
  });
});