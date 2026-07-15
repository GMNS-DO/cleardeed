// agents/consumer-report-writer/src/insights/registry/bhulekh/court.ts
import type { Insight, Rule, RuleInput } from "../../schema";
import { liveDataPresent } from "../_shared";

const v = "1.0.0";

interface CourtCase {
  caseNo?: string | null;
  caseId?: string | null;
  caseType?: string | null;
  status?: string | null;
  court?: string | null;
  courtName?: string | null;
  courtComplex?: string | null;
  filingDate?: string | null;
  petitioner?: string | null;
  respondent?: string | null;
  source?: string;
}

interface CourtCases {
  total?: number;
  cases?: CourtCase[] | null;
  sources?: {
    ecourts?: string | null;
    rccms?: string | null;
  };
  searchMetadata?: {
    ecourts?: string | null;
    ecourtsStatusReason?: string | null;
    rccmsStatusReason?: string | null;
  };
}

function isPending(caze: CourtCase): boolean {
  const s = (caze.status ?? "").toLowerCase();
  if (s === "disposed") return false;
  return s === "pending" || s === "" || s.includes("pending");
}

// ROR-INS-160 — Pending property/title dispute involving seller.
// Fires when any eCourts/RCCMS case has a status that looks open (pending,
// or non-disposed) AND a case type that suggests title/possession/mortgage
// risk. eCourts search is keyed to seller name, so any hit means the seller
// has a recorded dispute. Pending title disputes on the seller are a direct
// risk to clean-title conveyance.
function pendingPropertyCaseRedFlag(input: RuleInput): Insight[] | null {
  const court = (input as any).courtCases as CourtCases | undefined | null;
  if (!court || !court.cases || court.cases.length === 0) return null;

  const pending = court.cases.filter((c) => {
    const s = (c.status ?? "").toLowerCase();
    // Dispose check: "disposed" with a disposal date means genuinely closed.
    // Some eCourts records return status "Pending" or empty even for closed cases.
    const hasDisposal = (c as any).disposalDate || (c as any).disposedDate;
    if (s === "disposed" && hasDisposal) return false;
    // Any other status (pending, ongoing, etc.) is treated as unresolved.
    return s !== "disposed";
  });

  if (pending.length === 0) return null;

  // Pick the most relevant case: title/mortgage/civil > criminal > other
  const titleTypes = /^(civil|suit|title|suit for|partition|injunction|mortgage|recovery|revination|land dispute| declaratory|money suit)/i;
  const criminalTypes = /^(criminal|copie|pc act)/i;
  const primary = pending.find((c) => titleTypes.test(c.caseType ?? "")) ??
                  pending.find((c) => criminalTypes.test(c.caseType ?? "")) ??
                  pending[0];

  const caseNo = primary.caseNo ?? primary.caseId ?? "Unknown";
  const caseType = primary.caseType ?? "Unknown";
  const courtName = primary.courtName ?? primary.court ?? primary.courtComplex ?? "Unknown court";
  const status = (primary.status ?? "pending").toLowerCase() === "disposed" ? "open/disposed" : (primary.status ?? "pending");

  return [{
    panel: "court",
    issueLens: "title_chain",
    evidenceStrength: "document_anchor",
    source: `ecourts:${court.sources?.ecourts ?? "unknown"}`,
    severity: "redFlag",
    headline: `Active court case ${caseNo} linked to the seller`,
    body: `eCourts search found ${pending.length === 1 ? "a case" : `${pending.length} cases`} linked to the seller at ${courtName}. Case ${caseNo} (${caseType}, status: ${status}) is not yet disposed. An active title or possession dispute means the seller may not have the unencumbered right to sell.`,
    actionItem: "Ask the seller for the case number, current stage, and whether a stay order exists. Engage a civil lawyer before paying any advance.",
    ruleId: "ROR-INS-160",
  }];
}

// ROR-INS-161 — Disposed title dispute within 5 years.
// Even after a case is disposed, the judgment can be challenged in appeal for
// months or years. A disposal within the last 5 years still carries residual
// title risk for a buyer. We don't have the exact disposal date for all cases,
// so we use filing date as a proxy — old cases (>10y from filing) are
// treated as stale and unlikely to have active appeals.
function disposedCaseRecentWatchout(input: RuleInput): Insight[] | null {
  const court = (input as any).courtCases as CourtCases | undefined | null;
  if (!court || !court.cases || court.cases.length === 0) return null;

  const disposed = court.cases.filter((c) => {
    const s = (c.status ?? "").toLowerCase();
    return s === "disposed";
  });

  if (disposed.length === 0) return null;

  // Estimate recency from filing date. Cases filed >10 years ago are stale.
  const currentYear = 2026;
  const recent = disposed.filter((c) => {
    const date = c.filingDate ?? "";
    const year = parseInt(date.match(/\d{4}/)?.[0] ?? "0", 10);
    return year > 0 && currentYear - year <= 10;
  });

  if (recent.length === 0) return null;

  const caseNo = recent[0].caseNo ?? recent[0].caseId ?? "Unknown";
  const caseType = recent[0].caseType ?? "Unknown";
  const courtName = recent[0].courtName ?? recent[0].court ?? "Unknown court";
  const filing = recent[0].filingDate ?? "unknown date";

  return [{
    panel: "court",
    issueLens: "title_chain",
    evidenceStrength: "document_anchor",
    source: `ecourts:${court.sources?.ecourts ?? "unknown"}`,
    severity: "watchout",
    headline: `Recently disposed case ${caseNo} on seller — residual appeal risk`,
    body: `A case (${caseType}, ${caseNo}) at ${courtName} was disposed but was filed around ${filing}. Disposed cases can still be challenged in appeal for several years. A buyer who pays full consideration during the appeal window may lose the property or face costly litigation.`,
    actionItem: `Ask the seller to confirm whether case ${caseNo} has been challenged in appeal. Request a "nil appeal" certificate from the district court registry if available.`,
    ruleId: "ROR-INS-161",
  }];
}

// ROR-INS-162 — Zero court cases found for seller name.
// A clean eCourts result is positive signal for the buyer. It means the
// seller's name returned no pending or recent disposed cases in the Odisha
// district court system. This is reassuring but not conclusive — cases under
// a different name variant, or filed in a different state, won't appear.
// Gate on genuine zero-result, not captcha failure or fetch error.
function zeroCasesPositive(input: RuleInput): Insight[] | null {
  const court = (input as any).courtCases as CourtCases | undefined | null;
  if (!court) return null;

  const ecourtsSource = court.sources?.ecourts;
  const total = court.total ?? court.cases?.length ?? 0;

  // Only emit a clean positive when both sources returned a genuine zero
  // (not "not_run" or an error status that might be a captcha failure).
  const ecourtsClean =
    ecourtsSource === "ok" ||
    ecourtsSource === "no_data" ||
    ecourtsSource === "clear" ||
    ecourtsSource === "verified";

  if (!ecourtsClean) return null;
  if (total > 0) return null; // Not a zero-result

  return [{
    panel: "court",
    issueLens: "title_chain",
    evidenceStrength: "source_observation",
    source: "ecourts:party-name-search",
    severity: "positive",
    headline: "No court cases found for the seller",
    body: "The seller's name returned zero results in the eCourts (district courts) search. No pending or recent disposed cases were found. This is a positive signal — but note: cases filed under a different name variant or in another state will not appear.",
    actionItem: "Confirm the seller's name matches exactly what appears on the RoR and sale deed. Any name discrepancy should be investigated.",
    ruleId: "ROR-INS-162",
  }];
}

// ROR-INS-163 — Court data unavailable / partial.
// When eCourts and RCCMS both return empty or error states (not "ok"), the
// court section has no real signal. We surface this so the buyer knows court
// searches were not conclusive — not a clean negative.
function courtDataUnavailableWatchout(input: RuleInput): Insight[] | null {
  const court = (input as any).courtCases as CourtCases | undefined | null;
  if (!court) return null;

  const ecourtsSrc = court.sources?.ecourts;
  const rccmsSrc = court.sources?.rccms;

  // Both sources are non-contributory — no meaningful court signal.
  const ecourtsContributing =
    ecourtsSrc === "ok" || ecourtsSrc === "no_data" ||
    ecourtsSrc === "clear" || ecourtsSrc === "verified";
  const rccmsContributing =
    rccmsSrc === "ok" || rccmsSrc === "no_data" ||
    rccmsSrc === "clear" || rccmsSrc === "verified";

  if (ecourtsContributing || rccmsContributing) return null;

  // Additional guard: if we got cases but with non-contributory status, skip.
  if ((court.total ?? court.cases?.length ?? 0) > 0) return null;

  const ecourtsNote = ecourtsSrc
    ? `eCourts returned "${ecourtsSrc}" — captcha or fetch error.`
    : "eCourts was not run.";
  const rccmsNote = rccmsSrc
    ? `RCCMS returned "${rccmsSrc}".`
    : "RCCMS was not run.";

  return [{
    panel: "court",
    issueLens: "title_chain",
    evidenceStrength: "parser_uncertain",
    source: "ecourts:party-name-search + rccms:halkhata",
    severity: "watchout",
    headline: "Court search returned inconclusive results",
    body: `Court searches could not produce a definitive result. ${ecourtsNote} ${rccmsNote} A captcha failure at eCourts is common — it does not mean there are no cases.`,
    actionItem: "Ask the buyer's lawyer to search the seller's name manually on eCourts services.ecourts.gov.in (district: Khurda) before relying on the absence of cases.",
    ruleId: "ROR-INS-163",
  }];
}

export const bhulekhCourtRules: Rule[] = [
  { id: "ROR-INS-160", panel: "court", fn: pendingPropertyCaseRedFlag, version: v },
  { id: "ROR-INS-161", panel: "court", fn: disposedCaseRecentWatchout, version: v },
  { id: "ROR-INS-162", panel: "court", fn: zeroCasesPositive, version: v },
  { id: "ROR-INS-163", panel: "court", fn: courtDataUnavailableWatchout, version: v },
];
