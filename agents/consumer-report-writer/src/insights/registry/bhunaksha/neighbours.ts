// agents/consumer-report-writer/src/insights/registry/bhunaksha/neighbours.ts
import type { Insight, Rule, RuleInput } from "../../schema";
import { stubFor } from "../_shared";

const v = "1.0.0";

type NeighbourRecord = {
  plotNumber?: string;
  type?: string;
  landClass?: string;
  owner?: string;
  kisam?: string;
};

function getBhunaksha(input: RuleInput): any {
  return (input as any).bhunaksha ?? null;
}

function getNeighbours(input: RuleInput): NeighbourRecord[] | null {
  const b = getBhunaksha(input);
  if (!b || b.status !== "success") return null;
  const n = b.neighbours;
  if (!Array.isArray(n)) return null;
  return n as NeighbourRecord[];
}

// ROR-INS-090 — Adjacent-plot chain walk completed → positive.
// STUB until UP-006. When the chain-walk flag is set, surface a positive
// observation so the consumer sees the signal as soon as the feature lands.
function chainWalkCompletedPositive(input: RuleInput): Insight[] | null {
  const b = getBhunaksha(input);
  if (!b) return null;
  if (b.chainWalkCompleted !== true) return null;
  return [{
    panel: "neighbours",
    issueLens: "title_chain",
    evidenceStrength: "selected_plot_anchor",
    source: "bhunaksha:neighbours:chain",
    severity: "positive",
    headline: "Adjacent-plot chain walk completed",
    body: "The chain walk across adjacent Bhunaksha plots for this khatiyan completed without recorded boundary or ownership gaps.",
    actionItem: "No additional action — the adjacent-plot chain links cleanly to the selected plot.",
    ruleId: "ROR-INS-090",
  }];
}

// ROR-INS-091 — Adjacent-plot mismatch (different kisam/owner) → watchout.
// STUB until UP-006. When the engine sets adjacentPlotMismatch, surface the
// watchout so the buyer can investigate.
function adjacentPlotMismatchWatchout(input: RuleInput): Insight[] | null {
  const b = getBhunaksha(input);
  if (!b) return null;
  if (b.adjacentPlotMismatch !== true) return null;
  return [{
    panel: "neighbours",
    issueLens: "title_chain",
    evidenceStrength: "source_observation",
    source: "bhunaksha:neighbours:mismatch",
    severity: "watchout",
    headline: "Adjacent plot record does not match the selected plot",
    body: "An adjacent Bhunaksha plot record shows a different kisam or owner than the selected plot. This may indicate a partition boundary mismatch or a record update that has not propagated.",
    actionItem: "Ask the seller to show the partition deed (if any) and confirm with the local tehsil that the chauhaddi reflects the current arrangement.",
    ruleId: "ROR-INS-091",
  }];
}

// ROR-INS-092 — Surrounded by consistent private records → positive.
function surroundedByConsistentPrivatePositive(input: RuleInput): Insight[] | null {
  const n = getNeighbours(input);
  if (!n) return null;
  if (n.length < 2) return null; // need at least two neighbours to claim "surrounded"
  const allPrivate = n.every((r) => (r.type ?? "").toLowerCase() === "private");
  if (!allPrivate) return null;
  // Consistency: at least the landClass (or kisam) matches across the set,
  // or landClass is missing on all rows. A single mixed-class outlier flips
  // the signal to inconclusive.
  const classes = n
    .map((r) => (r.landClass ?? r.kisam ?? "").toLowerCase().trim())
    .filter((c) => c !== "");
  let consistent = true;
  if (classes.length > 0) {
    const first = classes[0];
    consistent = classes.every((c) => c === first);
  }
  if (!consistent) return null;
  return [{
    panel: "neighbours",
    issueLens: "title_chain",
    evidenceStrength: "source_observation",
    source: "bhunaksha:neighbours:consistency",
    severity: "positive",
    headline: "Surrounded by consistent private records",
    body: `All ${n.length} adjacent plot records on Bhunaksha are private, and the land class is consistent across the boundary. This is a positive boundary-encroachment signal.`,
    actionItem: "No additional action on adjacency — confirm the boundaries in person before transacting.",
    ruleId: "ROR-INS-092",
  }];
}

// ROR-INS-093 — No adjacent plots identifiable (parser limitation) → watchout.
function noAdjacentPlotsWatchout(input: RuleInput): Insight[] | null {
  const b = getBhunaksha(input);
  if (!b || b.status !== "success") return null;
  const n = b.neighbours;
  if (!Array.isArray(n) || n.length === 0) {
    return [{
      panel: "neighbours",
      issueLens: "parser_source_quality",
      evidenceStrength: "missing_source",
      source: "bhunaksha:neighbours:empty",
      severity: "watchout",
      headline: "No adjacent plots identifiable from Bhunaksha",
      body: "The Bhunaksha record for this plot did not return any adjacent-plot rows. The neighbours chain feature (UP-006) is not yet wired in, or the source did not provide adjacency data for this location.",
      actionItem: "Walk the plot's perimeter in person, list the touching plot numbers, and ask the tehsil to confirm the chauhaddi manually.",
      ruleId: "ROR-INS-093",
    }];
  }
  return null;
}

export const bhunakshaNeighboursRules: Rule[] = [
  { id: "ROR-INS-090", panel: "neighbours", fn: chainWalkCompletedPositive, version: v },
  { id: "ROR-INS-091", panel: "neighbours", fn: adjacentPlotMismatchWatchout, version: v },
  { id: "ROR-INS-092", panel: "neighbours", fn: surroundedByConsistentPrivatePositive, version: v },
  { id: "ROR-INS-093", panel: "neighbours", fn: noAdjacentPlotsWatchout, version: v },
];
