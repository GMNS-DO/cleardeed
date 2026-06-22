// agents/consumer-report-writer/src/insights/registry/bhulekh/land-misc.ts
// V1.5 — Misc land / parser-source-quality patterns from the wired
// `ror` payload.
//
// Section 6 / government-land marker in plot remarks is one of
// the strongest encroachment signals in Khordha. Identical
// chauhaddi (boundary) on all four sides is a record-keeping
// shortcut that hides real boundaries. Missing area blocks every
// downstream check.
import type { Insight, Rule, RuleInput } from "../../schema";

const v = "1.0.0";

const SECTION6_PATTERNS = [
  /ଧାରା\s*6/,
  /Section\s*6/i,
  /\bs\.?\s*6\b/i,
  /ସରକାରୀ\s*ଜମି/,
  /Govt\.?\s*Land/i,
  /Government\s*Land/i,
];

// ── V1.2 Section-6 rules (ROR-INS-051 through 055) ───────────────────────
// The ror.section6 object surfaces: present, rawTextOdia, areaAcres,
// areaHectares, referenceCount. Rules fire in ascending severity order.

// ROR-INS-051 — Section-6 present (base detector).
function section6PresentRedFlag(input: RuleInput): Insight[] | null {
  const r = (input as any).ror;
  if (!r || r.status !== "verified") return null;
  const s6: { present?: boolean } | undefined = r.section6;
  if (!s6 || !s6.present) return null;
  return [{
    panel: "land",
    issueLens: "land_use_permission",
    evidenceStrength: "document_anchor",
    source: "bhulekh:ror:remarks",
    severity: "redFlag",
    headline: "Section 6 / government-land marker found on RoR",
    body: "The RoR remarks contain a Section 6 / 'ସରକାରୀ ଜମି' (government land) marker — one of the strongest signals of encroachment on government land, and treated as an active dispute by the Revenue Department.",
    actionItem: "Do not pay. Ask the seller for the de-notification / diversion order from the Revenue Department, or stop the transaction.",
    ruleId: "ROR-INS-051",
  }];
}

// ROR-INS-052 — Section-6 with > 2 acres (high exposure).
function section6LargeAreaRedFlag(input: RuleInput): Insight[] | null {
  const r = (input as any).ror;
  if (!r || r.status !== "verified") return null;
  const s6: { present?: boolean; areaAcres?: number | null } | undefined = r.section6;
  if (!s6 || !s6.present) return null;
  const acres = typeof s6.areaAcres === "number" ? s6.areaAcres : null;
  if (acres === null || acres <= 2) return null;
  return [{
    panel: "land",
    issueLens: "land_use_permission",
    evidenceStrength: "document_anchor",
    source: "bhulekh:ror:remarks",
    severity: "redFlag",
    headline: `Section-6 government-land marker spans ${acres.toFixed(2)} acres`,
    body: `The RoR remarks contain a Section 6 marker covering ${acres.toFixed(2)} acres. Large-area Section-6 parcels carry higher financial exposure if the government resumes the land.`,
    actionItem: "Do not pay. Verify the de-notification / diversion order covers the full ${acres.toFixed(2)} acres, or stop the transaction.",
    ruleId: "ROR-INS-052",
  }];
}

// ROR-INS-053 — Section-6 + owner name contains government wording.
function section6GovtOwnerRedFlag(input: RuleInput): Insight[] | null {
  const r = (input as any).ror;
  if (!r || r.status !== "verified") return null;
  const s6: { present?: boolean } | undefined = r.section6;
  if (!s6 || !s6.present) return null;
  const owner: string | null | undefined = r.page1?.owner;
  if (!owner) return null;
  const gov = /govt|government|ସରକାର|ଓଡିଶା|ରାଜ୍ୟ|ରିଜର୍ଭ/i;
  if (!gov.test(owner)) return null;
  return [{
    panel: "land",
    issueLens: "land_use_permission",
    evidenceStrength: "document_anchor",
    source: "bhulekh:ror:page-1,remarks",
    severity: "redFlag",
    headline: `RoR owner name is "${owner}" and Section-6 marker is present`,
    body: `The RoR records the owner as '${owner}' and also carries a Section-6 / government-land marker in the remarks. This combination signals government ownership, not private encroachment.`,
    actionItem: "Stop the transaction. Government land cannot be sold as private property. Verify the ownership with the Tehsil office.",
    ruleId: "ROR-INS-053",
  }];
}

// ROR-INS-054 — Section-6 with > 1 reference (pattern strength).
function section6MultipleReferenceRedFlag(input: RuleInput): Insight[] | null {
  const r = (input as any).ror;
  if (!r || r.status !== "verified") return null;
  const s6: { present?: boolean; referenceCount?: number } | undefined = r.section6;
  if (!s6 || !s6.present) return null;
  const count = typeof s6.referenceCount === "number" ? s6.referenceCount : 0;
  if (count <= 1) return null;
  return [{
    panel: "land",
    issueLens: "land_use_permission",
    evidenceStrength: "document_anchor",
    source: "bhulekh:ror:remarks",
    severity: "redFlag",
    headline: `Section-6 marker appears ${count} times on the RoR`,
    body: `The Section-6 / government-land marker is referenced ${count} times across the RoR remarks and plot table. Multiple references strengthen the government-land classification and reduce the chance of a clerical error.`,
    actionItem: "Treat the land as government property. Ask the seller for the de-notification / diversion order covering all ${count} references.",
    ruleId: "ROR-INS-054",
  }];
}

// ROR-INS-055 — Section-6 + Govt of Odisha / ଓଡିଶା ସରକାର wording.
function section6StateGovtRedFlag(input: RuleInput): Insight[] | null {
  const r = (input as any).ror;
  if (!r || r.status !== "verified") return null;
  const s6: { present?: boolean; rawTextOdia?: string | null } | undefined = r.section6;
  if (!s6 || !s6.present) return null;
  const raw = typeof s6.rawTextOdia === "string" ? s6.rawTextOdia : "";
  if (!raw) return null;
  const state = /Govt\.?\s+of\s+Odisha|ଓଡିଶା\s+ସରକାର|ଓଡିଶା\s+ସରକାର/i;
  if (!state.test(raw)) return null;
  return [{
    panel: "land",
    issueLens: "land_use_permission",
    evidenceStrength: "document_anchor",
    source: "bhulekh:ror:remarks",
    severity: "redFlag",
    headline: "Section-6 reference names Govt of Odisha (state government land)",
    body: "The RoR Section-6 marker explicitly references 'Govt of Odisha' / 'ଓଡିଶା ସରକାର'. This is state government land, not merely 'government land' — the state is the direct owner.",
    actionItem: "Stop the transaction. State government land cannot be transferred as private property without a legislative act or explicit de-notification.",
    ruleId: "ROR-INS-055",
  }];
}

// ── V1.5 — legacy ROR-INS-077 (now superseded by 051–055, kept for backward compatibility) ──
function plotRemarksSection6RedFlag(input: RuleInput): Insight[] | null {
  const r = (input as any).ror;
  if (!r || r.status !== "verified") return null;
  const plots: any[] = Array.isArray(r.page2?.plots) ? r.page2.plots : [];
  if (plots.length === 0) return null;
  const hits: { plotNo: string; snippet: string }[] = [];
  for (const row of plots) {
    if (!row || typeof row !== "object") continue;
    const remarks = typeof row.remarksOdia === "string" ? row.remarksOdia : "";
    if (!remarks) continue;
    if (SECTION6_PATTERNS.some((rx) => rx.test(remarks))) {
      hits.push({
        plotNo: typeof row.plotNo === "string" ? row.plotNo : "(unknown)",
        snippet: remarks.slice(0, 200),
      });
    }
  }
  if (hits.length === 0) return null;
  // Also accept the section6 counter if the mapper already
  // aggregated it (belt + braces — don't double-fire).
  const agg = r.section6;
  if (agg && typeof agg.referenceCount === "number" && agg.referenceCount === 0 && hits.length === 0) return null;
  const list = hits
    .slice(0, 3)
    .map((h) => `Plot ${h.plotNo}: "${h.snippet}"`)
    .join("; ");
  return [{
    panel: "land",
    issueLens: "land_use_permission",
    evidenceStrength: "document_anchor",
    source: "bhulekh:ror:page-2",
    severity: "redFlag",
    headline: `Section 6 / government-land marker found in ${hits.length} plot row${hits.length === 1 ? "" : "s"}`,
    body: `The RoR plot remarks for this khatiyan contain a Section 6 / "ସରକାରୀ ଜମି" (government land) marker — one of the strongest signals of encroachment on government land, and treated as an active dispute by the Revenue Department. ${list}`,
    actionItem: "Do not pay. Ask the seller for the de-notification / diversion order, or stop the transaction.",
    ruleId: "ROR-INS-077",
  }];
}

function chauhaddiIdenticalWatchout(input: RuleInput): Insight[] | null {
  const r = (input as any).ror;
  if (!r || r.status !== "verified") return null;
  // chauhaddiByPlot is keyed by plotNo; each value is
  // { north, south, east, west }.
  const byPlot = r.chauhaddiByPlot;
  if (!byPlot || typeof byPlot !== "object") return null;
  const entries = Object.entries(byPlot) as [string, any][];
  if (entries.length === 0) return null;
  const norm = (v: unknown) =>
    typeof v === "string" ? v.trim().toLowerCase().replace(/\s+/g, " ") : "";
  const offenders: string[] = [];
  for (const [plotNo, c] of entries) {
    if (!c || typeof c !== "object") continue;
    const n = norm(c.north);
    const s = norm(c.south);
    const e = norm(c.east);
    const w = norm(c.west);
    if (!n && !s && !e && !w) continue; // all empty — different signal
    if (n && s && e && w && n === s && s === e && e === w) {
      offenders.push(plotNo);
    }
  }
  if (offenders.length === 0) return null;
  return [{
    panel: "land",
    issueLens: "title_chain",
    evidenceStrength: "source_observation",
    source: "bhulekh:ror:page-2",
    severity: "watchout",
    headline: `Identical chauhaddi on all four sides for ${offenders.length} plot row${offenders.length === 1 ? "" : "s"}`,
    body: `The RoR plot rows for ${offenders.slice(0, 3).join(", ")}${offenders.length > 3 ? "…" : ""} record the same value on all four boundaries (e.g. "Road" on every side, or the same plot number on every side). Real chauhaddi entries almost always have different boundary references — a uniform value is a record-keeping shortcut that hides the real boundaries and can mask an encroachment or a partition that was never recorded.`,
    actionItem: "Ask the seller for the original hal / field map, or commission a physical survey to confirm the actual boundaries before paying.",
    ruleId: "ROR-INS-081",
  }];
}

function plotAreaMissingWatchout(input: RuleInput): Insight[] | null {
  const r = (input as any).ror;
  if (!r || r.status !== "verified") return null;
  const target = r.plotTable?.targetRow;
  const plots: any[] = Array.isArray(r.page2?.plots) ? r.page2.plots : [];
  if (plots.length === 0) return null;
  // If every plot row has a missing / zero area, fire.
  const allMissing = plots.every((row) => {
    const a = Number(row?.area ?? row?.areaAcres);
    return !Number.isFinite(a) || a <= 0;
  });
  if (!allMissing) return null;
  return [{
    panel: "land",
    issueLens: "parser_source_quality",
    evidenceStrength: "parser_uncertain",
    source: "bhulekh:ror:page-2",
    severity: "watchout",
    headline: "Plot rows have no usable area recorded",
    body: `The RoR plot rows for this khatiyan do not carry a usable area. Without an area, you cannot price the plot, cannot reconcile against Bhunaksha, and cannot compute a circle-rate benchmark.`,
    actionItem: "Open the RoR PDF from bhulekh.ori.nic.in and read the area by hand, or ask the tehsil to issue a corrected RoR.",
    ruleId: "ROR-INS-082",
  }];
}

// ROR-INS-045 — Area unit cross-check. The Bhulekh plot row carries
// area in three forms: acres, decimals (1/10000 acre), and hectares.
// Standard conversion: 1 hectare = 2.47105 acres; 1 decimal = 0.0001 acre.
// Reconstruct total acres as (acres + decimals/10000) and compare against
// hectares × 2.47105. If the two diverge by more than 5%, the row is
// either mistyped on the RoR, a misread by the parser, or — less
// commonly — a sign that one of the figures has been fabricated.
function areaUnitMismatchWatchout(input: RuleInput): Insight[] | null {
  const r = (input as any).ror;
  if (!r || r.status !== "verified") return null;
  const rows: any[] = Array.isArray(r.plotTable?.rows) ? r.plotTable.rows : [];
  const mismatches: string[] = [];
  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const acres = numberOrNull(row.areaAcres);
    const decimals = numberOrNull(row.areaDecimals);
    const hectares = numberOrNull(row.areaHectares);
    if (acres === null && decimals === null) continue;
    if (hectares === null) continue;
    const totalAcres = (acres ?? 0) + (decimals ?? 0) / 10000;
    const expectedAcresFromHectares = hectares * 2.47105;
    const denom = Math.max(totalAcres, 0.001);
    const pctDiff = Math.abs(totalAcres - expectedAcresFromHectares) / denom;
    if (pctDiff > 0.05) {
      const plotNo = typeof row.plotNo === "string" && row.plotNo.trim() ? row.plotNo.trim() : "(unknown plot)";
      mismatches.push(`plot ${plotNo}: ${totalAcres.toFixed(4)} ac (${acres ?? 0}+${decimals ?? 0}/10000) vs ${hectares} ha (expected ~${expectedAcresFromHectares.toFixed(4)} ac)`);
    }
  }
  if (mismatches.length === 0) return null;
  const sample = mismatches.slice(0, 4).join("; ");
  return [{
    panel: "land",
    issueLens: "parser_source_quality",
    evidenceStrength: "document_anchor",
    source: "bhulekh:ror:page-2",
    severity: "watchout",
    headline: `${mismatches.length} plot row(s) have inconsistent area units on the RoR`,
    body: `The RoR plot table records area in three forms (acres, decimals, hectares) per row. Standard conversion: 1 hectare = 2.47105 acres; 1 decimal = 0.0001 acre. The following rows do not reconcile across units: ${sample}.`,
    actionItem: "Open the RoR PDF from bhulekh.ori.nic.in and read the area by hand for each mismatched plot row. Ask the tehsil to issue a corrected RoR before relying on these area figures.",
    ruleId: "ROR-INS-045",
  }];
}

function numberOrNull(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

export const bhulekhLandMiscRules: Rule[] = [
  { id: "ROR-INS-045", panel: "land", fn: areaUnitMismatchWatchout, version: v },
  { id: "ROR-INS-051", panel: "land", fn: section6PresentRedFlag, version: v },
  { id: "ROR-INS-052", panel: "land", fn: section6LargeAreaRedFlag, version: v },
  { id: "ROR-INS-053", panel: "land", fn: section6GovtOwnerRedFlag, version: v },
  { id: "ROR-INS-054", panel: "land", fn: section6MultipleReferenceRedFlag, version: v },
  { id: "ROR-INS-055", panel: "land", fn: section6StateGovtRedFlag, version: v },
  { id: "ROR-INS-077", panel: "land", fn: plotRemarksSection6RedFlag, version: v },
  { id: "ROR-INS-081", panel: "land", fn: chauhaddiIdenticalWatchout, version: v },
  { id: "ROR-INS-082", panel: "land", fn: plotAreaMissingWatchout, version: v },
];
