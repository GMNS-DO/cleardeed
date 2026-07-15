// agents/consumer-report-writer/src/insights/registry/bhulekh/back-page-remarks.ts
//
// ROR-INS-156 — Back-Page Remarks Red Flags.
//
// Bhulekh RoR page 2 contains a "Govt. Reservation/Demarcation" section
// that is distinct from the mutation history and encumbrance table. It can
// surface three categories of risk encoded as BhulekhBackPageRemark:
//
//   court_case    → government litigation or order affecting the khatiyan
//   bank_charge   → registered charge / mortgage note not in the EC table
//   govt_restriction → government restriction on the land
//
// This rule fires a watchout for each remark found, giving the buyer a
// structured anchor to investigate each entry manually. Unlike ROR-INS-060
// (mutation refs positive) and ROR-INS-062/064 (specific encumbrance types),
// this rule covers the remarks section which is a separate parsing target.

import type { Insight, Rule, RuleInput } from "../../schema";

const v = "1.0.0";

type BhulekhRemark = {
  category: "court_case" | "bank_charge" | "govt_restriction" | "other" | "unknown";
  rawText: string;
  extractedCaseNo?: string | null;
  extractedBankName?: string | null;
};

type BhulekhRuleInput = {
  ror?: {
    status?: string;
    backPage?: {
      schemaVersion?: string;
      fetchedAt?: string;
      status?: string;
      backPageRemarks?: BhulekhRemark[];
      backPageBlank?: boolean;
      rawHtml?: string;
    } | null;
  };
};

function buildInsight(remark: BhulekhRemark): Insight {
  const cat = remark.category;

  if (cat === "court_case") {
    return {
      panel: "backPage",
      issueLens: "title_chain",
      evidenceStrength: "document_anchor",
      source: "bhulekh:ror:page-2:remark:court_case",
      severity: "watchout",
      headline: `Court case noted on RoR page 2${
        remark.extractedCaseNo ? ` — Case No. ${remark.extractedCaseNo}` : ""
      }`,
      body: `RoR page 2 contains a court case remark: "${remark.rawText}".${
        remark.extractedCaseNo
          ? ` The case number ${remark.extractedCaseNo} was extracted and should be verifiable on the eCourts portal.`
          : ""
      } Court case entries on the RoR indicate a pending government or revenue litigation affecting the khatiyan.`,
      actionItem: remark.extractedCaseNo
        ? `Search for case number ${remark.extractedCaseNo} on services.ecourts.gov.in (Khurda district) to determine the case status, nature, and whether the land or title is at issue.`
        : "Request the full case details from the tehsil or RoR PDF. Search the owner's name on services.ecourts.gov.in (Khurda district) to identify the case.",
      ruleId: "ROR-INS-156",
    };
  }

  if (cat === "bank_charge") {
    return {
      panel: "backPage",
      issueLens: "encumbrance_charge",
      evidenceStrength: "document_anchor",
      source: "bhulekh:ror:page-2:remark:bank_charge",
      severity: "watchout",
      headline: `Bank / charge remark found on RoR page 2${
        remark.extractedBankName ? ` — ${remark.extractedBankName}` : ""
      }`,
      body: `RoR page 2 contains a bank or charge remark: "${remark.rawText}".${
        remark.extractedBankName
          ? ` The bank name ${remark.extractedBankName} was identified.`
          : ""
      } Bank charge entries on the RoR usually indicate a mortgage or loan that was registered at the SRO. The Encumbrance Certificate must be pulled to confirm whether this charge is still outstanding.`,
      actionItem: remark.extractedBankName
        ? `Pull the Encumbrance Certificate from the SRO and search for any mortgage or charge registered in favour of ${remark.extractedBankName}. Ask the seller for the loan closure letter and NOC from the bank.`
        : "Pull the Encumbrance Certificate from the SRO. Ask the seller to confirm whether any loan or mortgage is outstanding against the khatiyan.",
      ruleId: "ROR-INS-156",
    };
  }

  if (cat === "govt_restriction") {
    return {
      panel: "backPage",
      issueLens: "title_chain",
      evidenceStrength: "document_anchor",
      source: "bhulekh:ror:page-2:remark:govt_restriction",
      severity: "watchout",
      headline: `Government restriction noted on RoR page 2`,
      body: `RoR page 2 contains a government restriction remark: "${remark.rawText}". Government restriction entries indicate a statutory constraint on the khatiyan — such as a reservation under a particular Act, a acquisition notice, or a non-transferability clause.`,
      actionItem:
        "Ask the tehsil clerk for the full text of the government order or Act under which the restriction was imposed. Verify with a Bhubaneswar advocate whether the restriction is still operative and whether it prevents free sale of the land.",
      ruleId: "ROR-INS-156",
    };
  }

  // Fallback for "other" / "unknown" categories.
  return {
    panel: "backPage",
    issueLens: "title_chain",
    evidenceStrength: "source_observation",
    source: "bhulekh:ror:page-2:remark:unknown",
    severity: "watchout",
    headline: `RoR page 2 contains a miscellaneous remark`,
    body: `RoR page 2 contains a remark that could not be categorised: "${remark.rawText}". This entry should be reviewed by the buyer's advocate.`,
    actionItem:
      "Open the RoR PDF from bhulekh.ori.nic.in and read the page 2 remarks section by hand. Ask the tehsil clerk or a Bhubaneswar advocate to interpret the remark.",
    ruleId: "ROR-INS-156",
  };
}

/**
 * ROR-INS-156 — Back-Page Remarks Red Flags.
 *
 * Fires a watchout for each non-empty, categorised remark in the RoR
 * page 2 "Govt. Reservation/Demarcation" section. Only fires when the
 * RoR status is "verified" and the back page was successfully parsed.
 * Remarks with category "unknown" and empty rawText are skipped.
 */
function backPageRemarksCheck(input: RuleInput): Insight[] | null {
  const i = input as unknown as BhulekhRuleInput;
  const ror = i.ror;
  if (!ror) return null;
  if (ror.status !== "verified") return null;

  const backPage = ror.backPage;
  if (!backPage) return null;

  // If the back page parsing itself failed, skip.
  if (backPage.status === "failed" || backPage.status === "parse_error") return null;

  const remarks: BhulekhRemark[] = backPage.backPageRemarks ?? [];
  if (remarks.length === 0) return null;

  // Filter out remarks with no useful content.
  const actionableRemarks = remarks.filter(
    (r) => r.rawText && r.rawText.trim().length > 0 && r.category !== "unknown"
  );

  if (actionableRemarks.length === 0) return null;

  return actionableRemarks.map(buildInsight);
}

export const bhulekhBackPageRemarksRules: Rule[] = [
  { id: "ROR-INS-156", panel: "backPage", fn: backPageRemarksCheck, version: v },
];
