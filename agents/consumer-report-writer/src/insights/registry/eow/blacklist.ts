// agents/consumer-report-writer/src/insights/registry/eow/blacklist.ts
//
// T-049 — EOW Khordha blacklist cross-reference insights.
//
// ROR-INS-210 fires a redFlag (Q1 ownership bucket) when the queried plot
// (with optional khata and village disambiguation) matches an attached
// property from the curated Khordha EOW blacklist. Per CLAUDE.md
// Section 8.1 (Fraud Pattern 2 — Surya Nirman Multi-Investor Fraud,
// Bhubaneswar 2017-2023), this is a CRITICAL-level watchout for the
// buyer.
//
// ROR-INS-211 fires a redFlag (Q1 ownership bucket) when the RoR owner
// name (or, if absent, the seller-claimed name) matches an entry on the
// EOW arrest list. Per CLAUDE.md, this is a HIGH WATCH-OUT level signal
// and triggers a manual KYC check.
//
// EOW data flows through the unified insight engine the same way Bhuvan
// flood data does: the orchestrator runs the `@cleardeed/fetcher-eow`
// package (or a thin wrapper), the A10 mapper pulls the result off the
// `sources` array via `sources.find((s) => s.source === "eow")`, and the
// payload lands on the report input as `eowBlacklist`. The rules below
// read from `input.eowBlacklist` and never import the fetcher package —
// keeping insight rules package-agnostic matches the convention used by
// every other insight rule.
//
// Neither rule emits language prohibited by the unified insight engine
// language gate (no "safe to buy", "clear title", "no encumbrance", etc.).
// Copy is bounded: facts, source URLs, and an action item.

import type { Insight, Rule, RuleInput } from "../../schema";

const v = "1.0.0";

// Shape we read from RuleInput. The mapper in agents/consumer-report-writer
// exposes these fields under ror.*, geoFetch.*, and at top level
// (claimedOwnerName / sellerName).
type EowRuleInput = {
  ror?: {
    page1?: {
      khatiyanNumber?: string;
      owner?: string;
      village?: string;
    };
    plotTable?: {
      targetPlotNo?: string;
      targetRow?: { plotNo?: string; khataNo?: string; village?: string };
    };
    tenants?: Array<{ tenantName?: string }>;
  };
  geoFetch?: {
    plotNo?: string | null;
    village?: string | null;
    tahasil?: string | null;
  };
  claimedOwnerName?: string;
  sellerName?: string;
  // Payload from the EOW fetcher, forwarded by the A10 mapper. See
  // packages/fetchers/eow/src/index.ts for the source-side type.
  eowBlacklist?: EowPayload | null;
};

type EowMatchStrength = "full" | "partial";

type EowEntry = {
  matched: boolean;
  caseRefs: string[];
  sourceUrls: string[];
  matchStrength?: EowMatchStrength;
  summary?: string;
};

type EowPayload = {
  status?: string;
  data?: {
    plotMatch?: EowEntry;
    ownerMatch?: EowEntry;
    overallSeverity?: "critical" | "high_watch_out";
    overallSummary?: string;
    blacklistVersion?: string;
    blacklistLastRefreshedAt?: string;
    entryCount?: number;
  } | null;
};

function getInput(input: RuleInput): EowRuleInput {
  return input as unknown as EowRuleInput;
}

/**
 * Resolve the query fields for an EOW cross-reference.
 *
 * Field priority (most specific first):
 *   - plotNo:  target plot row > geoFetch.plotNo > null
 *   - khataNo: target plot row > ror.page1.khatiyanNumber > null
 *   - village: target plot row > ror.page1.village > geoFetch.village > null
 *   - ownerName: claimedOwnerName > sellerName > first RoR tenant > null
 */
function resolveQuery(input: RuleInput): {
  plotNo?: string;
  khataNo?: string;
  village?: string;
  ownerName: string;
} | null {
  const i = getInput(input);
  const targetRow = i.ror?.plotTable?.targetRow;
  const plotNo =
    targetRow?.plotNo ??
    i.ror?.plotTable?.targetPlotNo ??
    i.geoFetch?.plotNo ??
    undefined;
  const khataNo = targetRow?.khataNo ?? i.ror?.page1?.khatiyanNumber ?? undefined;
  const village =
    targetRow?.village ?? i.ror?.page1?.village ?? i.geoFetch?.village ?? undefined;
  const claimed = (i.claimedOwnerName ?? i.sellerName ?? "").trim();
  const roRFirstTenant = i.ror?.tenants?.[0]?.tenantName?.trim() ?? "";
  const ownerName = claimed || roRFirstTenant;
  if (!ownerName) return null;
  return {
    plotNo: plotNo ?? undefined,
    khataNo,
    village,
    ownerName,
  };
}

// ROR-INS-210 — redFlag when plot/khata cross-reference hits the EOW
// attached-property blacklist. Pattern 2 cover (Surya Nirman fraud).
function eowPlotBlacklistRedFlag(input: RuleInput): Insight[] | null {
  const q = resolveQuery(input);
  // The rule only fires when the buyer supplied a plot number. An empty
  // plotNo means we have no target to cross-reference.
  if (!q || !q.plotNo) return null;
  const payload = getInput(input).eowBlacklist;
  const plotMatch = payload?.data?.plotMatch;
  if (!plotMatch?.matched) return null;

  const caseRefs = plotMatch.caseRefs.join(", ") || "EOW case (see source URL)";
  const sourceUrls = plotMatch.sourceUrls.join("; ");
  const summary =
    plotMatch.summary ?? `Plot ${q.plotNo} is on the EOW attached-property list.`;

  return [
    {
      panel: "ownershipChain",
      issueLens: "title_chain",
      evidenceStrength: "document_anchor",
      source: `eow-odisha:blacklist:plot:${q.plotNo}`,
      severity: "redFlag",
      headline: `Plot ${q.plotNo} matches a Khordha EOW attached-property record`,
      body: `${summary} This plot is on the curated Khordha EOW blacklist (case ${caseRefs}; ${sourceUrls}). Surya Nirman-style multi-investor fraud has attached this property — buying it carries the full attachment risk until the case is resolved.`,
      actionItem:
        "Do not pay any advance. Ask the seller's lawyer for a certified copy of the EOW attachment order and any subsequent release/discharge order. If the property is still attached, the sale is not registrable in your favour and the purchase consideration is at risk.",
      ruleId: "ROR-INS-210",
      disclosure: {
        whatWeChecked:
          "Cross-referenced the queried plot number (and optional khata/village) against the curated Khordha EOW blacklist at packages/fetchers/eow/data/khordha_eow_blacklist.json.",
        howToVerify: `Open the linked EOW press-release URL(s) and read the property-attachment table. Confirm the case reference (${caseRefs}) against the EOW case register at eowodisha.gov.in, and ask the seller's advocate for a certified non-attachment certificate from the EOW court.`,
        limitsOfThisCheck:
          "The blacklist is curated from EOW press releases; it may be incomplete for older cases that pre-date online publication. A 'no match' result does not certify absence of EOW involvement — it only means the curated list did not flag the plot.",
      },
    },
  ];
}

// ROR-INS-211 — redFlag when owner-name cross-reference hits the EOW
// arrest list. Pattern 2 cover (Surya Nirman fraud). Severity is
// "redFlag" because the buyer must perform manual KYC regardless of
// match strength; partial (surname-only) matches are downgraded in the
// body copy but still surface the action item.
function eowOwnerArrestRedFlag(input: RuleInput): Insight[] | null {
  const q = resolveQuery(input);
  if (!q) return null;
  const payload = getInput(input).eowBlacklist;
  if (!payload) return null;
  const ownerMatch = payload.data?.ownerMatch;
  if (!ownerMatch?.matched) return null;
  // If ROR-INS-210 already fires, suppress ROR-INS-211 — the plot
  // attachment is the load-bearing finding. Avoid double-firing in the
  // same report for the same case.
  if (payload.data?.plotMatch?.matched) return null;

  const caseRefs =
    ownerMatch.caseRefs.join(", ") || "EOW arrest record (see source URL)";
  const sourceUrls = ownerMatch.sourceUrls.join("; ");
  const strength = ownerMatch.matchStrength ?? "full";
  const summary =
    ownerMatch.summary ?? `Owner name matches an EOW arrest record.`;
  const headline =
    strength === "full"
      ? "Recorded owner name matches a Khordha EOW arrest record"
      : "Recorded owner surname matches a Khordha EOW arrest record — full KYC required";

  return [
    {
      panel: "ownershipChain",
      issueLens: "title_chain",
      evidenceStrength:
        strength === "full" ? "document_anchor" : "row_count_signal",
      source: `eow-odisha:arrest-list:owner:${q.ownerName
        .toLowerCase()
        .replace(/\s+/g, "-")}`,
      severity: "redFlag",
      headline,
      body: `${summary} This is the Khordha EOW arrest list (case ${caseRefs}; ${sourceUrls}).${
        strength === "partial"
          ? " Surname-only matches are flagged because many Khordha surnames are common; the buyer's lawyer must verify the full name and case reference before any payment."
          : ""
      }`,
      actionItem:
        "Do not pay any advance. Demand a video KYC with the recorded owner, cross-check the case reference against the EOW case register at eowodisha.gov.in, and obtain a written no-objection / non-involvement certificate from the seller's advocate before signing.",
      ruleId: "ROR-INS-211",
      disclosure: {
        whatWeChecked:
          "Cross-referenced the recorded owner name (RoR first tenant, falling back to seller-claimed name) against the curated Khordha EOW arrest list at packages/fetchers/eow/data/khordha_eow_blacklist.json.",
        howToVerify: `Open the linked EOW press-release URL(s) and confirm the arrest record for ${q.ownerName}. The seller's advocate should provide a certified non-involvement certificate from the EOW court.`,
        limitsOfThisCheck:
          "Single-token surname matches are common false positives in Odisha (Mohapatra, Sahu, Sahoo, etc.). The action item above (video KYC + advocate certificate) is the buyer-side mitigation regardless of match strength.",
      },
    },
  ];
}

export const eowRules: Rule[] = [
  { id: "ROR-INS-210", panel: "ownershipChain", fn: eowPlotBlacklistRedFlag, version: v },
  { id: "ROR-INS-211", panel: "ownershipChain", fn: eowOwnerArrestRedFlag, version: v },
];
