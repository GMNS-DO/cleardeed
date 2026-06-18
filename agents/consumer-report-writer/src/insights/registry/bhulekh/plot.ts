// agents/consumer-report-writer/src/insights/registry/bhulekh/plot.ts
import type { Insight, Rule, RuleInput } from "../../schema";
import { liveDataPresent, stubFor } from "../_shared";

const v = "1.0.0";

function selectedPlotFoundPositive(input: RuleInput): Insight[] | null {
  const r = (input as any).ror;
  if (!r || r.status !== "verified") return null;
  if (r.page2?.selectedPlotFound) {
    return [{
      panel: "plot",
      issueLens: "revenue_record",
      evidenceStrength: "selected_plot_anchor",
      source: "bhulekh:ror:page-2",
      severity: "positive",
      headline: "Selected plot present in RoR",
      body: "The RoR plot table for this khatiyan lists the plot you asked about.",
      actionItem: "No additional action — the selected plot row matches your query.",
      ruleId: "ROR-INS-010",
    }];
  }
  return null;
}

function selectedPlotMissingWatchout(input: RuleInput): Insight[] | null {
  const r = (input as any).ror;
  if (!r || r.status !== "verified") return null;
  if (r.page2 && !r.page2.selectedPlotFound) {
    return [{
      panel: "plot",
      issueLens: "revenue_record",
      evidenceStrength: "selected_plot_anchor",
      source: "bhulekh:ror:page-2",
      severity: "watchout",
      headline: "Selected plot not present in the RoR plot list",
      body: "The RoR lists plots for this khatiyan, but the one you asked about is not present in the RoR plot list.",
      actionItem: "Ask the seller to point to the correct khatiyan, or check whether the plot was partitioned out.",
      ruleId: "ROR-INS-011",
    }];
  }
  return null;
}

function rorPage1MissingKhatiyanWatchout(input: RuleInput): Insight[] | null {
  const r = (input as any).ror;
  if (!r || r.status !== "verified") return null;
  if (r.page1 && !r.page1.khatiyanNumber) {
    return [{
      panel: "plot",
      issueLens: "parser_source_quality",
      evidenceStrength: "missing_source",
      source: "bhulekh:ror:page-1",
      severity: "watchout",
      headline: "RoR page 1 has no khatiyan number",
      body: "We could not read a khatiyan number from the RoR. The plot you queried may be on a different khatiyan.",
      actionItem: "Re-run with the khatiyan number from the seller's records, or open the RoR PDF manually.",
      ruleId: "ROR-INS-012",
    }];
  }
  return null;
}

function rorPage1UnparsedOwnerWatchout(input: RuleInput): Insight[] | null {
  const r = (input as any).ror;
  if (!r || r.status !== "verified") return null;
  if (r.page1 && (!r.page1.owner || r.page1.owner.trim() === "")) {
    return [{
      panel: "plot",
      issueLens: "revenue_record",
      evidenceStrength: "document_anchor",
      source: "bhulekh:ror:page-1",
      severity: "watchout",
      headline: "RoR owner field is empty",
      body: "Page 1 of the RoR does not list a personal name for this khatiyan. It may be a government or unassigned khatiyan.",
      actionItem: "Check whether the khatiyan is a government khatiyan, and ask the seller to provide the latest mutation chain.",
      ruleId: "ROR-INS-013",
    }];
  }
  return null;
}

function rorNoDataOnPage2Watchout(input: RuleInput): Insight[] | null {
  const r = (input as any).ror;
  if (!r || r.status !== "verified") return null;
  if (r.page2 && r.page2.noData === true) {
    return [{
      panel: "plot",
      issueLens: "parser_source_quality",
      evidenceStrength: "missing_source",
      source: "bhulekh:ror:page-2",
      severity: "watchout",
      headline: "RoR page 2 says no plot data",
      body: "Page 2 of the RoR says no plots are recorded for this khatiyan (Odia: ଏହି ଖାତାରେ ପ୍ଲଟ ଉପଲବ୍ଧ ନାହିଁ).",
      actionItem: "Cross-check with Bhunaksha or ask the seller for the plot's parent khatiyan.",
      ruleId: "ROR-INS-014",
    }];
  }
  return null;
}

function mutationCountSpikeWatchout(input: RuleInput): Insight[] | null {
  const r = (input as any).ror;
  if (!r || r.status !== "verified") return null;
  const s = r.section6;
  if (!s) return null;
  if (typeof s.mutationCount === "number" && typeof s.months === "number") {
    if (s.mutationCount > 5 && s.months <= 24) {
      return [{
        panel: "plot",
        issueLens: "title_chain",
        evidenceStrength: "row_count_signal",
        source: "bhulekh:ror:section-6",
        severity: "watchout",
        headline: "Frequent recent mutations",
        body: `Section 6 records ${s.mutationCount} mutations in ${s.months} months. This is above the typical rate for a residential plot.`,
        actionItem: "Ask the seller for the chain of sale deeds, and check whether earlier transactions were to related parties.",
        ruleId: "ROR-INS-015",
      }];
    }
  }
  return null;
}

function rorMissingStub(input: RuleInput): Insight[] | null {
  // Stub fires only when some ror data is present but it's not in 'verified' state.
  // A completely empty input has no RoR data at all and stays quiet here.
  const r = (input as any).ror;
  if (liveDataPresent(input, "ror") && r?.status !== "verified") {
    return [stubFor(
      "ROR-INS-016",
      "plot",
      "revenue_record",
      "parser_uncertain",
      "Bhulekh RoR was not retrieved for this query.",
      "Re-run the report, or pull the RoR PDF from bhulekh.ori.nic.in manually."
    )];
  }
  return null;
}

export const bhulekhPlotRules: Rule[] = [
  { id: "ROR-INS-010", panel: "plot", fn: selectedPlotFoundPositive, version: v },
  { id: "ROR-INS-011", panel: "plot", fn: selectedPlotMissingWatchout, version: v },
  { id: "ROR-INS-012", panel: "plot", fn: rorPage1MissingKhatiyanWatchout, version: v },
  { id: "ROR-INS-013", panel: "plot", fn: rorPage1UnparsedOwnerWatchout, version: v },
  { id: "ROR-INS-014", panel: "plot", fn: rorNoDataOnPage2Watchout, version: v },
  { id: "ROR-INS-015", panel: "plot", fn: mutationCountSpikeWatchout, version: v },
  { id: "ROR-INS-016", panel: "plot", fn: rorMissingStub, version: v },
];
