// agents/consumer-report-writer/src/insights/registry/bhulekh/plot-table.ts
import type { Insight, Rule, RuleInput } from "../../schema";

const v = "1.0.0";

const GOVERNMENT_KISAMS = new Set([
  "forest",
  "jungle",
  "gochar",
  "smasana",
  "sthitiban",
  "raiyati",
  "government",
  "reserved_forest",
  "protected_forest",
]);

function subPlotIndicatorWatchout(input: RuleInput): Insight[] | null {
  const r = (input as any).ror;
  if (!r || r.status !== "verified") return null;
  const plotNo: string | undefined = r.page2?.selectedPlotNumber;
  if (typeof plotNo !== "string" || plotNo.trim() === "") return null;
  if (!/[\/\-]/.test(plotNo)) return null;
  return [{
    panel: "plotTable",
    issueLens: "title_chain",
    evidenceStrength: "selected_plot_anchor",
    source: "bhulekh:ror:page-2",
    severity: "watchout",
    headline: "Plot number looks like a sub-plot indicator",
    body: `The plot number you queried (${plotNo}) carries a sub-division indicator (a '/' or '-' inside the number). Pattern 5 — sub-divided plots without a BDA layout approval — is one of the most common dispute types in Khordha.`,
    actionItem: "Ask the seller for a BDA layout approval / sub-division order that covers this specific sub-plot number.",
    ruleId: "ROR-INS-040",
  }];
}

function plotRowMissingKisamWatchout(input: RuleInput): Insight[] | null {
  const r = (input as any).ror;
  if (!r || r.status !== "verified") return null;
  const plots: any[] = Array.isArray(r.page2?.plots) ? r.page2.plots : [];
  if (plots.length === 0) return null;
  const hasMissing = plots.some(
    (p) => !p || typeof p.kisam !== "string" || p.kisam.trim() === ""
  );
  if (!hasMissing) return null;
  return [{
    panel: "plotTable",
    issueLens: "parser_source_quality",
    evidenceStrength: "parser_uncertain",
    source: "bhulekh:ror:page-2",
    severity: "watchout",
    headline: "At least one plot row has no kisam",
    body: "One or more rows in the RoR plot table are missing a kisam / land class. This is unusual for a digitized record and may indicate an OCR or parsing gap.",
    actionItem: "Open the RoR PDF from bhulekh.ori.nic.in and read the missing kisam by hand for every row.",
    ruleId: "ROR-INS-041",
  }];
}

function plotRowMissingAreaWatchout(input: RuleInput): Insight[] | null {
  const r = (input as any).ror;
  if (!r || r.status !== "verified") return null;
  const plots: any[] = Array.isArray(r.page2?.plots) ? r.page2.plots : [];
  if (plots.length === 0) return null;
  const hasMissing = plots.some(
    (p) => !p || p.area === undefined || p.area === null || (typeof p.area === "string" && p.area.trim() === "")
  );
  if (!hasMissing) return null;
  return [{
    panel: "plotTable",
    issueLens: "revenue_record",
    evidenceStrength: "parser_uncertain",
    source: "bhulekh:ror:page-2",
    severity: "watchout",
    headline: "At least one plot row has no area",
    body: "One or more rows in the RoR plot table are missing an area. A real RoR digitisation always carries an area, so this is most often a parser gap.",
    actionItem: "Open the RoR PDF from bhulekh.ori.nic.in and read the area by hand for every missing row.",
    ruleId: "ROR-INS-042",
  }];
}

function allPlotsGovernmentKisamWatchout(input: RuleInput): Insight[] | null {
  const r = (input as any).ror;
  if (!r || r.status !== "verified") return null;
  const plots: any[] = Array.isArray(r.page2?.plots) ? r.page2.plots : [];
  if (plots.length === 0) return null;
  const allGov = plots.every(
    (p) => p && typeof p.kisam === "string" && GOVERNMENT_KISAMS.has(p.kisam.toLowerCase())
  );
  if (!allGov) return null;
  return [{
    panel: "plotTable",
    issueLens: "land_use_permission",
    evidenceStrength: "document_anchor",
    source: "bhulekh:ror:page-2",
    severity: "watchout",
    headline: "Every plot row in this khatiyan is a government kisam",
    body: "All rows in the RoR plot table are recorded as government / reserved / forest / gochar / smasana kisam. A private buyer cannot take ownership of government land through a normal sale.",
    actionItem: "Stop the transaction. Ask the seller for the recorded mutation / assignment order that transferred this khatiyan to a private party.",
    ruleId: "ROR-INS-043",
  }];
}

function plotTableEmptyWatchout(input: RuleInput): Insight[] | null {
  const r = (input as any).ror;
  if (!r || r.status !== "verified") return null;
  const plots: any[] = Array.isArray(r.page2?.plots) ? r.page2.plots : [];
  if (plots.length !== 0) return null;
  return [{
    panel: "plotTable",
    issueLens: "parser_source_quality",
    evidenceStrength: "missing_source",
    source: "bhulekh:ror:page-2",
    severity: "watchout",
    headline: "RoR plot table is empty",
    body: "The RoR page 2 returned no plot rows for this khatiyan. The khatiyan may be empty, or the page failed to render the plot grid.",
    actionItem: "Open the RoR PDF from bhulekh.ori.nic.in directly, or ask the seller for the latest mutation that should list a plot on this khatiyan.",
    ruleId: "ROR-INS-044",
  }];
}

export const bhulekhPlotTableRules: Rule[] = [
  { id: "ROR-INS-040", panel: "plotTable", fn: subPlotIndicatorWatchout, version: v },
  { id: "ROR-INS-041", panel: "plotTable", fn: plotRowMissingKisamWatchout, version: v },
  { id: "ROR-INS-042", panel: "plotTable", fn: plotRowMissingAreaWatchout, version: v },
  { id: "ROR-INS-043", panel: "plotTable", fn: allPlotsGovernmentKisamWatchout, version: v },
  { id: "ROR-INS-044", panel: "plotTable", fn: plotTableEmptyWatchout, version: v },
];