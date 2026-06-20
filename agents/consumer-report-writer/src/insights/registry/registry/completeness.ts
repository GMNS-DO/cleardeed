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

function completenessPlotDiagramMissingWatchout(input: RuleInput): Insight[] | null {
  // Phase 8 / Task 36 — fire a watchout (never a redFlag) when the pipeline
  // had a target polygon to render but produced no plot diagram. We only
  // emit this on a non-trivial report: the geo source must have succeeded
  // (we have a real plot context) and the diagram must be missing
  // (absent, null, or explicitly not_attempted with no URL).
  //
  // Rationale: the plot diagram is a strong cross-check on the target
  // plot's boundaries and neighbours. If the pipeline ran the WFS compose
  // step and still came back empty, the user should know to ask the
  // lawyer to manually verify the plot footprint on Bhunaksha. We do
  // NOT fire on `failed` (the section itself shows the failed copy).
  const statuses = getStatuses(input);
  if (!statuses) return null;
  const geoUsable = statuses.some((s) => s.source === "bhunaksha" && s.status === "verified");
  if (!geoUsable) return null;
  const pd = (input as { plotDiagram?: { status?: string; url?: string | null } } | undefined)
    ?.plotDiagram;
  // If the diagram is a success/partial result (URL present), there is
  // nothing to warn about. If it failed, the section already shows the
  // failed copy and a second warning would be redundant.
  if (pd && (pd.status === "success" || pd.status === "partial")) return null;
  if (pd && pd.status === "failed") return null;
  // Fire when the diagram is missing entirely (legacy report), or when
  // the pipeline explicitly skipped the step (not_attempted with no url).
  return [
    {
      panel: "completeness",
      issueLens: "parser_source_quality",
      evidenceStrength: "missing_source",
      source: "completeness:plot-diagram-missing",
      severity: "watchout",
      headline: "Plot diagram was not generated for this report",
      body:
        "The Bhunaksha WFS compose step did not produce a plot diagram (the step was skipped, the target polygon was missing, or the diagram feature was added after this report was created). The report still ships, but the plot footprint and neighbour context have not been visually verified.",
      actionItem:
        "Ask the buyer's lawyer to open the Bhunaksha plot-report page directly (bhunaksha.ori.nic.in/plotreportOR.jsp) and confirm the target plot's boundaries and the surrounding plots before signing.",
      ruleId: "ROR-INS-170",
    },
  ];
}

export const completenessRules: Rule[] = [
  { id: "ROR-INS-140", panel: "completeness", fn: completenessNotImplementedRedFlag, version: v },
  { id: "ROR-INS-141", panel: "completeness", fn: completenessParserUncertainWatchout, version: v },
  { id: "ROR-INS-142", panel: "completeness", fn: completenessKeyFieldsMissingRedFlag, version: v },
  { id: "ROR-INS-143", panel: "completeness", fn: completenessEowBlacklistWatchout, version: v },
];

// ROR-INS-170 (Phase 8 / Task 36) lives in its own export so the
// existing `completenessRules.length === 4` invariant stays intact.
// It is included in ALL_RULES via registry/index.ts.
export const plotDiagramRule: Rule = {
  id: "ROR-INS-170",
  panel: "completeness",
  fn: completenessPlotDiagramMissingWatchout,
  version: v,
};
