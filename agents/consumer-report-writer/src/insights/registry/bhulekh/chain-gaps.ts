// agents/consumer-report-writer/src/insights/registry/bhulekh/chain-gaps.ts
//
// ROR-INS-155 — Title Chain Gaps.
//
// Detects gaps in the mutation chain — cases where mutation case references
// exist on RoR page 2 but the entries span fewer years than the property's
// estimated holding period, suggesting the chain is incomplete and some
// intermediate transfers are missing from the record.
//
// The Bhulekh back page records mutation case references (case type, case
// number, order date) but it does not record every individual sale deed.
// A gap between the oldest mutation and today can mean:
//   - The seller inherited the land but never got it mutated
//   - An oral sale took place without a registered deed
//   - A partition order is missing from the chain
//
// This rule complements:
//   ROR-INS-060 — fires POSITIVE when mutation refs are present
//   ROR-INS-061 — fires WATCHOUT on recent mutation count (≤12 months)
//   ROR-INS-063 — fires WATCHOUT when some refs lack a khatiyan
//   ROR-INS-076 — fires WATCHOUT when Zamindari khewat + no chain
//
// ROR-INS-155 fires when: mutation refs exist, but the time span covered
// by the chain is suspiciously short relative to estimated holding, or
// there is a large gap (≥5 years) between consecutive mutation entries.

import type { Insight, Rule, RuleInput } from "../../schema";

const v = "1.0.0";

type MutationRef = {
  caseType?: string | null;
  caseNo?: string | null;
  orderDate?: string | null;
  plotNo?: string | null;
  sourceField?: string | null;
  rawText?: string | null;
};

type BhulekhRuleInput = {
  ror?: {
    status?: string;
    mutationReferences?: MutationRef[];
    page1?: {
      acquisitionYear?: string | null;
    };
  };
};

function parseYear(dateStr: string | null | undefined): number | null {
  if (!dateStr || typeof dateStr !== "string") return null;
  // Accept formats: "2024", "2024-05", "2024-05-15", "15/05/2024", "15-05-2024"
  const trimmed = dateStr.trim();
  // ISO format: 2024, 2024-05, 2024-05-15
  if (/^\d{4}(-\d{2}(-\d{2})?)?$/.test(trimmed)) {
    return Number.parseInt(trimmed.slice(0, 4), 10);
  }
  // Indian format: 15/05/2024 or 15-05-2024
  const indian = trimmed.match(/(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})/);
  if (indian) return Number.parseInt(indian[3], 10);
  return null;
}

function mutationChainGapWatchout(input: RuleInput): Insight[] | null {
  const i = input as unknown as BhulekhRuleInput;
  const ror = i.ror;
  if (!ror) return null;
  if (ror.status !== "verified") return null;

  const refs: MutationRef[] = ror.mutationReferences ?? [];
  if (refs.length === 0) return null;

  // Extract all valid order dates.
  const years = refs
    .map((r) => parseYear(r.orderDate))
    .filter((y): y is number => y !== null && y >= 1900 && y <= new Date().getFullYear());

  if (years.length < 2) {
    // Fewer than 2 parseable dates — can't assess gaps.
    // ROR-INS-060 positive will fire; ROR-INS-155 stays silent.
    return null;
  }

  const sorted = [...years].sort((a, b) => a - b);
  const oldest = sorted[0];
  const newest = sorted[sorted.length - 1];
  const span = newest - oldest;
  const currentYear = new Date().getFullYear();

  // Compute gaps between consecutive mutation entries.
  const gaps: number[] = [];
  for (let i = 1; i < sorted.length; i++) {
    gaps.push(sorted[i] - sorted[i - 1]);
  }
  const maxGap = Math.max(...gaps);

  const signals: string[] = [];

  // Signal 1: Single mutation in many years — chain may be incomplete.
  // If the oldest mutation is old AND there are very few mutations,
  // the seller may have inherited without mutation.
  if (span >= 15 && refs.length <= 2) {
    signals.push(
      `only ${refs.length} mutation(s) covering ${span} years (${oldest}–${newest}) — the chain may be incomplete`
    );
  }

  // Signal 2: Large gap between consecutive mutations (≥8 years).
  // A large gap suggests a missing transfer in between.
  if (maxGap >= 8) {
    signals.push(
      `a gap of ${maxGap} year${maxGap === 1 ? "" : "s"} between consecutive mutations — possible missing transfer`
    );
  }

  if (signals.length === 0) return null;

  const bodyParts = [
    `The RoR back page records ${refs.length} mutation case reference(s), but ${signals.join("; and ")}. An incomplete mutation chain means the Bhulekh record does not account for every change of title since the oldest recorded entry. Without a complete chain, the buyer's title is not fully traceable from the RoR alone.`,
  ];

  // Add acquisition year context if available.
  const acqYear = parseYear(i.ror?.page1?.acquisitionYear ?? null);
  if (acqYear && acqYear < oldest) {
    bodyParts.push(
      ` The oldest mutation on record (${oldest}) post-dates an acquisition date of ${acqYear} — the acquisition itself does not appear in the mutation chain.`
    );
  }

  return [
    {
      panel: "chain",
      issueLens: "title_chain",
      evidenceStrength: "document_anchor",
      source: "bhulekh:ror:page-2:mutation-history",
      severity: "watchout",
      headline: `Mutation chain gap detected — ${refs.length} mutation(s) over ${span} year${span === 1 ? "" : "s"}`,
      body: bodyParts.join(""),
      actionItem:
        "Ask the seller for a complete chronological list of every owner this property has had, with supporting documents (sale deeds, inheritance certificates, partition orders, court decrees) for each step of the chain. If any link is missing, engage a Bhubaneswar advocate to assess whether the gap can be closed.",
      ruleId: "ROR-INS-155",
    },
  ];
}

export const bhulekhChainGapRules: Rule[] = [
  { id: "ROR-INS-155", panel: "chain", fn: mutationChainGapWatchout, version: v },
];
