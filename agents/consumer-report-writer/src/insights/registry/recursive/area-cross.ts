// agents/consumer-report-writer/src/insights/registry/recursive/area-cross.ts
// V1.5 — Cross-source area reconciliation patterns.
//
// ROR-INS-078 — Bhulekh internal area inconsistency (acres vs
//   hectares disagree by more than 5% on the same plot row).
// ROR-INS-079 — Bhunaksha polygon area vs Bhulekh recorded area
//   disagree by more than 15% (survey dispute or encroachment).
//
// Both rules need a verified `ror` payload AND, for 079, a
// verified `bhunaksha` payload with a usable polygon. The 079
// rule is the escalation of the existing CS-06 cross-source
// check, which uses 5% — we use 15% because Bhunaksha polygons
// often have looser precision than Bhulekh recorded area.
import type { Insight, Rule, RuleInput } from "../../schema";

const v = "1.0.0";

const HECTARES_PER_ACRE = 2.4710538147;

function acresToHectares(a: number): number {
  return a / HECTARES_PER_ACRE;
}

function areaInternalInconsistencyWatchout(input: RuleInput): Insight[] | null {
  const r = (input as any).ror;
  if (!r || r.status !== "verified") return null;
  const plots: any[] = Array.isArray(r.page2?.plots) ? r.page2.plots : [];
  if (plots.length === 0) return null;
  const offenders: { plotNo: string; acres: number; hectares: number; driftPct: number }[] = [];
  for (const row of plots) {
    if (!row || typeof row !== "object") continue;
    const a = Number(row.areaAcres);
    const h = Number(row.areaHectares);
    if (!Number.isFinite(a) || a <= 0) continue;
    if (!Number.isFinite(h) || h <= 0) continue;
    const expectedH = acresToHectares(a);
    const driftPct = (Math.abs(h - expectedH) / a) * 100;
    if (driftPct > 5) {
      offenders.push({
        plotNo: typeof row.plotNo === "string" ? row.plotNo : "(unknown)",
        acres: a,
        hectares: h,
        driftPct,
      });
    }
  }
  if (offenders.length === 0) return null;
  const list = offenders
    .slice(0, 3)
    .map((o) => `Plot ${o.plotNo}: ${o.acres.toFixed(4)} ac vs ${o.hectares.toFixed(4)} ha (${o.driftPct.toFixed(1)}% drift)`)
    .join("; ");
  return [{
    panel: "land",
    issueLens: "parser_source_quality",
    evidenceStrength: "document_anchor",
    source: "bhulekh:ror:page-2",
    severity: "watchout",
    headline: `Bhulekh acres vs hectares disagree by > 5% on ${offenders.length} row${offenders.length === 1 ? "" : "s"}`,
    body: `The RoR plot rows record both an acreage and a hectare figure that disagree by more than 5%. An inconsistent area usually means a digitisation error on Bhulekh or a manual override — both can distort mutation records and circle-rate assessment. ${list}`,
    actionItem: "Re-measure the plot physically with a surveyor and ask the tehsil to issue a corrected RoR before paying.",
    ruleId: "ROR-INS-078",
  }];
}

function bhunakshaAreaMismatchWatchout(input: RuleInput): Insight[] | null {
  const r = (input as any).ror;
  const b = (input as any).bhunaksha;
  if (!r || r.status !== "verified") return null;
  if (!b || b.status !== "verified") return null;
  // Bhunaksha payload: area is in km² (WFS convention).
  const polyAreaKm2 = Number(b.area);
  if (!Number.isFinite(polyAreaKm2) || polyAreaKm2 <= 0) return null;
  const polyAreaAcres = polyAreaKm2 * 247.105; // 1 km² = 247.105 acres
  // Bhulekh recorded area: take the target row, fall back to
  // the first plot row.
  const target = r.plotTable?.targetRow;
  const plotRow = target ?? r.page2?.plots?.[0] ?? null;
  const rorArea = Number(plotRow?.area ?? plotRow?.areaAcres);
  if (!Number.isFinite(rorArea) || rorArea <= 0) return null;
  const driftPct = (Math.abs(polyAreaAcres - rorArea) / rorArea) * 100;
  if (driftPct <= 15) return null;
  return [{
    panel: "land",
    issueLens: "land_use_permission",
    evidenceStrength: "source_observation",
    source: "bhunaksha:plot:polygon",
    severity: driftPct > 30 ? "redFlag" : "watchout",
    headline: `Bhunaksha polygon area vs Bhulekh recorded area mismatch (${driftPct.toFixed(1)}%)`,
    body: `The polygon area in Bhunaksha (${polyAreaAcres.toFixed(4)} acres) differs from the area recorded in the RoR (${rorArea.toFixed(4)} acres) by ${driftPct.toFixed(1)}%. A large area mismatch usually means the polygon was re-surveyed after the RoR was written, or the plot has been physically encroached into adjacent land. The Bhulekh-recorded area is the legal area; the Bhunaksha polygon is what is on the ground today.`,
    actionItem: "Commission a fresh physical survey and ask the tehsil for a Jamabandi (re-survey) before paying the seller or starting construction.",
    ruleId: "ROR-INS-079",
  }];
}

export const areaCrossRules: Rule[] = [
  { id: "ROR-INS-078", panel: "land", fn: areaInternalInconsistencyWatchout, version: v },
  { id: "ROR-INS-079", panel: "land", fn: bhunakshaAreaMismatchWatchout, version: v },
];
