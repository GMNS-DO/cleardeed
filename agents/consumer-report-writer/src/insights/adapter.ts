// agents/consumer-report-writer/src/insights/adapter.ts
//
// Task 24: Adapter that converts the new `Insight[]` shape (from
// runInsights() / the rule registry) into the legacy `RoRInsight[]` and
// `RiskInsight[]` shapes that the existing report-helper functions still
// consume. This lets the report writer move to the new engine without
// rewriting the panel renderers in this PR.
//
// The new engine emits a flat list of `Insight` objects with `panel` and
// `severity` fields. The legacy `buildRoRInsightGroups` emitted
// `RoRInsight[]` grouped by panel (plot/owner/land/plotTable/dues/backPage),
// and `buildRiskInsights` emitted `RiskInsight[]` grouped by RiskDimension
// (transferability/title/financial/positive/redFlag).
//
// The adapter is intentionally small and mechanical — it is *not* a
// re-implementation of the legacy logic. It exists so Task 24 is a
// structural change, not a rewrite.

import type { Insight, InsightPanel, Severity } from "./schema";
import type { RiskInsight, RiskDimension, RiskSeverity } from "../types";

// ---------------------------------------------------------------------------
// Legacy types — preserved here for the report renderers that still consume
// them (buildInsightHighlights, buildRoRCompletenessPanel,
// buildRoRBackPagePanel). New code should consume `Insight` directly.
// ---------------------------------------------------------------------------

export type RoRInsightTone = "positive" | "watchout";

export type RoRInsightPanelId =
  | "plot"
  | "owner"
  | "land"
  | "plotTable"
  | "dues"
  | "backPage";

export interface RoRInsight {
  tone: RoRInsightTone;
  label: string;
  body: string;
  source: string;
  priority: number;
  panelId: RoRInsightPanelId;
}

// ---------------------------------------------------------------------------
// New Insight → legacy RoRInsight
// ---------------------------------------------------------------------------

const ROR_PANELS: ReadonlySet<string> = new Set<InsightPanel>([
  "plot",
  "owner",
  "land",
  "plotTable",
  "dues",
  "backPage",
]);

/** Map the new severity enum onto the legacy `tone` field. */
function toneFor(severity: Severity): RoRInsightTone {
  return severity === "positive" ? "positive" : "watchout";
}

/** Approximate priority from severity. */
function priorityFor(severity: Severity, ruleId: string): number {
  if (severity === "redFlag") return 1;
  if (severity === "positive") return 5;
  // Watchouts get a stable priority based on ruleId so the ordering is
  // deterministic across runs.
  let h = 0;
  for (let i = 0; i < ruleId.length; i++) h = (h * 31 + ruleId.charCodeAt(i)) | 0;
  return 3 + (Math.abs(h) % 4);
}

/** Convert a single new Insight into a legacy RoRInsight. */
export function insightToRoRInsight(ins: Insight): RoRInsight {
  return {
    tone: toneFor(ins.severity),
    label: ins.headline,
    body: ins.body,
    source: ins.source,
    priority: priorityFor(ins.severity, ins.ruleId),
    panelId: ins.panel as RoRInsightPanelId,
  };
}

// ---------------------------------------------------------------------------
// New Insight → legacy RiskInsight
// ---------------------------------------------------------------------------

/** Map panel → RiskDimension. The mapping is intentionally lossy: panels
 *  that don't correspond to a clear dimension (e.g. `completeness`) get
 *  bucketed into `transferability` since they describe the *ability to
 *  transact*. */
function dimensionFor(panel: InsightPanel, severity: Severity): RiskDimension {
  if (severity === "positive") return "positive";
  if (severity === "redFlag") return "redFlag";
  switch (panel) {
    case "encumbrance":
    case "deeds":
      return "transferability";
    case "chain":
    case "ownershipChain":
    case "court":
      return "title";
    case "financial":
      return "financial";
    case "neighbours":
    case "roadAccess":
    case "khaAdjacent":
      return "transferability";
    case "completeness":
      return "transferability";
    default:
      return "transferability";
  }
}

/** Convert a single new Insight into a legacy RiskInsight. */
export function insightToRiskInsight(ins: Insight): RiskInsight {
  return {
    dimension: dimensionFor(ins.panel, ins.severity),
    severity: ins.severity as RiskSeverity,
    label: ins.headline,
    body: ins.body,
    source: ins.source,
    priority: priorityFor(ins.severity, ins.ruleId),
    panelId: ins.panel,
    actionItem: ins.actionItem,
  };
}

// ---------------------------------------------------------------------------
// Grouped views
// ---------------------------------------------------------------------------

/** Partition a list of new insights into the legacy RoRInsightPanelId keys. */
export function rorInsightGroups(insights: Insight[]): Record<RoRInsightPanelId, RoRInsight[]> {
  const groups: Record<RoRInsightPanelId, RoRInsight[]> = {
    plot: [],
    owner: [],
    land: [],
    plotTable: [],
    dues: [],
    backPage: [],
  };
  for (const ins of insights) {
    if (ROR_PANELS.has(ins.panel)) {
      groups[ins.panel as RoRInsightPanelId].push(insightToRoRInsight(ins));
    }
  }
  return groups;
}

/** Partition a list of new insights into the legacy RiskDimension keys. */
export function riskInsightGroups(insights: Insight[]): Record<RiskDimension, RiskInsight[]> {
  const groups: Record<RiskDimension, RiskInsight[]> = {
    transferability: [],
    title: [],
    financial: [],
    positive: [],
    redFlag: [],
  };
  for (const ins of insights) {
    if (ROR_PANELS.has(ins.panel)) continue; // RoR-only insights don't go here
    const dim = dimensionFor(ins.panel, ins.severity);
    groups[dim].push(insightToRiskInsight(ins));
  }
  return groups;
}

/** Reproduce the `selectTopInsights` ordering used by the legacy engine. */
export function selectTopRisk(insights: RiskInsight[], max = 4): RiskInsight[] {
  const SEVERITY_ORDER: Record<RiskSeverity, number> = {
    redFlag: 0,
    watchout: 1,
    positive: 2,
  };
  return [...insights]
    .sort((a, b) => {
      const sevDiff = SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity];
      if (sevDiff !== 0) return sevDiff;
      return a.priority - b.priority;
    })
    .slice(0, max);
}

/** Top-N RoR insights (RoR has no severity ordering, only priority). */
export function selectTopRoR(insights: RoRInsight[], max = 4): RoRInsight[] {
  return [...insights]
    .sort((a, b) => a.priority - b.priority)
    .slice(0, max);
}
