"use client";

import { PropertyHeader } from "./components/PropertyHeader";
import { OwnerSection } from "./components/OwnerSection";
import { LandClassCard } from "./components/LandClassCard";
import { PlotMap } from "./components/PlotMap";
import { VerdictCard } from "./components/VerdictCard";
import { QuestionTile } from "./components/QuestionTile";
import { QuestionPanel } from "./components/QuestionPanel";
import { FinancialExposureSummary } from "./components/FinancialExposureSummary";
import { ExposureStrip } from "./components/ExposureStrip";
import { useState } from "react";

// ---------------------------------------------------------------------------
// Mock data — realistic for a Khordha property (T5 baseline, unchanged)
// ---------------------------------------------------------------------------

const MOCK_HEADER = {
  village: "Gothapada",
  tahasil: "Kakatpur",
  district: "Khordha",
  plotNo: "415",
  areaAcres: 10.5,
  areaDecimal: 750,
  gpsLat: 20.272688,
  gpsLon: 85.701271,
  sourceStatus: {
    bhulekh: "success" as const,
    bhunaksha: "partial" as const,
    nominatim: "success" as const,
  },
};

const MOCK_OWNER = {
  primaryOwner: {
    odia: "ରଖିତ ଅନାବାଦୀ",
    latin: "Rakhit Anabadi",
    guardianOdia: "ବାଉରିବନ୍ଧୁ",
    guardianLatin: "Bauribandhu",
    casteOdia: "ମହାଲାଏକ",
    residenceOdia: "ନିଜଗାଁ",
  } as const,
  coOwners: [] as Array<{ latin: string; odia: string }>,
  nameMatch: {
    state: "no_claimed_name" as const,
    claimedName: null,
    officialName: "Rakhit Anabadi",
    confidence: 0,
    explanation:
      "No seller name was provided in the report request. The official RoR owner is shown above.",
  },
};

const MOCK_LAND_CLASS = {
  odia: "ଦଣ୍ଡା",
  english: "Irrigated single-crop agricultural land",
  conversionRequired: true as const,
  restrictions: [
    {
      flag: "CLU_REQUIRED" as const,
      severity: "watchout" as const,
      description:
        "Construction on this land requires a Conversion of Land Use (CLU) certificate from the Odisha government.",
      recommendedAction:
        "Apply for CLU at the District Collector office before any construction plan.",
    },
    {
      flag: "AGRICULTURAL_LAND_TAX" as const,
      severity: "info" as const,
      description:
        "Agricultural land is taxed at a lower rate. Converting to residential/commercial attracts higher stamp duty and registration fees.",
      recommendedAction:
        "Factor conversion fees (est. ₹1–3 L/acre) into your total cost.",
    },
  ],
};

const MOCK_PLOT_MAP = {
  villageName: "Gothapada (ଗୋଠପଟଣା)",
  plotNo: "415",
  fallbackCenter: {
    lat: 20.272688,
    lon: 85.701271,
  },
  plotDiagramUrl: undefined as string | undefined,
};

const MOCK_FINANCIAL = {
  verifiedClearExposure: 0,
  verifiedClearCategories: ["Court cases", "CERSAI charges"],
  atRiskExposure: 450000,
  atRiskCategories: [
    "Sub-plot without BDA approval — full property value at risk",
    "CLU conversion fee — est. ₹1–3 L/acre (10.5 ac = ₹2.1–3.15 L)",
  ],
  unquantifiedItems: [
    "Mutation status and timeline",
    "BDA layout approval verification",
    "Property tax arrears",
    "IGR benchmark valuation (manual check required)",
  ],
};

interface MockQuestionDetail {
  severity: "positive" | "watchout" | "redFlag";
  headline: string;
  body: string;
  actionItem?: string;
  ruleId: string;
}

interface MockQuestion {
  id: string;
  title: string;
  summary: string;
  tally: { critical: number; watchout: number; positive: number; total: number };
  detail: MockQuestionDetail;
}

const MOCK_QUESTIONS: MockQuestion[] = [
  {
    id: "Q1",
    title: "Does the seller actually own this?",
    summary:
      "RoR owner is Rakhit Anabadi. No seller name was provided for comparison. PoA check requires IGR-EC verification.",
    tally: { critical: 0, watchout: 1, positive: 1, total: 2 },
    detail: {
      severity: "positive",
      headline: "Seller's claimed name matches the RoR owner record",
      body:
        "Plot 415 is registered under Khata 830 in Gothapada mouza, Kakatpur tahasil. Area matches Bhunaksha polygon within 5% tolerance. The owner's residence is listed as ନିଜଗାଁ (own village), consistent with the plot location.",
      actionItem: undefined,
      ruleId: "ROR-INS-040",
    },
  },
  {
    id: "Q2",
    title: "Can I build my house here?",
    summary:
      "Land is classified as irrigated agricultural. CLU conversion required before construction. BDA zoning check pending.",
    tally: { critical: 0, watchout: 2, positive: 0, total: 2 },
    detail: {
      severity: "watchout",
      headline: "Agricultural land — CLU conversion required",
      body:
        "The RoR kisam is ଦଣ୍ଡା (irrigated single-crop). Residential construction is not permitted without a Conversion of Land Use certificate from the District Collector. No BDA Master Plan zoning overlay is available for this village in V1.",
      actionItem:
        "Apply for CLU at the District Collector office before any construction plan. Conversion fee est. ₹1–3 L/acre.",
      ruleId: "ROR-INS-077",
    },
  },
  {
    id: "Q3",
    title: "Could I lose it after paying?",
    summary:
      "No court cases found in eCourts (partial confidence). RCCMS not automated — manual verification recommended. No CERSAI charges detected.",
    tally: { critical: 0, watchout: 1, positive: 1, total: 2 },
    detail: {
      severity: "positive",
      headline: "No active court attachments, mortgages, or CERSAI charges found",
      body:
        "eCourts party-name search for 'Rakhit Anabadi' in Khurda district returned 0 active cases (partial confidence — captcha-solved but zero-case result only). No CERSAI charges detected. RCCMS ccms.nic.in is structurally unbuildable; manual verification at the local revenue office is recommended.",
      actionItem:
        "Manually verify Khata 830 at the local revenue office and confirm Khurda SRO has no registered encumbrance.",
      ruleId: "ROR-INS-100",
    },
  },
  {
    id: "Q4",
    title: "Am I overpaying?",
    summary:
      "Circle-rate benchmark for Kakatpur mouza available via IGR portal. No Propstack comparable sales in V1. Manual price verification recommended.",
    tally: { critical: 0, watchout: 0, positive: 0, total: 0 },
    detail: {
      severity: "watchout",
      headline: "Price benchmark requires manual verification",
      body:
        "ClearDeed does not auto-populate Propstack or other comparable-sales data in V1. The IGR Odisha circle-rate portal is accessible at igrodisha.gov.in/viewfeevalue.aspx. Rural Kakatpur rates are typically 30–60% below urban Khordha.",
      actionItem:
        "Pull the Kakatpur circle rate for Gothapada mouza and compare against the seller's asking price.",
      ruleId: "ROR-INS-040",
    },
  },
  {
    id: "Q5",
    title: "Is the area going to develop or decay?",
    summary:
      "Kakatpur is a rural tahasil. No BDA Master Plan overlay detected. No LARR acquisition notifications on record. No metro corridor within 5 km.",
    tally: { critical: 0, watchout: 0, positive: 0, total: 0 },
    detail: {
      severity: "info",
      headline: "Rural tahasil — no planned infrastructure overlays detected",
      body:
        "Kakatpur is 45 km southwest of Bhubaneswar. No BDA Master Plan zoning applies outside municipal limits. No LARR S.11 notifications on record for Gothapada mouza. The Khordha outer-ring road is ~12 km away. No metro corridor within 5 km.",
      actionItem:
        "Check bda.gov.in for any upcoming master-plan extensions and the PWD website for the outer-ring-road timeline.",
      ruleId: "ROR-INS-040",
    },
  },
  {
    id: "Q6",
    title: "What happens after I buy?",
    summary:
      "Mutation cost: ~₹50K–1L admin. Property tax: payable to Kakatpur NAC. No BMC/TPCODL/PHED dues check in V1 — verify manually.",
    tally: { critical: 0, watchout: 1, positive: 0, total: 1 },
    detail: {
      severity: "watchout",
      headline: "Post-purchase costs require manual verification",
      body:
        "Mutation at the tahasil office typically takes 30–90 days and costs ~₹50K–1L (stamp duty on mutation deed + advocate fees). Property tax is payable to the Kakatpur NAC office. Water and electricity dues are verified at TPCODL/PHED counters. Mutation timing is the largest source of post-buy risk.",
      actionItem:
        "Confirm mutation timeline with the local tahasil, pull a current property-tax challan, and request a no-dues certificate from TPCODL.",
      ruleId: "ROR-INS-040",
    },
  },
];

const MOCK_INSIGHTS = [
  {
    severity: "positive" as const,
    headline: "Plot confirmed in Bhulekh RoR",
    body:
      "Plot 415 is registered under Khata 830 in Gothapada mouza, Kakatpur tahasil. Area matches Bhunaksha polygon within 5% tolerance.",
    actionItem: undefined,
    ruleId: "ROR-INS-040",
  },
  {
    severity: "watchout" as const,
    headline: "Agricultural land — CLU conversion required",
    body:
      "The RoR kisam is ଦଣ୍ଡା (irrigated single-crop). Residential construction is not permitted without a Conversion of Land Use certificate from the District Collector.",
    actionItem: "Apply for CLU before finalising the purchase. Conversion fee est. ₹1–3 L/acre.",
    ruleId: "ROR-INS-077",
  },
  {
    severity: "watchout" as const,
    headline: "Owner residence is in the same village",
    body:
      "The recorded owner's residence is listed as ନିଜଗାଁ (own home/village), which is consistent with the plot location. No GPS distance signal available.",
    actionItem: undefined,
    ruleId: "ROR-INS-026",
  },
  {
    severity: "positive" as const,
    headline: "No active court cases found",
    body:
      "eCourts party-name search for 'Rakhit Anabadi' in Khurda district returned 0 active cases. Result confidence: partial (captcha-verified, double-fetch confirmed).",
    actionItem: undefined,
    ruleId: "ROR-INS-100",
  },
  {
    severity: "redFlag" as const,
    headline: "Sub-plot indicator detected — verify BDA layout approval",
    body:
      "Plot number 415 contains a sub-plot suffix. Sub-divided plots sold without BDA layout approval carry full property-value risk if BDA challenges the subdivision.",
    actionItem: "Request BDA layout approval document from seller. Check bda.gov.in for layout approval status.",
    ruleId: "ROR-INS-152",
  },
  {
    severity: "watchout" as const,
    headline: "RCCMS revenue-case check not automated",
    body:
      "Revenue court case lookup (ccms.nic.in) is not yet automated. The portal does not expose plot/khata/village columns in its result schema.",
    actionItem:
      "Manually query ccms.nic.in with Hal Khata No. 830 at the local revenue office.",
    ruleId: "ROR-INS-200",
  },
];

// ---------------------------------------------------------------------------
// BuyerLayer — Q1–Q6 composed with QuestionPanel + collapse/expand
// ---------------------------------------------------------------------------

export default function BuyerLayer() {
  // Which Q tile is currently expanded. None by default; clicking expands,
  // clicking the same tile again collapses (toggle).
  const [expandedQuestion, setExpandedQuestion] = useState<string | null>(null);

  const toggle = (id: string) =>
    setExpandedQuestion((cur) => (cur === id ? null : id));

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#f7f7f2",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <div style={{ maxWidth: "768px", margin: "0 auto", padding: "24px 16px" }}>
        {/* 1. Property header */}
        <PropertyHeader {...MOCK_HEADER} />

        {/* ── Q1 — Ownership (QuestionPanel with OwnerSection + PlotMap) ── */}
        <QuestionPanel
          id="Q1"
          question="Does the seller actually own this plot?"
          verdict="clear"
          verdictHeadline="Seller's claimed name matches the RoR owner record"
          sourceSummary="Bhulekh RoR + Nominatim cross-check"
          lastUpdated={new Date().toISOString().slice(0, 10)}
        >
          <OwnerSection {...MOCK_OWNER} />
          <section style={{ marginTop: 16 }}>
            <PlotMap
              {...MOCK_PLOT_MAP}
              plotDiagramUrl={MOCK_PLOT_MAP.plotDiagramUrl}
            />
          </section>
          <section style={{ marginTop: 16 }}>
            <ExposureStrip
              exposure={{
                amountINR: 0,
                categories: ["Court cases", "CERSAI charges"],
                severity: "info",
                summaryLine:
                  "No quantified at-risk exposure on Q1 signals. Continue with transaction.",
              }}
            />
          </section>
        </QuestionPanel>

        {/* ── Q2–Q6 — QuestionTile with collapse/expand + VerdictCard detail ── */}
        {MOCK_QUESTIONS.slice(1).map((q) => (
          <section key={q.id} style={{ marginTop: 12 }}>
            <QuestionTile
              id={q.id}
              title={q.title}
              summary={q.summary}
              tally={q.tally}
              expanded={expandedQuestion === q.id}
              onToggle={() => toggle(q.id)}
            >
              <VerdictCard
                severity={q.detail.severity}
                headline={q.detail.headline}
                body={q.detail.body}
                actionItem={q.detail.actionItem}
                ruleId={q.detail.ruleId}
              />
              {q.id === "Q2" ? (
                <section style={{ marginTop: 12 }}>
                  <ExposureStrip
                    exposure={{
                      amountINR: 300000,
                      categories: ["CLU conversion fee (est. ₹1–3 L/acre)"],
                      severity: "watchout",
                      summaryLine:
                        "Estimated conversion fee: ₹1–3 L/acre × 10.5 acres = ₹1.05–3.15 L.",
                    }}
                  />
                </section>
              ) : null}
            </QuestionTile>
          </section>
        ))}

        {/* ── Financial Exposure Summary ────────────────────────────── */}
        <section style={{ marginTop: 32 }}>
          <FinancialExposureSummary {...MOCK_FINANCIAL} />
        </section>

        {/* ── Insights / verdicts ───────────────────────────────────── */}
        <section style={{ marginTop: 32 }}>
          <h2
            className="text-xs uppercase tracking-wider text-[#5b665f] mb-3"
            style={{ fontFamily: "system-ui, sans-serif" }}
          >
            Insights
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {MOCK_INSIGHTS.map((insight) => (
              <VerdictCard
                key={insight.ruleId}
                severity={insight.severity}
                headline={insight.headline}
                body={insight.body}
                actionItem={insight.actionItem}
                ruleId={insight.ruleId}
              />
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}