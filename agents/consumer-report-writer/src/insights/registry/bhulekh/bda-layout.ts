// agents/consumer-report-writer/src/insights/registry/bhulekh/bda-layout.ts
//
// T-052 — BDA layout approval detector (Pattern 5 cover).
//
// ROR-INS-152 fires a redFlag when the RoR plot number carries a
// sub-plot indicator (e.g. "415/1", "D/88", "88A/1") — these are
// signatures of a subdivided plot that may lack BDA layout approval.
//
// Per CLAUDE.md Section 8.1 (Pattern 5: Subdivided Plot Without BDA
// Layout Approval), the conservative default is to require the buyer
// to verify BDA layout approval before relying on the plot. The
// severity was upgraded from HIGH WATCH-OUT to redFlag in 2026-06
// because a sub-plot indicator on the RoR is one of the most common
// dispute types in Khordha.
//
// The BDA layout approval lookup itself remains a manual verification
// step (bda.gov.in or the Bhubaneswar town planning office); this
// rule's job is to surface the sub-plot signal from publicly
// available Bhulekh RoR data alone, with the action item pointing to
// the BDA manual verification.

import type { Insight, Rule, RuleInput } from "../../schema";

const v = "1.0.0";

type BhulekhRuleInput = {
  ror?: {
    status?: string;
    plotTable?: {
      targetPlotNo?: string;
      targetRow?: { plotNo?: string };
      rows?: Array<{ plotNo?: string }>;
    };
  };
  geoFetch?: { plotNo?: string | null };
};

/**
 * Detect a sub-plot indicator in a plot number.
 *
 * Patterns that indicate subdivision:
 *   - "415/1", "415/2", "309/4-A" (slash-delimited suffix)
 *   - "D/88", "K/415" (alpha prefix)
 *   - "88A", "88-B" (alphanumeric suffix)
 *
 * Pure-number plots like "415" or "128" do NOT match.
 */
function isSubPlotIndicator(plotNo: string | null | undefined): boolean {
  if (!plotNo) return false;
  const trimmed = plotNo.trim();
  if (trimmed.length === 0) return false;
  // Slash-delimited suffix: "415/1", "309/4-A"
  if (/\/\d/.test(trimmed)) return true;
  // Letter prefix: "D/88", "K/415" (after slash or hyphen)
  if (/^[A-Z]\/\d/i.test(trimmed)) return true;
  // Alphanumeric suffix on a number: "88A", "88-B"
  if (/^\d+[A-Z]([-/]|$)/i.test(trimmed)) return true;
  // Hyphen-suffixed: "415-A", "309-2"
  if (/^\d+-[A-Z0-9]/i.test(trimmed)) return true;
  return false;
}

/**
 * ROR-INS-152 — Subdivided Plot Without BDA Layout Approval pre-flag.
 *
 * Fires redFlag when the target plot number carries a sub-plot
 * indicator. The action item points to BDA layout approval manual
 * verification (bda.gov.in) — the rule's job is to surface the
 * sub-plot signal.
 */
function bdaLayoutSubPlotRedFlag(input: RuleInput): Insight[] | null {
  const i = input as unknown as BhulekhRuleInput;
  const ror = i.ror;
  if (!ror) return null;
  if (ror.status !== "verified") return null;

  // Resolve plot number priority: target row > plot table target > geoFetch.
  const plotNo =
    ror.plotTable?.targetRow?.plotNo ??
    ror.plotTable?.targetPlotNo ??
    i.geoFetch?.plotNo ??
    null;

  if (!plotNo) return null;
  if (!isSubPlotIndicator(plotNo)) return null;

  return [
    {
      panel: "land",
      issueLens: "land_use_permission",
      evidenceStrength: "document_anchor",
      source: `bhulekh:ror:plot-table:subplot:${plotNo.replace(/[^A-Z0-9]/gi, "-")}`,
      severity: "redFlag",
      headline: `Plot ${plotNo} carries a sub-plot indicator — BDA layout approval required`,
      body: `The RoR records the plot as "${plotNo}" — the slash/letter suffix indicates a subdivision of a parent plot. Subdivided plots in BDA jurisdiction require a separate BDA layout approval before sale; without it, the parent plot can be challenged by BDA and the entire plot's title can be at risk.`,
      actionItem:
        "Do not pay until BDA layout approval is on file. Ask the seller's advocate for the BDA layout approval number (format BDA/LP/<year>/<number>), then verify it at bda.gov.in (BPAS-Online / OBPS portal) or at the Bhubaneswar town planning office. If no layout approval exists, the buyer's lawyer must opine on whether the subdivision is grandfathered or requires fresh approval before registration.",
      ruleId: "ROR-INS-152",
      disclosure: {
        whatWeChecked:
          "Parsed the target plot number from the RoR plot table for documented sub-plot indicators (slash-suffix, alpha-prefix, alphanumeric-suffix, or hyphen-suffix). Bhulekh RoR records the plot as it is registered; it does not indicate whether BDA layout approval was granted for the subdivision.",
        howToVerify:
          "Open the RoR PDF from bhulekh.ori.nic.in and read the plot number verbatim. Cross-check the BDA layout approval register at bda.gov.in (BPAS-Online / OBPS) by parent-plot number. If no approval entry exists for the subdivision, the buyer's advocate must opine on the legal risk before any payment.",
        limitsOfThisCheck:
          "Sub-plot indicators are a strong signal but not conclusive proof that BDA approval is missing — some subdivisions are grandfathered or were approved before the BPAS-Online portal was digitised. The action item above (BDA manual verification + advocate opinion) is the buyer-side mitigation regardless of pattern match.",
      },
    },
  ];
}

export const bhulekhBdaLayoutRules: Rule[] = [
  { id: "ROR-INS-152", panel: "land", fn: bdaLayoutSubPlotRedFlag, version: v },
];