// agents/consumer-report-writer/src/insights/registry/bhulekh/igr-ec.ts
import type { Insight, Rule, RuleInput } from "../../schema";
import { stubFor } from "../_shared";

const v = "1.0.0";

type IgrEcEntryLike = {
  docType?: string;
  docNo?: string;
  regDate?: string;
  party1?: string;
  party2?: string;
  propertyDesc?: string;
  consideration?: string;
  marketValue?: string;
};

type IgrEcLike = {
  ecAvailable?: boolean;
  poaOnRecord?: boolean;
  entryCount?: number;
  searchPeriod?: string | { from?: string; to?: string };
  entries?: IgrEcEntryLike[];
};

function igrEcData(input: RuleInput): IgrEcLike | null {
  const d = (input as any).igrEc;
  if (!d || typeof d !== "object") return null;
  return d as IgrEcLike;
}

// docType values that signal an active encumbrance (mortgage, charge, or
// hypothecation). Discharge/release entries are NOT a concern because they
// indicate the prior charge has been satisfied — we walk past those.
const ACTIVE_ENCUMBRANCE_DOC_TYPES = new Set([
  "mortgage",
  "charge",
  "hypothecation",
  "hip",
]);

function isEntryDischarged(entry: IgrEcEntryLike): boolean {
  // Discharge/release entries show up with the same docType but carry a
  // different party1 (typically the lender acknowledging release) or a
  // propertyDesc that says "release" / "satisfaction". Heuristic: if any
  // field explicitly says "release" or "discharge" or "satisfaction",
  // treat it as already satisfied and skip.
  const blob = [
    entry.docType,
    entry.docNo,
    entry.party1,
    entry.party2,
    entry.propertyDesc,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return /(release|discharge|satisfaction|satisfied|released)/.test(blob);
}

// ROR-INS-181 — Active mortgage in EC entries.
// Activates when the IGR EC bridge has populated `igrEc.entries`. Any entry
// whose docType is mortgage/charge/hypothecation and is NOT marked discharged
// fires redFlag with the lender name, document number, and consideration.
function igrEcActiveMortgageWatchout(input: RuleInput): Insight[] | null {
  const d = igrEcData(input);

  // Stub fires when IGR data is absent on a real report (no IGR fetch ran).
  if (!d || !d.ecAvailable) {
    if ((input as any).ror) {
      return [
        stubFor(
          "ROR-INS-181",
          "encumbrance",
          "registry_ec",
          "parser_uncertain",
          "IGR Encumbrance Certificate was not retrieved for this report. The presence or absence of a mortgage or charge on this property is unknown.",
          "Request the latest Encumbrance Certificate (EC) covering at least 30 years from the Sub-Registrar office. Look for any unreleased mortgage, charge, or lien.",
          "EC not retrieved — request a 30-year EC from the SRO"
        ),
      ];
    }
    return null;
  }

  // EC retrieved — walk entries for active encumbrances.
  const entries = d.entries ?? [];
  const activeMortgages = entries.filter((e) => {
    const dt = (e.docType ?? "").toLowerCase().trim();
    return ACTIVE_ENCUMBRANCE_DOC_TYPES.has(dt) && !isEntryDischarged(e);
  });

  if (activeMortgages.length === 0) return null;

  // Surface one redFlag per active mortgage. Each carries the lender name
  // (party1), document number, and consideration so the buyer's lawyer can
  // ask for the release deed before signing.
  return activeMortgages.map((entry) => {
    const lender = entry.party1 ?? "the lender";
    const docNo = entry.docNo ? ` (doc ${entry.docNo})` : "";
    const consideration = entry.consideration
      ? ` The recorded consideration is ${entry.consideration}.`
      : "";
    return {
      panel: "encumbrance" as const,
      issueLens: "registry_ec" as const,
      evidenceStrength: "document_anchor" as const,
      source: `igr-ec:${entry.docNo ?? entry.docType ?? "entry"}`,
      severity: "redFlag" as const,
      headline: `Active mortgage by ${lender} on this property${docNo}`,
      body: `The Encumbrance Certificate shows an active mortgage by ${lender}${docNo} on this property.${consideration} An unreleased mortgage means the lender can recover the outstanding debt from the property, even after a change in ownership — buying this property would put the buyer's title at risk until the mortgage is fully discharged.`,
      actionItem: `Ask the seller for the original release deed / satisfaction letter from ${lender} for document ${entry.docNo ?? "shown above"}. Confirm the release is registered at the Sub-Registrar office and that a fresh EC shows the charge as "discharged". Do not pay the full sale price until the EC is clean.`,
      ruleId: "ROR-INS-181",
      disclosure: {
        whatWeChecked:
          "Walked all EC entries returned by the IGR EC fetcher for this property. Any entry with docType in {mortgage, charge, hypothecation, hip} that is not accompanied by a release/discharge/satisfaction record was treated as still-active.",
        howToVerify:
          "Request a fresh EC covering at least 30 years from the relevant Sub-Registrar office. Confirm in person with the lender (or check CERSAI) that the charge has been fully satisfied and the release deed is registered.",
        limitsOfThisCheck:
          "An EC older than 6 months may not reflect charges registered after issuance. Charges registered with CERSAI may not appear in the IGR EC. A clean EC does NOT guarantee a clean title — the buyer's lawyer must independently verify chain of title and obtain a release deed for any prior mortgage.",
      },
    } satisfies Insight;
  });
}

// ROR-INS-182 — Non-discharged charge or prior GPA sale.
// Will activate once IGR entries with docType/modeOfTransfer are wired.
// GPA sales (Suraj Lamp issue) are already flagged by POA-001; this rule
// looks for EC-level evidence specifically.
function igrEcGpaOrChargeWatchout(input: RuleInput): Insight[] | null {
  const d = igrEcData(input);
  if (!d || !d.ecAvailable) {
    if ((input as any).ror) {
      return [
        stubFor(
          "ROR-INS-182",
          "encumbrance",
          "registry_ec",
          "parser_uncertain",
          "IGR EC entries were not retrieved, so we cannot check for prior GPA sales or non-discharged charges that appear in the EC.",
          "Ask the seller to produce the EC and look for GPA/sale-deed entries or charges with no satisfaction stamp. A GPA sale does NOT convey title — per Suraj Lamp vs. State of Haryana (1 SCC 656).",
          "EC not retrieved — look for GPA/suraj-lamp issues manually"
        ),
      ];
    }
    return null;
  }
  // TODO: when IGR bridge ships, check for gpa_sale modeOfTransfer or
  // unreleased charge entries.
  return null;
}

// ROR-INS-183 — CERSAI active charge check.
// This is already live (encumbranceRules ROR-INS-103 reads cersai.activeCharge).
// This rule is a stub that fires when CERSAI was not included in the pipeline.
function cersaiMissingStub(input: RuleInput): Insight[] | null {
  const cersai = (input as any).cersai;
  if (cersai) return null; // CERSAI data present — ROR-INS-103 handles it
  if (!(input as any).ror) return null; // No RoR either — very partial report
  return [
    stubFor(
      "ROR-INS-183",
      "encumbrance",
      "registry_ec",
      "parser_uncertain",
      "CERSAI (Central Registry of Securitisation Asset Reconstruction and Security Interest) was not checked for this report. CERSAI records security interests created after 2016 — a charge that was registered there survives even after the EC period.",
      "Search this property on cersai.org.in (search by asset/property) to check for any active security interest before signing.",
      "CERSAI not checked — search cersai.org.in before signing"
    ),
  ];
}

export const igrEcRules: Rule[] = [
  { id: "ROR-INS-181", panel: "encumbrance", fn: igrEcActiveMortgageWatchout, version: v },
  { id: "ROR-INS-182", panel: "encumbrance", fn: igrEcGpaOrChargeWatchout, version: v },
  { id: "ROR-INS-183", panel: "encumbrance", fn: cersaiMissingStub, version: v },
];
