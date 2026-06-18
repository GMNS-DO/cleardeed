// agents/consumer-report-writer/src/insights/registry/registry/encumbrance.ts
import type { Rule, RuleInput } from "../../schema";
import { stubFor } from "../_shared";

const v = "1.0.0";

function encumbranceActiveMortgageStub(_input: RuleInput) {
  return [
    stubFor(
      "ROR-INS-100",
      "encumbrance",
      "registry_ec",
      "parser_uncertain",
      "Active mortgage in EC entries is not yet checked. Will activate once the IGR EC bridge ships.",
      "Request the latest Encumbrance Certificate (EC) covering at least the last 30 years from the Sub-Registrar office, and look for any unreleased mortgage, charge, or lien."
    ),
  ];
}

function encumbranceNonDischargedChargeStub(_input: RuleInput) {
  return [
    stubFor(
      "ROR-INS-101",
      "encumbrance",
      "registry_ec",
      "parser_uncertain",
      "Non-discharged charge in the EC is not yet checked. Will activate once the IGR EC bridge ships.",
      "Ask the seller to produce a No-Objection Certificate (NOC) or release deed for any prior charge appearing on the EC."
    ),
  ];
}

function encumbranceSatisfactionEntryStub(_input: RuleInput) {
  return [
    stubFor(
      "ROR-INS-102",
      "encumbrance",
      "registry_ec",
      "parser_uncertain",
      "Satisfaction-of-charge entry is not yet checked. Will activate once the IGR EC bridge ships.",
      "Verify the satisfaction entry on the EC and confirm the corresponding release deed is registered."
    ),
  ];
}

function encumbranceCersaiChargeStub(_input: RuleInput) {
  return [
    stubFor(
      "ROR-INS-103",
      "encumbrance",
      "registry_ec",
      "parser_uncertain",
      "CERSAI active-charge check is not yet wired. Will activate once the CERSAI bridge ships (after the IGR EC bridge).",
      "Search CERSAI for any active security interest on this asset at cersai.org.in before signing."
    ),
  ];
}

function encumbranceNarrowWindowStub(_input: RuleInput) {
  return [
    stubFor(
      "ROR-INS-104",
      "encumbrance",
      "registry_ec",
      "parser_uncertain",
      "EC window-coverage check is not yet wired. Will activate once the IGR EC bridge ships.",
      "Make sure the EC period covers at least 30 years (or the full chain of ownership) — a narrow EC does not rule out earlier encumbrances."
    ),
  ];
}

export const encumbranceRules: Rule[] = [
  { id: "ROR-INS-100", panel: "encumbrance", fn: encumbranceActiveMortgageStub, version: v },
  { id: "ROR-INS-101", panel: "encumbrance", fn: encumbranceNonDischargedChargeStub, version: v },
  { id: "ROR-INS-102", panel: "encumbrance", fn: encumbranceSatisfactionEntryStub, version: v },
  { id: "ROR-INS-103", panel: "encumbrance", fn: encumbranceCersaiChargeStub, version: v },
  { id: "ROR-INS-104", panel: "encumbrance", fn: encumbranceNarrowWindowStub, version: v },
];
