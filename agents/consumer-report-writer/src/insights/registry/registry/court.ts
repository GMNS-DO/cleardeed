// agents/consumer-report-writer/src/insights/registry/registry/court.ts
import type { Rule, RuleInput } from "../../schema";
import { liveDataPresent, stubFor } from "../_shared";

const v = "1.0.0";

// HIGH #4: gate every stub on RoR data presence.
function courtPendingCaseMatchesSellerStub(input: RuleInput) {
  if (!liveDataPresent(input, "ror")) return null;
  return [
    stubFor(
      "ROR-INS-120",
      "court",
      "title_chain",
      "parser_uncertain",
      "Pending-case match against seller name is not yet checked. Will activate once eCourts + High Court + DRT are live and case-name matching is wired.",
      "Search the seller name on eCourts (district courts), Orissa High Court, and DRT before signing. Any pending case linked to the seller is a red flag for the title.",
      "Court search not wired — run eCourts/HC/DRT manually"
    ),
  ];
}

function courtClosedCaseMatchesSellerStub(input: RuleInput) {
  if (!liveDataPresent(input, "ror")) return null;
  return [
    stubFor(
      "ROR-INS-121",
      "court",
      "title_chain",
      "parser_uncertain",
      "Closed-case match against seller name is not yet checked. Will activate once eCourts + High Court + DRT are live and case-name matching is wired.",
      "Even a closed old dispute can affect marketability. Ask the seller for a copy of the disposal order and the facts of the case before agreeing to a discount.",
      "Court search not wired — ask for the disposal order"
    ),
  ];
}

function courtZeroResultsStub(input: RuleInput) {
  if (!liveDataPresent(input, "ror")) return null;
  return [
    stubFor(
      "ROR-INS-122",
      "court",
      "title_chain",
      "parser_uncertain",
      "Zero-cases language is not yet safely emitted. Will activate once eCourts + High Court + DRT are live with verified negative-result confidence.",
      "A 'no cases found' result is only a real finding once the court search actually returns zero records — a partial or captcha-failed result is NOT a clean negative. Ask the buyer's lawyer to run the search manually before relying on it.",
      "'No cases' is not a clean negative — lawyer must run the search"
    ),
  ];
}

export const courtRules: Rule[] = [
  { id: "ROR-INS-120", panel: "court", fn: courtPendingCaseMatchesSellerStub, version: v },
  { id: "ROR-INS-121", panel: "court", fn: courtClosedCaseMatchesSellerStub, version: v },
  { id: "ROR-INS-122", panel: "court", fn: courtZeroResultsStub, version: v },
];
