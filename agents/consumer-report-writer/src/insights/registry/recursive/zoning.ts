// agents/consumer-report-writer/src/insights/registry/recursive/zoning.ts
//
// ROR-INS-153 fires a redFlag when the plot falls within BDA's
// Industrial or Industrial-2 zone in the Master Plan. Per CLAUDE.md
// Section 8.1 (Pattern 4: Industrial-Zone Plot Sold as Residential),
// the severity is redFlag because the buyer may be unable to build
// a residential use on land that is zoned for industrial use.
//
// ROR-INS-152 (BDA layout approval sub-plot detector) lives in
// ./bhulekh/bda-layout.ts.

import type { Insight, Rule, RuleInput } from "../../schema";
import { liveDataPresent, stubFor } from "../_shared";

const v = "1.0.0";

type ZoneRuleInput = {
  bdaZoneData?: {
    source?: string;
    status?: string;
    data?: Array<{
      tehsil?: string;
      village?: string;
      locality?: string;
      zone?: { id?: string; name?: string; description?: string; zoneCode?: string };
    }>;
    warnings?: Array<{ code?: string; message?: string }>;
  } | null;
  ror?: { status?: string };
};

const INDUSTRIAL_ZONE_IDS = new Set(["industrial", "industrial_2"]);

/**
 * ROR-INS-153 — BDA Industrial Zone redFlag.
 *
 * Fires redFlag when the BDA zone data is available (status === "ok")
 * and the matched zone id is "industrial" or "industrial_2".
 * A "not covered" watchout fires when BDA zone lookup returned no data
 * for this plot's village/tehsil.
 */
function bdaZoneCheck(input: RuleInput): Insight[] | null {
  const i = input as unknown as ZoneRuleInput;

  // HIGH #4: when ror is absent (empty input / demo) the real detector
  // cannot fire. Surface a parser_uncertain stub so the rule is registered
  // and visible in the report, but keep noise low.
  if (!liveDataPresent(input as RuleInput, "ror")) {
    return [
      stubFor(
        "ROR-INS-153",
        "land",
        "land_use_permission",
        "parser_uncertain",
        "BDA Master Plan zone lookup is not yet wired — the rule fires only when ror.status is verified AND bdaZoneData is present. Will activate fully once the BDA zone fetcher ships.",
        "Cross-reference the plot's village and tehsil against the BDA Master Plan at bda.gov.in to confirm the applicable land-use zone.",
        "BDA Master Plan zone lookup is not yet wired — verify manually"
      ),
    ];
  }

  // Require RoR status to be verified before surfacing any BDA findings.
  if (i.ror?.status !== "verified") return null;

  const bda = i.bdaZoneData;

  // No BDA data at all — outside BDA Master Plan jurisdiction or lookup failed.
  if (!bda) {
    return [
      {
        panel: "land",
        issueLens: "land_use_permission",
        evidenceStrength: "missing_source",
        source: "bda-zoning",
        severity: "watchout",
        headline: "Plot is outside BDA Master Plan jurisdiction",
        body: "The plot's village or tehsil is not covered by the BDA Master Plan zoning lookup. Zoning restrictions, setback rules, and land-use permissions cannot be verified automatically for this area.",
        actionItem:
          "Ask the local tehsil or consult the Bhubaneswar Planning Authority (BDA) directly to confirm the applicable land-use zone for this plot.",
        ruleId: "ROR-INS-153",
      },
    ];
  }

  // BDA data exists — check for industrial zone.
  const zoneRows = bda.data ?? [];
  if (zoneRows.length === 0) {
    return [
      {
        panel: "land",
        issueLens: "land_use_permission",
        evidenceStrength: "missing_source",
        source: "bda-zoning",
        severity: "watchout",
        headline: "BDA zone not classified for this village",
        body: "The plot's village was checked against the BDA Master Plan but no zone classification was found. This may mean the village is outside BDA jurisdiction, or the Master Plan has not yet been updated for this area.",
        actionItem:
          "Verify the plot's BDA Master Plan zone manually at bda.gov.in or via the Bhubaneswar Planning Authority town planning office.",
        ruleId: "ROR-INS-153",
      },
    ];
  }

  const industrialRows = zoneRows.filter((row) =>
    row.zone ? INDUSTRIAL_ZONE_IDS.has(row.zone.id ?? "") : false
  );

  if (industrialRows.length === 0) {
    // Zone is classified but not industrial — no issue.
    return null;
  }

  const row = industrialRows[0];
  const zoneId = row.zone?.id ?? "industrial";
  const zoneName = row.zone?.name ?? "Industrial Zone";
  const village = row.village ?? "the plot's village";

  return [
    {
      panel: "land",
      issueLens: "land_use_permission",
      evidenceStrength: "document_anchor",
      source: "bda-zoning",
      severity: "redFlag",
      headline: `Plot is in BDA ${zoneName} — residential use may not be permitted`,
      body: `The BDA Master Plan classifies ${village} as "${zoneName}" (zone code: ${zoneId}). This zone typically does not permit residential construction. If the seller is marketing this plot as residential land or for house construction, this is a material mismatch with the approved land use.`,
      actionItem:
        "Do not pay any advance. Ask the seller for proof that the plot has a change-of-land-use (CLU) approval from BDA, or that the intended use is compatible with the industrial zone designation. Without CLU, building permission from BDA will be refused.",
      ruleId: "ROR-INS-153",
      disclosure: {
        whatWeChecked:
          "Cross-referenced the plot's village and tehsil against the BDA Master Plan zone classification. Zones \"industrial\" and \"industrial_2\" were flagged as potentially incompatible with residential use.",
        howToVerify:
          "Verify the BDA Master Plan zone at bda.gov.in or at the Bhubaneswar Planning Authority counter. Confirm whether the plot has a valid CLU (change-of-land-use) order if residential use is intended.",
        limitsOfThisCheck:
          "The BDA zone classification is based on the latest available Master Plan. Some plots within an industrial zone may have grandfathered residential rights, and some industrial zones permit mixed-use development. The BDA and a qualified advocate must confirm the applicable permissions for this specific plot.",
      },
    },
  ];
}

export const zoningRules: Rule[] = [
  { id: "ROR-INS-153", panel: "land", fn: bdaZoneCheck, version: v },
];
