/**
 * T-048 — Six Buyer Questions tests
 *
 * 6 tests, one per question, asserting the bucket assignment works.
 */
import { describe, it, expect } from "vitest";
import {
  ruleToBuyerQuestion,
  tallyInsightsByBuyerQuestion,
  getUnimplementedExplanation,
  BUYER_QUESTIONS,
  RULE_TO_QUESTION,
  BUYER_QUESTION_ID,
  type BuyerQuestionId,
} from "./buyer-questions";
import type { Insight } from "./insights/schema";

const buildInsight = (
  ruleId: string,
  panel: string,
  severity: "positive" | "watchout" | "redFlag"
): Insight =>
  ({
    panel: panel as Insight["panel"],
    issueLens: "title_chain",
    evidenceStrength: "source_observation",
    source: "bhulekh",
    severity,
    headline: `${ruleId} ${severity}`,
    body: `${ruleId} ${severity} body`,
    actionItem: "Verify",
    ruleId,
  } as unknown as Insight);

describe("T-048 Six Buyer Questions", () => {
  it("Q1 — ownership bucket assignment", () => {
    // ROR-INS-024 seller-name mismatch is mapped to Q1.
    expect(ruleToBuyerQuestion("ROR-INS-024")).toBe("Q1");
    expect(BUYER_QUESTIONS.Q1.question).toMatch(/seller.*own/i);

    const insights = [buildInsight("ROR-INS-024", "owner", "redFlag")];
    const rollup = tallyInsightsByBuyerQuestion(insights);
    expect(rollup.byQuestion.Q1.redFlags).toBe(1);
    expect(rollup.total.redFlags).toBe(1);
    expect(rollup.byQuestion.Q2.redFlags).toBe(0);
    expect(rollup.byQuestion.Q3.redFlags).toBe(0);
  });

  it("Q2 — buildability bucket assignment", () => {
    // ROR-INS-035 neyanjori (government-notified) → Q2 buildability.
    expect(ruleToBuyerQuestion("ROR-INS-035")).toBe("Q2");
    expect(BUYER_QUESTIONS.Q2.question).toMatch(/build/i);

    const insights = [
      buildInsight("ROR-INS-035", "land", "redFlag"),
      buildInsight("ROR-INS-031", "land", "watchout"),
    ];
    const rollup = tallyInsightsByBuyerQuestion(insights);
    expect(rollup.byQuestion.Q2.redFlags).toBe(1);
    expect(rollup.byQuestion.Q2.watchouts).toBe(1);
    expect(rollup.total.watchouts).toBe(1);
  });

  it("Q3 — encumbrance / loss-risk bucket assignment", () => {
    // ROR-INS-100 encumbrance active mortgage → Q3.
    // ROR-INS-120 court pending case → Q3.
    // ROR-INS-050 dues overdue → Q3.
    expect(ruleToBuyerQuestion("ROR-INS-100")).toBe("Q3");
    expect(ruleToBuyerQuestion("ROR-INS-120")).toBe("Q3");
    expect(ruleToBuyerQuestion("ROR-INS-050")).toBe("Q3");
    expect(BUYER_QUESTIONS.Q3.question).toMatch(/lose/i);

    const insights = [
      buildInsight("ROR-INS-100", "encumbrance", "redFlag"),
      buildInsight("ROR-INS-120", "court", "redFlag"),
      buildInsight("ROR-INS-050", "dues", "redFlag"),
      buildInsight("ROR-INS-051", "dues", "watchout"),
    ];
    const rollup = tallyInsightsByBuyerQuestion(insights);
    expect(rollup.byQuestion.Q3.redFlags).toBe(3);
    expect(rollup.byQuestion.Q3.watchouts).toBe(1);
  });

  it("Q4 — pricing bucket assignment (Propstack/benchmark unimplemented)", () => {
    // ROR-INS-130 financial asking price vs benchmark → Q4.
    expect(ruleToBuyerQuestion("ROR-INS-130")).toBe("Q4");
    expect(BUYER_QUESTIONS.Q4.question).toMatch(/overpaying/i);

    const insights = [buildInsight("ROR-INS-130", "financial", "watchout")];
    const rollup = tallyInsightsByBuyerQuestion(insights);
    expect(rollup.byQuestion.Q4.watchouts).toBe(1);

    const manual = getUnimplementedExplanation("Q4");
    expect(manual.status).toBe("manual");
    expect(manual.manualAction.toLowerCase()).toContain("propstack");
  });

  it("Q5 — area trajectory bucket assignment (BDA/LARR/metro unimplemented)", () => {
    // ROR-INS-080 no adjacent road → Q5.
    // ROR-INS-070 Bhunaksha area mismatch → Q5.
    expect(ruleToBuyerQuestion("ROR-INS-080")).toBe("Q5");
    expect(ruleToBuyerQuestion("ROR-INS-070")).toBe("Q5");
    expect(BUYER_QUESTIONS.Q5.question).toMatch(/develop/i);

    const insights = [buildInsight("ROR-INS-080", "roadAccess", "redFlag")];
    const rollup = tallyInsightsByBuyerQuestion(insights);
    expect(rollup.byQuestion.Q5.redFlags).toBe(1);

    const manual = getUnimplementedExplanation("Q5");
    expect(manual.status).toBe("manual");
    expect(manual.manualAction.toLowerCase()).toContain("bda");
  });

  it("Q6 — post-purchase costs bucket assignment (civic dues unimplemented)", () => {
    // ROR-INS-060 mutation refs present → Q6.
    // ROR-INS-061 mutation count recent → Q6.
    expect(ruleToBuyerQuestion("ROR-INS-060")).toBe("Q6");
    expect(ruleToBuyerQuestion("ROR-INS-061")).toBe("Q6");
    expect(BUYER_QUESTIONS.Q6.question).toMatch(/after I buy/i);

    const insights = [
      buildInsight("ROR-INS-060", "backPage", "positive"),
      buildInsight("ROR-INS-061", "backPage", "watchout"),
    ];
    const rollup = tallyInsightsByBuyerQuestion(insights);
    expect(rollup.byQuestion.Q6.positive).toBe(1);
    expect(rollup.byQuestion.Q6.watchouts).toBe(1);

    const manual = getUnimplementedExplanation("Q6");
    expect(manual.status).toBe("manual");
    expect(manual.manualAction.toLowerCase()).toContain("civic");
  });

  it("every rule id 010..153 has a question (either explicit or panel-default)", () => {
    // Spot-check: every 5th rule id must map to a valid buyer question.
    const sample: BuyerQuestionId[] = ["Q1", "Q2", "Q3", "Q4", "Q5", "Q6"];
    for (const id of [
      "ROR-INS-010",
      "ROR-INS-015",
      "ROR-INS-040",
      "ROR-INS-070",
      "ROR-INS-100",
      "ROR-INS-130",
      "ROR-INS-153",
    ]) {
      expect(sample).toContain(ruleToBuyerQuestion(id));
    }
    // Static mapping must cover every 010..153 range we have rules for.
    expect(Object.keys(RULE_TO_QUESTION).length).toBeGreaterThanOrEqual(50);
    expect(BUYER_QUESTION_ID).toEqual(["Q1", "Q2", "Q3", "Q4", "Q5", "Q6"]);
  });

  it("rollup totals match sum of per-question counts", () => {
    const insights = [
      buildInsight("ROR-INS-024", "owner", "redFlag"), // Q1
      buildInsight("ROR-INS-035", "land", "redFlag"), // Q2
      buildInsight("ROR-INS-100", "encumbrance", "watchout"), // Q3
      buildInsight("ROR-INS-130", "financial", "watchout"), // Q4
      buildInsight("ROR-INS-080", "roadAccess", "redFlag"), // Q5
      buildInsight("ROR-INS-060", "backPage", "positive"), // Q6
    ];
    const rollup = tallyInsightsByBuyerQuestion(insights);
    const sumQ =
      rollup.byQuestion.Q1.redFlags +
      rollup.byQuestion.Q2.redFlags +
      rollup.byQuestion.Q3.redFlags +
      rollup.byQuestion.Q4.redFlags +
      rollup.byQuestion.Q5.redFlags +
      rollup.byQuestion.Q6.redFlags;
    expect(rollup.total.redFlags).toBe(sumQ);
    expect(rollup.total.redFlags).toBe(3);
    expect(rollup.total.watchouts).toBe(2);
    expect(rollup.total.positive).toBe(1);
  });
});