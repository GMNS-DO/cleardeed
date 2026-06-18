// agents/consumer-report-writer/src/insights/registry/registry/completeness.ts
import type { Insight, Rule, RuleInput } from "../../schema";

const v = "1.0.0";

type SourceStatus = { source: string; status: string };
type CompletenessInput = {
  sourceStatuses?: SourceStatus[];
  eowBlacklistAvailable?: boolean;
  ror?: {
    status?: string;
    page1?: { khatiyanNumber?: string; owner?: string };
  };
};

function getStatuses(input: RuleInput): SourceStatus[] | null {
  const s = (input as CompletenessInput).sourceStatuses;
  if (!s || !Array.isArray(s) || s.length === 0) return null;
  return s;
}

function completenessNotImplementedRedFlag(input: RuleInput): Insight[] | null {
  const statuses = getStatuses(input);
  if (!statuses) return null;
  const notImpl = statuses.filter((s) => s.status === "not_implemented");
  if (notImpl.length === 0) return null;
  const names = notImpl.map((s) => s.source).join(", ");
  return [
    {
      panel: "completeness",
      issueLens: "parser_source_quality",
      evidenceStrength: "missing_source",
      source: "completeness:source-statuses",
      severity: "redFlag",
      headline: "One or more sources are not yet implemented",
      body: `These sources reported status "not_implemented": ${names}. Their coverage is missing from this report and the corresponding findings cannot be made.`,
      actionItem: "Do not rely on the missing sections — ask the buyer's lawyer to cover them manually before signing.",
      ruleId: "ROR-INS-140",
    },
  ];
}

function completenessParserUncertainWatchout(input: RuleInput): Insight[] | null {
  const statuses = getStatuses(input);
  if (!statuses) return null;
  const drifted = statuses.filter((s) => s.status === "parser_uncertain");
  if (drifted.length === 0) return null;
  const names = drifted.map((s) => s.source).join(", ");
  return [
    {
      panel: "completeness",
      issueLens: "parser_source_quality",
      evidenceStrength: "parser_uncertain",
      source: "completeness:source-statuses",
      severity: "watchout",
      headline: "Source parser returned uncertain / template-drift results",
      body: `These sources reported "parser_uncertain" (HTML structure has changed since the parser was last trained): ${names}. Their fields may be incomplete.`,
      actionItem: "Cross-check the listed sources manually on the official portal until the parser is re-trained.",
      ruleId: "ROR-INS-141",
    },
  ];
}

function completenessKeyFieldsMissingRedFlag(input: RuleInput): Insight[] | null {
  const statuses = getStatuses(input);
  if (!statuses) return null;
  // Only fire when at least one source reported a real status (so we know the pipeline ran).
  const hasResolved = statuses.some(
    (s) => s.status === "verified" || s.status === "partial" || s.status === "manual_required"
  );
  if (!hasResolved) return null;
  const ror = (input as CompletenessInput).ror;
  const khatiyanMissing = !ror?.page1?.khatiyanNumber || ror.page1.khatiyanNumber.trim() === "";
  const ownerMissing = !ror?.page1?.owner || ror.page1.owner.trim() === "";
  if (!khatiyanMissing && !ownerMissing) return null;
  const missing: string[] = [];
  if (khatiyanMissing) missing.push("khatiyan number");
  if (ownerMissing) missing.push("owner name");
  return [
    {
      panel: "completeness",
      issueLens: "revenue_record",
      evidenceStrength: "missing_source",
      source: "completeness:ror-key-fields",
      severity: "redFlag",
      headline: "Key RoR fields are missing from the parsed output",
      body: `The RoR was retrieved, but the parsed result is missing: ${missing.join(" and ")}. The plot identity cannot be confirmed from the data we have.`,
      actionItem: "Open the RoR PDF manually and re-run the report. If the RoR PDF is itself blank, the plot is likely a government or unassigned khatiyan.",
      ruleId: "ROR-INS-142",
    },
  ];
}

function completenessEowBlacklistWatchout(input: RuleInput): Insight[] | null {
  const statuses = getStatuses(input);
  if (!statuses) return null;
  // Only fire if the pipeline has actually started producing statuses. We don't
  // want to spam completeness warnings on an empty pre-pipeline input.
  if (statuses.length === 0) return null;
  const available = (input as CompletenessInput).eowBlacklistAvailable;
  if (available === true) return null;
  return [
    {
      panel: "completeness",
      issueLens: "parser_source_quality",
      evidenceStrength: "missing_source",
      source: "completeness:eow-blacklist",
      severity: "watchout",
      headline: "EOW Khordha blacklist cross-check was not run (Pattern 2 cover)",
      body: "We could not cross-check the seller name and plot against the Khordha EOW blacklist for this query. Surya Nirman-style multi-investor fraud cannot be ruled out from this report alone.",
      actionItem: "Ask the buyer's lawyer to verify the plot and seller against the EOW Odisha press-release archive at eowodisha.gov.in before signing.",
      ruleId: "ROR-INS-143",
    },
  ];
}

export const completenessRules: Rule[] = [
  { id: "ROR-INS-140", panel: "completeness", fn: completenessNotImplementedRedFlag, version: v },
  { id: "ROR-INS-141", panel: "completeness", fn: completenessParserUncertainWatchout, version: v },
  { id: "ROR-INS-142", panel: "completeness", fn: completenessKeyFieldsMissingRedFlag, version: v },
  { id: "ROR-INS-143", panel: "completeness", fn: completenessEowBlacklistWatchout, version: v },
];
