// agents/consumer-report-writer/src/insights/registry/bhulekh/dues.ts
import type { Insight, Rule, RuleInput } from "../../schema";

const v = "1.0.0";

function revenueDuesOverdueRedFlag(input: RuleInput): Insight[] | null {
  const r = (input as any).ror;
  if (!r || r.status !== "verified") return null;
  const dues = r.page1?.revenueDues;
  if (!dues || typeof dues !== "object") return null;
  const amount = typeof dues.amount === "number" ? dues.amount : Number(dues.amount);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  const year = typeof dues.year === "number" ? dues.year : Number(dues.year);
  const currentYear = typeof dues.currentYear === "number" ? dues.currentYear : new Date().getFullYear();
  if (!Number.isFinite(year)) return null;
  if (currentYear - year < 2) return null;
  return [{
    panel: "dues",
    issueLens: "revenue_record",
    evidenceStrength: "document_anchor",
    source: "bhulekh:ror:page-1",
    severity: "redFlag",
    headline: `Outstanding revenue dues of ₹${amount} (year ${year})`,
    body: `The RoR page 1 shows revenue dues of ₹${amount} assessed in ${year}, more than 1 year old. Unpaid revenue dues can attract penalty and stay attached to the khatiyan until cleared.`,
    actionItem: "Ask the seller to produce a no-dues receipt from the tehsil and clear all outstanding revenue dues before you sign the sale deed.",
    ruleId: "ROR-INS-050",
  }];
}

function revenueDuesYearUnverifiedWatchout(input: RuleInput): Insight[] | null {
  const r = (input as any).ror;
  if (!r || r.status !== "verified") return null;
  const dues = r.page1?.revenueDues;
  if (!dues || typeof dues !== "object") return null;
  const amount = typeof dues.amount === "number" ? dues.amount : Number(dues.amount);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  const year = dues.year;
  if (year !== null && year !== undefined && Number.isFinite(Number(year))) return null;
  return [{
    panel: "dues",
    issueLens: "parser_source_quality",
    evidenceStrength: "parser_uncertain",
    source: "bhulekh:ror:page-1",
    severity: "watchout",
    headline: `Revenue dues of ₹${amount} found but year is not readable`,
    body: `The RoR page 1 shows revenue dues of ₹${amount} but the assessment year could not be parsed. We can't tell whether the dues are recent or stale.`,
    actionItem: "Open the RoR PDF from bhulekh.ori.nic.in and read the assessment year by hand, or ask the seller to produce a tehsil no-dues receipt.",
    ruleId: "ROR-INS-051",
  }];
}

function duesFieldMissingWatchout(input: RuleInput): Insight[] | null {
  const r = (input as any).ror;
  if (!r || r.status !== "verified") return null;
  const p1 = r.page1;
  if (!p1) return null;
  const hasField = p1.revenueDues !== undefined && p1.revenueDues !== null;
  if (hasField) return null;
  return [{
    panel: "dues",
    issueLens: "parser_source_quality",
    evidenceStrength: "missing_source",
    source: "bhulekh:ror:page-1",
    severity: "watchout",
    headline: "Revenue dues field is not readable on RoR page 1",
    body: "We could not read a revenue-dues field on RoR page 1. This is either a parser gap or the page is missing the field entirely.",
    actionItem: "Open the RoR PDF from bhulekh.ori.nic.in and check the 'Khajana' / 'Dues' section by hand before paying any advance.",
    ruleId: "ROR-INS-052",
  }];
}

export const bhulekhDuesRules: Rule[] = [
  { id: "ROR-INS-050", panel: "dues", fn: revenueDuesOverdueRedFlag, version: v },
  { id: "ROR-INS-051", panel: "dues", fn: revenueDuesYearUnverifiedWatchout, version: v },
  { id: "ROR-INS-052", panel: "dues", fn: duesFieldMissingWatchout, version: v },
];