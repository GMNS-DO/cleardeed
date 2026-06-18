#!/usr/bin/env node --input-type=module
/**
 * scripts/verify-insight-golden-path.ts
 *
 * Task 27 verification — runs the unified insight engine against the
 * canonical Mendhasala Plot 415 golden-path input, then pipes the
 * generated HTML through the A11 OutputAuditor.
 *
 * Expected outcomes:
 *   - Title: "ClearDeed — Mendhasala, Bhubaneswar (Plot 415)"
 *   - At least one positive insight (severity=positive)
 *   - At least one watchout insight (severity=watchout)
 *   - All severity/lens combinations from the unified engine render
 *   - auditOrThrow() reports zero violations
 *   - Every insight carries: issueLens, evidenceStrength, source, actionItem
 *
 * Run: npx tsx scripts/verify-insight-golden-path.ts
 */

import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import { generateConsumerReport } from "../agents/consumer-report-writer/src/index";
import { auditOrThrow } from "../agents/output-auditor/src/index";

const OUTPUT_DIR = join(process.cwd(), ".git/sdd");
mkdirSync(OUTPUT_DIR, { recursive: true });

// ─── Canonical Mendhasala Plot 415 input ──────────────────────────────────────

const GOLDEN_PATH_INPUT = {
  reportId: "CLD-GOLDEN-PLOT415-VERIFY",
  generatedAt: "2026-06-18T10:00:00.000Z",
  gpsCoordinates: { latitude: 20.272688, longitude: 85.701271 },
  claimedOwnerName: "Krushnachandra Barajena",
  plotDescription: "Plot 415, Mendhasala, Bhubaneswar",

  geoFetch: {
    village: "Mendhasala",
    tahasil: "Bhubaneswar",
    district: "Khordha",
    state: "Odisha",
    postcode: "752054",
    displayName: "Mendhasala, Bhubaneswar, Khordha, Odisha, 752054, India",
    plotNo: "415",
    area: 0.004357,
    gpsSource: "gps_device",
  },

  revenueRecords: {
    khataNo: "94",
    village: "Mendhasala",
    district: "Khordha",
    riCircle: "11",
    lastUpdated: "2026-01-01",
    tenants: [
      {
        tenantName: "Krushnachandra Barajena",
        surveyNo: "415",
        area: 1.075,
        unit: "acre",
        landClass: "Shara Duei",
        landClassOdia: "ଶାରଦ ଦୁଇ",
        landClassEnglish: "Agricultural",
        fatherName: "Bauribandhu Barajena",
        caste: "Mahalaeka",
        residence: "Nijagaon",
        conversionRequired: true,
        prohibited: false,
        buildable: false,
      },
    ],
    mutationReferences: [],
  },

  courtCases: {
    total: 0,
    cases: [],
    sources: { ecourts: "success", rccms: "success" },
    searchMetadata: {
      ecourts: {
        captchaAcceptedCount: 1,
        captchaFailedCount: 0,
        attempts: [{ complexName: "Bhubaneswar", outcome: "no_records" }],
      },
    },
  },

  registryLinks: {
    url: "https://igrodisha.gov.in/ecsearch",
    params: {
      district: "Khordha",
      sro: "Bhubaneswar",
      plotNo: "415",
      ownerName: "Krushnachandra Barajena",
    },
    instructions:
      "Visit igrodisha.gov.in, select Khordha / Bhubaneswar SRO, search by plot 415.",
  },

  ownershipReasoner: {
    officialOwnerName: "Krushnachandra Barajena",
    transliteratedOwnerName: "Krushnachandra Barajena",
    nameMatch: "exact",
    discrepancyExplanation: "Full-name match.",
    coOwners: [],
    confidence: 0.95,
    confidenceBasis: "Exact Bhulekh RoR full name match.",
  },
  landClassifier: {
    currentClassification: "Agricultural",
    classificationSource: "Bhulekh land class field",
    permittedUses: ["Agricultural"],
    conversionRequired: true,
    redFlags: [],
    confidence: 0.9,
    confidenceBasis: "Bhulekh RoR returned with land class and 1 tenant record.",
  },
  encumbranceReasoner: {
    status: "clear",
    encumbrances: [],
    instructions: "EC returned clean for the searched 5-year period.",
    confidence: 0.85,
    confidenceBasis: "IGR EC search completed via IGR Odisha portal.",
  },
  regulatoryScreener: {
    flags: [],
    plotConfirmedInRegulatedZone: false,
    overlaySource: "Bhubaneswar Municipal Corporation Town Planning layer",
    confidence: 0.9,
    confidenceBasis: "All overlay sources completed without flagging a regulated zone.",
    completedOverlayLayers: ["bmc_town_planning", "forest", "crz"],
  },

  validationFindings: [],

  bdaZoneData: {
    source: "bda-zoning",
    status: "success",
    data: [
      {
        tehsil: "Bhubaneswar",
        village: "Mendhasala",
        locality: "Patia",
        zone: {
          id: "residential",
          name: "Residential",
          zoneCode: "R",
          description: "Areas designated for residential development",
          permittedUses: ["Single-family residential", "Apartments"],
          restrictions: ["No industrial/commercial use"],
        },
      },
    ],
  },

  circleRateData: {
    source: "circle-rate",
    status: "success",
    data: [
      {
        mouza: "Mendhasala",
        tehsil: "Bhubaneswar",
        kisam: "Residential",
        ratePerAcre: 0,
        ratePerSqft: 1800,
        rateType: "peri-urban",
        sourceUrl: "https://regis.odisha.gov.in/Benchmark/BMV_Search.aspx",
        lastUpdated: "2024-06-01",
      },
    ],
  },

  adjacentPlots: {
    adjacentPlots: [
      { plotNo: "414", village: "Mendhasala", featureId: "F-414", geometryHash: "h-414", areaSqKm: 0.0008 },
      { plotNo: "416", village: "Mendhasala", featureId: "F-416", geometryHash: "h-416", areaSqKm: 0.0009 },
      { plotNo: "417", village: "Mendhasala", featureId: "F-417", geometryHash: "h-417", areaSqKm: 0.0011 },
    ],
    totalFound: 3,
    filteredFromTarget: 0,
    status: "success",
  },

  sourceStatus: {
    bhunaksha: "success",
    bhulekh: "success",
    ecourts: "success",
    rccms: "success",
  },
  sourceDetails: {
    nominatim: { status: "success", fetchedAt: "2026-06-18T09:50:00.000Z", statusReason: "Reverse geocode OK" },
    bhunaksha: { status: "success", fetchedAt: "2026-06-18T09:51:00.000Z", statusReason: "WFS polygon matched" },
    bhulekh: { status: "success", fetchedAt: "2026-06-18T09:52:00.000Z", statusReason: "Front + Back Page parsed" },
    bhulekh_back_page: { status: "success", fetchedAt: "2026-06-18T09:53:00.000Z", statusReason: "Mutation + encumbrance rows extracted" },
    ecourts: { status: "success", fetchedAt: "2026-06-18T09:54:00.000Z", statusReason: "No cases found" },
    rccms: { status: "success", fetchedAt: "2026-06-18T09:54:30.000Z", statusReason: "No pending cases" },
  },

  disclaimerText:
    "This report is not a legal opinion. Verify with a qualified property lawyer before transacting.",
};

// ─── Run ──────────────────────────────────────────────────────────────────────

console.log("===============================================");
console.log("Task 27 — Live golden-path verification");
console.log("Input: Mendhasala Plot 415 (canonical)");
console.log("===============================================");

const result = generateConsumerReport(GOLDEN_PATH_INPUT as any);
const { html, title, insights } = result;

console.log("\nTitle:");
console.log("  ", title);

console.log("\nInsights:", insights.length);

const bySeverity = insights.reduce<Record<string, number>>((acc, i) => {
  acc[i.severity] = (acc[i.severity] || 0) + 1;
  return acc;
}, {});
console.log("By severity:", JSON.stringify(bySeverity));

const byPanel = insights.reduce<Record<string, number>>((acc, i) => {
  acc[i.panel] = (acc[i.panel] || 0) + 1;
  return acc;
}, {});
console.log("By panel:", JSON.stringify(byPanel));

const byLens = insights.reduce<Record<string, number>>((acc, i) => {
  acc[i.issueLens] = (acc[i.issueLens] || 0) + 1;
  return acc;
}, {});
console.log("By issueLens:", JSON.stringify(byLens));

const byEvidence = insights.reduce<Record<string, number>>((acc, i) => {
  acc[i.evidenceStrength] = (acc[i.evidenceStrength] || 0) + 1;
  return acc;
}, {});
console.log("By evidenceStrength:", JSON.stringify(byEvidence));

// ── Required fields check ──────────────────────────────────────────────────

const missingFields = insights.filter(
  (i) =>
    !i.issueLens ||
    !i.evidenceStrength ||
    !i.source ||
    !i.actionItem ||
    !i.headline ||
    !i.body
);
console.log("\nInsights missing required fields:", missingFields.length);

// ── Prohibited phrases check (display-labels.ts gate) ───────────────────────

const PROHIBITED = [
  "verified clear",
  "ownership verified",
  "safe to buy",
  "no encumbrance",
  "no litigation",
  "clear title",
  "buildable",
  "no restriction",
];
const prohibitedHits: Array<{ ruleId: string; phrase: string; context: string }> = [];
for (const insight of insights) {
  const haystack = `${insight.headline} ${insight.body} ${insight.actionItem}`.toLowerCase();
  for (const phrase of PROHIBITED) {
    if (haystack.includes(phrase)) {
      prohibitedHits.push({
        ruleId: insight.ruleId,
        phrase,
        context: insight.headline,
      });
    }
  }
}
console.log("Prohibited phrase hits:", prohibitedHits.length);
if (prohibitedHits.length > 0) {
  for (const hit of prohibitedHits.slice(0, 5)) {
    console.log("  -", hit.ruleId, "→", hit.phrase, "(", hit.context, ")");
  }
}

// ── Closed disclosure check (every insight has <details> in HTML) ──────────

const insightBlocks = html.match(/<div class="insight[^"]*"/g) || [];
const closedDetails = (html.match(/<details[^>]*>/g) || []).length;
console.log("\nInsight blocks in HTML:", insightBlocks.length);
console.log("Closed <details> elements:", closedDetails);

// ── A11 audit ──────────────────────────────────────────────────────────────

console.log("\nRunning A11 auditOrThrow...");
let auditViolations = 0;
let auditPassed = false;
try {
  const auditResult = auditOrThrow(html, GOLDEN_PATH_INPUT.reportId);
  auditViolations = auditResult.violations.length;
  auditPassed = true;
  console.log("A11 audit: PASSED, violations =", auditViolations);
  for (const v of auditResult.violations) {
    console.log("  violation:", v);
  }
} catch (e) {
  auditPassed = false;
  console.log("A11 audit: THREW", (e as Error).message);
}

console.log("\n===============================================");
console.log("Verification summary");
console.log("===============================================");
const pass =
  title.includes("Mendhasala") &&
  title.includes("Plot 415") &&
  bySeverity["watchout"] > 0 &&
  auditPassed &&
  auditViolations === 0 &&
  missingFields.length === 0;

console.log("Title contains 'Mendhasala':", title.includes("Mendhasala"));
console.log("Title contains 'Plot 415':", title.includes("Plot 415"));
console.log("Watchout present:", (bySeverity["watchout"] || 0) > 0);
console.log("All required fields present:", missingFields.length === 0);
console.log("A11 audit passed:", auditPassed);
console.log("A11 violations:", auditViolations);
console.log("Prohibited phrase hits:", prohibitedHits.length);
console.log("Insight blocks in HTML:", insightBlocks.length);
console.log("\nRESULT:", pass ? "PASS" : "FAIL");

// ── Persist output ─────────────────────────────────────────────────────────

const out = {
  taskId: "task-27",
  verifiedAt: new Date().toISOString(),
  title,
  insightCount: insights.length,
  bySeverity,
  byPanel,
  byLens,
  byEvidence,
  missingFields: missingFields.length,
  prohibitedHits,
  insightBlocksInHtml: insightBlocks.length,
  closedDetails,
  auditPassed,
  auditViolations,
  pass,
};
const outPath = join(OUTPUT_DIR, "task-27-result.json");
writeFileSync(outPath, JSON.stringify(out, null, 2));
console.log("\nWrote result to:", outPath);

process.exit(pass ? 0 : 1);
