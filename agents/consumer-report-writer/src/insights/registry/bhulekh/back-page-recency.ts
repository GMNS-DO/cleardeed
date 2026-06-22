// agents/consumer-report-writer/src/insights/registry/bhulekh/back-page-recency.ts
// V1.5 — Back-page mutation-recency patterns.
//
// Mutation case → revenue court (RCCMS / Board of Revenue /
// Tahasildar) signals an unresolved partition, government
// acquisition claim, or rival claimant. Recent mutation without
// a sale-deed anchor is suspicious. Three or more mutations in
// five years is consistent with distressed sales, benami
// layering, or repeated collateral use.
import type { Insight, Rule, RuleInput } from "../../schema";

const v = "1.0.0";

const REVENUE_COURT_KEYWORDS = [
  "RCCMS",
  "Board of Revenue",
  "BoR",
  "RDC",
  "Collector",
  "Sub-Collector",
  "Sub Collector",
  "Tahasildar",
  "Tahasil",
  "Revenue Court",
];

function mutationRevenueCourtRedFlag(input: RuleInput): Insight[] | null {
  const r = (input as any).ror;
  if (!r || r.status !== "verified") return null;
  const refs: any[] = Array.isArray(r.mutationReferences) ? r.mutationReferences : [];
  if (refs.length === 0) return null;
  const offenders = refs.filter((ref) => {
    const t = typeof ref?.caseType === "string" ? ref.caseType : "";
    if (!t) return false;
    return REVENUE_COURT_KEYWORDS.some((kw) => t.toLowerCase().includes(kw.toLowerCase()));
  });
  if (offenders.length === 0) return null;
  const list = offenders
    .slice(0, 3)
    .map((ref) => `${ref.caseType ?? "(unknown court)"} case ${ref.caseNo ?? "(no number)"}${ref.orderYear ? ` (${ref.orderYear})` : ""}`)
    .join("; ");
  return [{
    panel: "backPage",
    issueLens: "title_chain",
    evidenceStrength: "case_or_order_anchor",
    source: "bhulekh:ror:page-2",
    severity: "redFlag",
    headline: `Mutation case reference to a revenue court (${offenders.length})`,
    body: `RoR back page lists ${offenders.length} mutation case reference(s) pointing to a revenue-court jurisdiction (RCCMS / Board of Revenue / Tahasildar / Collector). A pending revenue-court case against this khatiyan can mean an unresolved partition, a government acquisition claim, or a rival claimant. ${list}`,
    actionItem: "Search the case on bhulekh.ori.nic.in / RCCMS / Cause_StatusCustomise.aspx before paying. If the case is pending, ask the seller for the latest order.",
    ruleId: "ROR-INS-072",
  }];
}

function parseOrderYear(ref: any): number | null {
  if (typeof ref?.orderYear === "number" && Number.isFinite(ref.orderYear)) return ref.orderYear;
  if (typeof ref?.orderDate === "string") {
    const m = ref.orderDate.match(/\b(19|20)\d{2}\b/);
    if (m) {
      const y = Number.parseInt(m[0], 10);
      if (Number.isFinite(y)) return y;
    }
  }
  return null;
}

function mutationRecentNoDeedWatchout(input: RuleInput): Insight[] | null {
  const r = (input as any).ror;
  if (!r || r.status !== "verified") return null;
  const refs: any[] = Array.isArray(r.mutationReferences) ? r.mutationReferences : [];
  if (refs.length === 0) return null;
  const currentYear = new Date().getFullYear();
  const offenders: any[] = [];
  for (const ref of refs) {
    const year = parseOrderYear(ref);
    if (year === null) continue;
    if (currentYear - year > 2) continue;
    // "No sale-deed anchor" — Bhulekh mutation references don't
    // typically carry a deed number field, but the caseType
    // will read "Sale" / "Sale Deed" / "ବିକ୍ରୟ" if a sale-deed
    // is the trigger. If not, we treat the mutation as
    // anchorless.
    const t = typeof ref.caseType === "string" ? ref.caseType.toLowerCase() : "";
    const newKhatiyan = typeof ref.newKhatiyan === "string" && ref.newKhatiyan.trim() !== "";
    if (t.includes("sale") || t.includes("ବିକ୍ରୟ") || newKhatiyan) continue;
    offenders.push({ ref, year });
  }
  if (offenders.length === 0) return null;
  const list = offenders
    .slice(0, 3)
    .map((o) => `${o.ref.caseType ?? "(case)"} ${o.ref.caseNo ?? "(no number)"} (${o.year})`)
    .join("; ");
  return [{
    panel: "backPage",
    issueLens: "title_chain",
    evidenceStrength: "case_or_order_anchor",
    source: "bhulekh:ror:page-2",
    severity: "watchout",
    headline: `${offenders.length} recent mutation(s) with no sale-deed anchor`,
    body: `RoR back page shows ${offenders.length} mutation case reference(s) in the last 2 years without a linked sale-deed number. The mutation could be a partition, a court order, or a government action — not a clean sale. ${list}`,
    actionItem: "Ask the seller to produce the mutation order and the document that triggered it before signing.",
    ruleId: "ROR-INS-073",
  }];
}

function mutationHighChurnWatchout(input: RuleInput): Insight[] | null {
  const r = (input as any).ror;
  if (!r || r.status !== "verified") return null;
  const refs: any[] = Array.isArray(r.mutationReferences) ? r.mutationReferences : [];
  if (refs.length < 3) return null;
  const currentYear = new Date().getFullYear();
  let recent = 0;
  for (const ref of refs) {
    const year = parseOrderYear(ref);
    if (year === null) continue;
    if (currentYear - year <= 5) recent++;
  }
  if (recent < 3) return null;
  return [{
    panel: "backPage",
    issueLens: "title_chain",
    evidenceStrength: "row_count_signal",
    source: "bhulekh:ror:page-2",
    severity: "watchout",
    headline: `${recent} mutations in the last 5 years — high churn`,
    body: `RoR back page shows ${recent} mutations in the last 5 years. High-frequency turnover is consistent with distressed sales, benami layering, or repeated collateral use. A buyer can inherit the suspicion even if each individual transfer was clean.`,
    actionItem: "Ask the seller for the chain of sale deeds and the reason for the rapid succession. Consider a Benami Transactions Act check with your lawyer.",
    ruleId: "ROR-INS-074",
  }];
}

export const bhulekhBackPageRecencyRules: Rule[] = [
  { id: "ROR-INS-072", panel: "backPage", fn: mutationRevenueCourtRedFlag, version: v },
  { id: "ROR-INS-073", panel: "backPage", fn: mutationRecentNoDeedWatchout, version: v },
  { id: "ROR-INS-074", panel: "backPage", fn: mutationHighChurnWatchout, version: v },
];
