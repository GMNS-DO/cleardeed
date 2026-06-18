// agents/consumer-report-writer/src/insights/registry/bhunaksha/plot.ts
import type { Insight, Rule, RuleInput } from "../../schema";
import { liveDataPresent, stubFor } from "../_shared";

const v = "1.0.0";

// 1 acre ≈ 0.00405 sq_km. Bhunaksha data is in sq_km; RoR area may be in acres
// or decimal acres. We compare in normalized sq_km when both are present.
const ACRE_TO_SQ_KM = 0.0040468564224;

function normalizeAreaToSqKm(value: number, unit?: string): number | null {
  if (typeof value !== "number" || !isFinite(value)) return null;
  const u = (unit ?? "").toLowerCase();
  if (u === "sq_km" || u === "km2" || u === "km^2") return value;
  if (u === "ac" || u === "acre" || u === "acres" || u === "") {
    // Default RoR area is interpreted as acres when unit is missing.
    return value * ACRE_TO_SQ_KM;
  }
  return null;
}

function areaDriftPct(a: number, b: number): number {
  const denom = Math.max(Math.abs(a), Math.abs(b), 1e-9);
  return (Math.abs(a - b) / denom) * 100;
}

function bhunakshaAreaMismatchRedFlag(input: RuleInput): Insight[] | null {
  const b = (input as any).bhunaksha;
  const r = (input as any).ror;
  if (!b || b.status !== "success" || !b.data || typeof b.data.area !== "number") return null;
  if (!r || r.status !== "verified") return null;
  if (!r.page2 || typeof r.page2.area !== "number") return null;

  const bhSqKm = normalizeAreaToSqKm(b.data.area, b.data.areaUnit);
  if (bhSqKm === null) return null;
  const rorSqKm = normalizeAreaToSqKm(r.page2.area, (r.page2 as any).areaUnit);
  if (rorSqKm === null) return null;

  const drift = areaDriftPct(bhSqKm, rorSqKm);
  if (drift > 5) {
    return [{
      panel: "plot",
      issueLens: "title_chain",
      evidenceStrength: "selected_plot_anchor",
      source: "bhunaksha:wfs:area+ror:page-2",
      severity: "redFlag",
      headline: "Bhunaksha map area disagrees with RoR area",
      body: `The revenue-map polygon area (Bhunaksha) and the RoR plot area differ by ${drift.toFixed(1)}%, which is above the 5% tolerance. This may indicate a partition, an incorrect khatiyan, or a stale map polygon.`,
      actionItem: "Ask the seller to show the recorded area on the latest RoR, and verify against Bhunaksha's plot polygon at mapserver.odisha4kgeo.in.",
      ruleId: "ROR-INS-070",
    }];
  }
  return null;
}

function bhunakshaNoDataParserWatchout(input: RuleInput): Insight[] | null {
  const b = (input as any).bhunaksha;
  if (!b) return null;
  const pageText = (b.pageText ?? b.data?.sourceDocument ?? "") as string;
  if (typeof pageText === "string" && pageText.includes("---NO DATA---")) {
    return [{
      panel: "plot",
      issueLens: "parser_source_quality",
      evidenceStrength: "parser_uncertain",
      source: "bhunaksha:plot-report:page",
      severity: "watchout",
      headline: "Bhunaksha plot page returned no data",
      body: "The Bhunaksha plot page returned a ---NO DATA--- marker for this plot. The cross-check against the revenue map could not complete.",
      actionItem: "Open the Bhunaksha plot page for this village manually and confirm the plot number, area, and khatiyan.",
      ruleId: "ROR-INS-071",
    }];
  }
  return null;
}

function bhunakshaPlotNumberMismatchWatchout(input: RuleInput): Insight[] | null {
  const b = (input as any).bhunaksha;
  const r = (input as any).ror;
  if (!b || b.status !== "success" || !b.data || typeof b.data.plotNo !== "string") return null;
  if (!r || r.status !== "verified") return null;
  if (!r.page2 || typeof r.page2.plotNumber !== "string") return null;

  const bhPlot = b.data.plotNo.trim();
  const rorPlot = r.page2.plotNumber.trim();
  if (bhPlot === "" || rorPlot === "") return null;
  if (bhPlot !== rorPlot) {
    return [{
      panel: "plot",
      issueLens: "title_chain",
      evidenceStrength: "selected_plot_anchor",
      source: "bhunaksha:wfs:plotNo+ror:page-2",
      severity: "watchout",
      headline: "Bhunaksha plot number differs from RoR plot number",
      body: `The revenue map identifies this polygon as plot ${bhPlot}, but the RoR's selected plot row is plot ${rorPlot}. The two sources disagree on which plot this is.`,
      actionItem: "Confirm with the seller which plot number is on the registered sale deed, and re-check the RoR khatiyan row.",
      ruleId: "ROR-INS-072",
    }];
  }
  return null;
}

function bhunakshaMissingSourceWatchout(input: RuleInput): Insight[] | null {
  // Fires only when some other source data is present but Bhunaksha is not.
  // A completely empty input stays quiet here.
  if (liveDataPresent(input, "bhunaksha")) return null;
  if (!liveDataPresent(input, "ror")) return null;
  return [stubFor(
    "ROR-INS-073",
    "plot",
    "parser_source_quality",
    "missing_source",
    "Bhunaksha revenue-map data was not retrieved for this query, so the plot polygon could not be cross-checked.",
    "Open the Bhunaksha plot report at mapserver.odisha4kgeo.in and verify the plot polygon manually."
  )];
}

export const bhunakshaPlotRules: Rule[] = [
  { id: "ROR-INS-070", panel: "plot", fn: bhunakshaAreaMismatchRedFlag, version: v },
  { id: "ROR-INS-071", panel: "plot", fn: bhunakshaNoDataParserWatchout, version: v },
  { id: "ROR-INS-072", panel: "plot", fn: bhunakshaPlotNumberMismatchWatchout, version: v },
  { id: "ROR-INS-073", panel: "plot", fn: bhunakshaMissingSourceWatchout, version: v },
];
