// agents/consumer-report-writer/src/insights/registry/registry/encumbrance.ts
import type { Insight, Rule, RuleInput } from "../../schema";
import { liveDataPresent, stubFor } from "../_shared";

const v = "1.0.0";

// HIGH #4: every stub in this panel gates on RoR data presence so the
// stubs do not fire on demo / empty inputs. Each stub still fires on a
// real consumer report (where RoR was fetched), but the engine can now
// keep noise low on demos and on partial fetches that lack RoR.
function encumbranceActiveMortgageStub(input: RuleInput) {
  if (!liveDataPresent(input, "ror")) return null;
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

function encumbranceNonDischargedChargeStub(input: RuleInput) {
  if (!liveDataPresent(input, "ror")) return null;
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

function encumbranceSatisfactionEntryStub(input: RuleInput) {
  if (!liveDataPresent(input, "ror")) return null;
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

function encumbranceCersaiChargeStub(input: RuleInput): Insight[] | null {
  const c = (input as any).cersai;
  if (c && c.activeCharge === true) {
    return [
      {
        panel: "encumbrance",
        issueLens: "registry_ec",
        evidenceStrength: "document_anchor",
        source: "cersai:asset-search",
        severity: "redFlag",
        headline: "Active charge on CERSAI",
        body: "CERSAI records an active financial charge against this property.",
        actionItem:
          "Ask the seller for a No-Encumbrance confirmation, and a letter from the charge holder confirming release.",
        ruleId: "ROR-INS-103",
      },
    ];
  }
  // Stub branch: only on a real report (RoR fetched). Demos stay quiet.
  if (!c && liveDataPresent(input, "ror")) {
    return [
      stubFor(
        "ROR-INS-103",
        "encumbrance",
        "registry_ec",
        "document_anchor",
        "CERSAI active-charge check is not yet wired. Will activate once the CERSAI bridge ships (after the IGR EC bridge).",
        "Search CERSAI for any active security interest on this asset at cersai.org.in before signing."
      ),
    ];
  }
  return null;
}

function encumbranceNarrowWindowStub(input: RuleInput) {
  if (!liveDataPresent(input, "ror")) return null;
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
