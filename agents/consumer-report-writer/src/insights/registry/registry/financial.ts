// agents/consumer-report-writer/src/insights/registry/registry/financial.ts
import type { Rule, RuleInput } from "../../schema";
import { liveDataPresent, stubFor } from "../_shared";

const v = "1.0.0";

// HIGH #4: gate every stub on RoR data presence.
function financialAskingPriceVsBenchmarkStub(input: RuleInput) {
  if (!liveDataPresent(input, "ror")) return null;
  return [
    stubFor(
      "ROR-INS-130",
      "financial",
      "registry_ec",
      "parser_uncertain",
      "Asking-price vs IGR benchmark check is not yet wired. Will activate once the benchmark and cost-of-risk modules ship.",
      "Compare the asking price with the IGR circle-rate benchmark for the village. A deal priced more than 2x the benchmark is an overpayment red flag — walk away or renegotiate."
    ),
  ];
}

function financialEcFinancialAttachmentStub(input: RuleInput) {
  if (!liveDataPresent(input, "ror")) return null;
  return [
    stubFor(
      "ROR-INS-131",
      "financial",
      "registry_ec",
      "parser_uncertain",
      "EC financial-attachment check is not yet wired. Will activate once the benchmark and cost-of-risk modules ship and the IGR EC bridge is live.",
      "Any EC entry showing IT recovery, tax attachment, or coercive recovery means the seller's other liabilities could follow the property. Ask for a clearance certificate from the attaching authority."
    ),
  ];
}

function financialMultipleEncumbrancesStub(input: RuleInput) {
  if (!liveDataPresent(input, "ror")) return null;
  return [
    stubFor(
      "ROR-INS-132",
      "financial",
      "registry_ec",
      "parser_uncertain",
      "Combined-encumbrance exposure check is not yet wired. Will activate once the benchmark and cost-of-risk modules ship and the IGR EC bridge is live.",
      "If multiple high-value encumbrances appear on the EC, the combined ₹ exposure can exceed the property value itself. The buyer's lawyer must compute total exposure before any token is paid."
    ),
  ];
}

export const financialRules: Rule[] = [
  { id: "ROR-INS-130", panel: "financial", fn: financialAskingPriceVsBenchmarkStub, version: v },
  { id: "ROR-INS-131", panel: "financial", fn: financialEcFinancialAttachmentStub, version: v },
  { id: "ROR-INS-132", panel: "financial", fn: financialMultipleEncumbrancesStub, version: v },
];
