// agents/consumer-report-writer/src/buyer-questions.ts
//
// T-048: Six Buyer Questions mapping.
//
// Maps every insight rule (ROR-INS-010..153) to one of the six buyer
// questions (Q1 ownership, Q2 buildability, Q3 encumbrance/loss, Q4 pricing,
// Q5 area trajectory, Q6 post-purchase costs). Used by buildSixBuyerQuestions
// to tally watchouts / redFlags per question and to render the top-of-fold
// buyer summary panel.
//
// ADR-023: every insight the report surfaces must roll up to one of these
// six buckets. This is the buyer's spouse executive summary.

import type { Insight, Severity } from "./insights/schema";

export const BUYER_QUESTION_ID = [
  "Q1",
  "Q2",
  "Q3",
  "Q4",
  "Q5",
  "Q6",
] as const;
export type BuyerQuestionId = (typeof BUYER_QUESTION_ID)[number];

export interface BuyerQuestion {
  id: BuyerQuestionId;
  question: string;
  /** Sources that answer this question today. */
  primarySources: string[];
  /** "live" if we have at least one automatic source today; "manual" if all
   *  required sources are concierge / not yet implemented. */
  status: "live" | "partial" | "manual";
  /** Anchor id used by the in-page link from the summary panel to the
   *  detailed section. */
  anchorId: string;
}

export const BUYER_QUESTIONS: Record<BuyerQuestionId, BuyerQuestion> = {
  Q1: {
    id: "Q1",
    question: "Does the seller actually own this?",
    primarySources: ["Bhulekh RoR", "IGR last deed", "Owner name match", "PoA check"],
    status: "live",
    anchorId: "section-owner",
  },
  Q2: {
    id: "Q2",
    question: "Can I build my house here?",
    primarySources: ["Kisam", "BDA zoning", "Setback rules", "Flood zone"],
    status: "partial",
    anchorId: "section-land-classification",
  },
  Q3: {
    id: "Q3",
    question: "Could I lose it after paying?",
    primarySources: [
      "EC mortgage entries",
      "CERSAI",
      "Court attachments",
      "Lis pendens",
      "ST/SC restrictions",
    ],
    status: "partial",
    anchorId: "section-encumbrance",
  },
  Q4: {
    id: "Q4",
    question: "Am I overpaying?",
    primarySources: ["IGR benchmark", "Propstack comps", "Circle rate trajectory"],
    status: "manual",
    anchorId: "section-financial-exposure",
  },
  Q5: {
    id: "Q5",
    question: "Is the area going to develop or decay?",
    primarySources: [
      "BDA Master Plan",
      "LARR notifications",
      "Metro corridor",
      "Infrastructure pipeline",
    ],
    status: "manual",
    anchorId: "section-road-access",
  },
  Q6: {
    id: "Q6",
    question: "What happens after I buy?",
    primarySources: [
      "Mutation cost",
      "Property tax",
      "Maintenance",
      "Civic dues",
      "Holding cost",
    ],
    status: "manual",
    anchorId: "section-financial-exposure",
  },
};

/**
 * Static rule -> question mapping.
 *
 * Conventions:
 *  - Q1 (ownership) — owner/deed/encumbrance-style mutations on RoR;
 *    seller mismatches; PoA gaps; government khatiyan flags.
 *  - Q2 (buildability) — kisam classification; conversion / prohibition /
 *    buildability; plot-row kisam/area anomalies; sub-plot indicators.
 *  - Q3 (loss risk) — encumbrance entries (mortgage, charge, lien, EC);
 *    court cases; mutation refs (Dakhal/Kharaj); dues / revenue demand;
 *    completeness and parser uncertainty that affect loss-risk conclusions.
 *  - Q4 (pricing) — asking price vs benchmark; multiple encumbrances;
 *    deeds below benchmark.
 *  - Q5 (area trajectory) — Bhunaksha plot/area/road-access; neighbours;
 *    chain walk; zoning.
 *  - Q6 (post-purchase) — mutation refs / recent transactions; deeds and
 *    title-chain gaps that imply mutation / partition work.
 *
 * Rules not listed below default to the panel-question heuristic in
 * ruleToBuyerQuestion(): the insight panel determines the question.
 */
export const RULE_TO_QUESTION: Record<string, BuyerQuestionId> = {
  // Q1 — ownership
  "ROR-INS-020": "Q1", // multiple co-owners
  "ROR-INS-021": "Q1", // owner address mismatch
  "ROR-INS-022": "Q1", // government khatiyan
  "ROR-INS-023": "Q1", // single-token owner match
  "ROR-INS-024": "Q1", // seller name not matched
  "ROR-INS-110": "Q1", // deeds seller matches RoR
  "ROR-INS-111": "Q1", // deeds seller mismatches RoR
  "ROR-INS-113": "Q1", // deeds no sale deed
  "ROR-INS-114": "Q1", // deeds partition untraced

  // Q2 — buildability
  "ROR-INS-030": "Q2", // kisam forest
  "ROR-INS-031": "Q2", // kisam bagayat (conversion)
  "ROR-INS-032": "Q2", // kisam gharabari (positive buildability)
  "ROR-INS-033": "Q2", // lease / sthitiban
  "ROR-INS-034": "Q2", // kisam unknown
  "ROR-INS-035": "Q2", // kisam neyanjori (government notified)
  "ROR-INS-040": "Q2", // sub-plot indicator
  "ROR-INS-041": "Q2", // plot row missing kisam
  "ROR-INS-042": "Q2", // plot row missing area
  "ROR-INS-043": "Q2", // all plots government kisam
  "ROR-INS-044": "Q2", // plot table empty

  // Q3 — encumbrance / loss risk
  "ROR-INS-050": "Q3", // revenue dues overdue
  "ROR-INS-051": "Q3", // dues year unverified
  "ROR-INS-052": "Q3", // dues field missing
  "ROR-INS-062": "Q3", // mutation ref Dakhal/Kharaj
  "ROR-INS-063": "Q3", // mutation ref missing khatiyan
  "ROR-INS-064": "Q3", // encumbrance-style entry
  "ROR-INS-100": "Q3", // encumbrance active mortgage
  "ROR-INS-101": "Q3", // encumbrance non-discharged charge
  "ROR-INS-102": "Q3", // encumbrance satisfaction entry
  "ROR-INS-103": "Q3", // encumbrance CERSAI charge
  "ROR-INS-104": "Q3", // encumbrance narrow window
  "ROR-INS-120": "Q3", // court pending case matches seller
  "ROR-INS-121": "Q3", // court closed case matches seller
  "ROR-INS-122": "Q3", // court zero results
  "ROR-INS-131": "Q3", // financial EC financial attachment
  "ROR-INS-140": "Q3", // completeness not implemented (source not verified)
  "ROR-INS-142": "Q3", // completeness key fields missing
  "ROR-INS-143": "Q3", // completeness EOW blacklist

  // Q4 — pricing
  "ROR-INS-112": "Q4", // deeds below benchmark
  "ROR-INS-130": "Q4", // financial asking price vs benchmark
  "ROR-INS-132": "Q4", // financial multiple encumbrances

  // Q5 — area trajectory (cadastral / road / neighbours / zoning)
  "ROR-INS-070": "Q5", // Bhunaksha area mismatch
  "ROR-INS-071": "Q5", // Bhunaksha no data parser
  "ROR-INS-072": "Q5", // Bhunaksha plot number mismatch
  "ROR-INS-073": "Q5", // Bhunaksha missing source
  "ROR-INS-080": "Q5", // no adjacent road
  "ROR-INS-081": "Q5", // surrounded by Kha (govt land)
  "ROR-INS-082": "Q5", // road on at least one side (positive)
  "ROR-INS-083": "Q5", // chauhaddi missing
  "ROR-INS-090": "Q5", // chain walk completed
  "ROR-INS-091": "Q5", // adjacent plot mismatch
  "ROR-INS-092": "Q5", // surrounded by consistent private
  "ROR-INS-093": "Q5", // no adjacent plots

  // Q6 — post-purchase (mutations and chain gaps)
  "ROR-INS-060": "Q6", // mutation refs present (positive)
  "ROR-INS-061": "Q6", // mutation count recent
  "ROR-INS-150": "Q6", // chain-recursive
  "ROR-INS-151": "Q6",
  "ROR-INS-152": "Q6",
  "ROR-INS-153": "Q6",
};

/**
 * Fallback by insight panel when a rule is not explicitly mapped.
 *
 * This keeps every insight accounted for even as new rules are added.
 */
const PANEL_TO_QUESTION: Record<string, BuyerQuestionId> = {
  plot: "Q2",
  owner: "Q1",
  land: "Q2",
  plotTable: "Q2",
  dues: "Q3",
  backPage: "Q6",
  chain: "Q1",
  encumbrance: "Q3",
  deeds: "Q1",
  court: "Q3",
  financial: "Q4",
  ownershipChain: "Q1",
  neighbours: "Q5",
  roadAccess: "Q5",
  khaAdjacent: "Q5",
  completeness: "Q3",
};

export function ruleToBuyerQuestion(ruleId: string, panel?: string): BuyerQuestionId {
  const mapped = RULE_TO_QUESTION[ruleId];
  if (mapped) return mapped;
  if (panel && PANEL_TO_QUESTION[panel]) return PANEL_TO_QUESTION[panel];
  return "Q3";
}

export interface BuyerQuestionTally {
  question: BuyerQuestion;
  watchouts: number;
  redFlags: number;
  positive: number;
}

export interface BuyerQuestionRollup {
  byQuestion: Record<BuyerQuestionId, BuyerQuestionTally>;
  total: { watchouts: number; redFlags: number; positive: number };
}

export function tallyInsightsByBuyerQuestion(
  insights: Insight[]
): BuyerQuestionRollup {
  const out: Record<BuyerQuestionId, BuyerQuestionTally> = {
    Q1: { question: BUYER_QUESTIONS.Q1, watchouts: 0, redFlags: 0, positive: 0 },
    Q2: { question: BUYER_QUESTIONS.Q2, watchouts: 0, redFlags: 0, positive: 0 },
    Q3: { question: BUYER_QUESTIONS.Q3, watchouts: 0, redFlags: 0, positive: 0 },
    Q4: { question: BUYER_QUESTIONS.Q4, watchouts: 0, redFlags: 0, positive: 0 },
    Q5: { question: BUYER_QUESTIONS.Q5, watchouts: 0, redFlags: 0, positive: 0 },
    Q6: { question: BUYER_QUESTIONS.Q6, watchouts: 0, redFlags: 0, positive: 0 },
  };
  let watchouts = 0;
  let redFlags = 0;
  let positive = 0;

  for (const i of insights) {
    if (!i) continue;
    const qid = ruleToBuyerQuestion((i as any).ruleId ?? "", (i as any).panel);
    const sev = (i as any).severity as Severity | undefined;
    if (sev === "watchout") {
      out[qid].watchouts += 1;
      watchouts += 1;
    } else if (sev === "redFlag") {
      out[qid].redFlags += 1;
      redFlags += 1;
    } else if (sev === "positive") {
      out[qid].positive += 1;
      positive += 1;
    }
  }

  return {
    byQuestion: out,
    total: { watchouts, redFlags, positive },
  };
}

export interface UnimplementedQuestionExplanation {
  id: BuyerQuestionId;
  status: "live" | "partial" | "manual";
  question: string;
  /** Plain-language explanation of what the buyer's lawyer needs to check. */
  manualAction: string;
}

export function getUnimplementedExplanation(
  id: BuyerQuestionId
): UnimplementedQuestionExplanation {
  const q = BUYER_QUESTIONS[id];
  switch (id) {
    case "Q1":
      return {
        id,
        status: q.status,
        question: q.question,
        manualAction:
          "Bhulekh RoR owner block must match seller's ID. Ask for a recent certified Khatiyan copy and the last registered sale deed.",
      };
    case "Q2":
      return {
        id,
        status: q.status,
        question: q.question,
        manualAction:
          "Kisam is verified from Bhulekh but BDA zoning, setback rules, and flood-zone overlays are not yet automated. Ask the broker for the BDA zonal map and confirm the plot is outside flood Zone B/C before transacting.",
      };
    case "Q3":
      return {
        id,
        status: q.status,
        question: q.question,
        manualAction:
          "Court cases and CERSAI checks are not yet fully automated in ClearDeed. Request a 30-year Encumbrance Certificate from the Sub-Registrar and a CERSAI search before registration.",
      };
    case "Q4":
      return {
        id,
        status: q.status,
        question: q.question,
        manualAction:
          "Propstack comps and IGR benchmark trajectory are not yet integrated. Verify asking price against the IGR Odisha benchmark at regis.odisha.gov.in for this mouza and Kisam, and ask the seller for last 3 sale-deed comparables in the same village.",
      };
    case "Q5":
      return {
        id,
        status: q.status,
        question: q.question,
        manualAction:
          "BDA Master Plan, LARR acquisition notifications, and metro-corridor overlays are not yet automated. Check the BDA Master Plan at bda.gov.in for this mouza and confirm there is no LARR S.11 notification. Bhunaksha road access is summarized below.",
      };
    case "Q6":
      return {
        id,
        status: q.status,
        question: q.question,
        manualAction:
          "Civic dues (BMC, TPCODL, PHED) and property-tax history are not yet integrated. Ask the seller for a BMC No-Dues certificate and confirm property-tax receipts for the last 5 years before registration.",
      };
  }
}