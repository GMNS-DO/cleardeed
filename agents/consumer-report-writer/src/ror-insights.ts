import type { RiskInsight, RiskInsightInput, RiskDimension, RiskSeverity } from "./types";
export type { RiskDimension, RiskSeverity };
export type { RiskInsight };
export type RoRInsightTone = "positive" | "watchout";

// ---------------------------------------------------------------------------
// Source labels
// ---------------------------------------------------------------------------
const SRC_FRONT = "Bhulekh RoR Front Page";
const SRC_PLOT  = "Bhulekh RoR plot table";
const SRC_OWNER = "Bhulekh RoR owner block";
const SRC_DUES  = "Bhulekh RoR dues fields";
const SRC_BACK  = "Bhulekh RoR Back Page";
const SRC_REG   = "Bhulekh RoR remarks";

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

export type InsightGroups = Record<string, RiskInsight[]>;

export function buildRiskInsights(input: RiskInsightInput): InsightGroups {
  return {
    transferability: buildTransferabilityInsights(input),
    title:           buildTitleInsights(input),
    financial:       buildFinancialInsights(input),
    positive:        buildPositiveInsights(input),
    redFlag:         buildRedFlagInsights(input),
  };
}

export function selectTopInsights(insights: RiskInsight[], max = 4): RiskInsight[] {
  const SEVERITY_ORDER: Record<RiskSeverity, number> = {
    redFlag: 0,
    watchout: 1,
    positive: 2,
  };
  return [...insights]
    .sort((a, b) => {
      const sevDiff = SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity];
      if (sevDiff !== 0) return sevDiff;
      return a.priority - b.priority;
    })
    .slice(0, max);
}

// ---------------------------------------------------------------------------
// DIMENSION 1 — TRANSFERABILITY
// ---------------------------------------------------------------------------

function buildTransferabilityInsights(input: RiskInsightInput): RiskInsight[] {
  const insights: RiskInsight[] = [];
  const owners = input.ownerRecords ?? [];
  const land   = input.landClass ?? {};
  const norm   = normalize(land.rawKisam, land.displayKisam, land.standardizedKisam);

  if (!input.bhulekhUsable) {
    insights.push(make("transferability", "watchout", "RoR not available — manual verification required",
      "Bhulekh RoR could not be fetched in this run. Before any transaction, obtain the current Khatiyan and verify ownership, land class, and any restrictions with the Tehsildar.",
      SRC_FRONT, 50));
    return insights;
  }

  // Government ownership
  const hasGovtOwner = owners.some(o => isGovtOwner(o.odia ?? o.latin ?? ""));
  if (hasGovtOwner) {
    insights.push(make("transferability", "redFlag", "Government-owned land",
      "The recorded owner is a government department. Government-owned land cannot be transferred through a private sale without prior government regularization. Do not proceed without verified government consent and a regularization order.",
      SRC_OWNER, 1));
  }

  // Government land classification (Neyanjori, Gair Khalsa, etc.)
  if (norm.includes("neyanjori") || norm.includes("neya_niyogita") ||
      norm.includes("khalsa") || norm.includes("govt_notified")) {
    insights.push(make("transferability", "redFlag", "Government notified land",
      "This land is classified as government notified (Neyanjori / Gair Khalsa). Construction and private sale are prohibited without state government approval. Check for ongoing regularization schemes with the Revenue Department.",
      SRC_PLOT, 1));
  }

  // Pond / Jalasaya
  if (norm.includes("jalasaya") || norm.includes("pond") || norm.includes("jalkar")) {
    insights.push(make("transferability", "redFlag", "Water body — cannot be sold or built upon",
      "The land is classified as Jalasaya (pond / water body). Wetland cannot be converted to private non-agricultural use without central government approval under the Wetland Rules, 2017. A private sale of a pond for construction is not legally valid.",
      SRC_PLOT, 1));
  }

  // Forest / Jungle
  if (norm.includes("jungle") || norm.includes("banjara") || norm.includes("forest")) {
    insights.push(make("transferability", "redFlag", "Forest land — conversion prohibited",
      "This land is classified as forest / jungle. Conversion requires central government approval under the Forest Conservation Act, 1980. A private sale of forest land is void. Verify with the Forest Department before any action.",
      SRC_PLOT, 1));
  }

  // Gochar (grazing common)
  if (norm.includes("gochar")) {
    insights.push(make("transferability", "redFlag", "Grazing land — community land not saleable",
      "This land is Gochar — common grazing land held for community use. Grazing land cannot be converted to private non-agricultural use without government approval. A private sale of Gochar land is not legally valid.",
      SRC_PLOT, 1));
  }

  // Nadi (river / waterway)
  if (norm.includes("nadi")) {
    insights.push(make("transferability", "redFlag", "River / waterway — government property",
      "This plot is classified as Nadi (river or waterway). Riverbed land belongs to the government. Construction is prohibited. Verify with the Revenue Department whether this plot has been officially registered.",
      SRC_PLOT, 1));
  }

  // Smasana (cremation / burial ground)
  if (norm.includes("smasana") || norm.includes("cremation") || norm.includes("burial")) {
    insights.push(make("transferability", "redFlag", "Cremation / burial ground — community land not saleable",
      "This land is a Smasana (cremation or burial ground). Such community land cannot be commercially sold or built upon. Confirm with the Gram Panchayat and Tehsildar before taking any action.",
      SRC_PLOT, 1));
  }

  // Double-crop irrigated
  if (norm.includes("do-fasali") || norm.includes("double_crop") || norm.includes("irrigated_two")) {
    insights.push(make("transferability", "redFlag", "Double-crop irrigated land — conversion extremely difficult",
      "This land is double-crop irrigated agricultural land under food security protection. Conversion to non-agricultural use requires state-level approval and is extremely difficult. Budget 2–3 years if conversion is possible at all.",
      SRC_PLOT, 2));
  }

  // Agricultural (Sarad, single/double fallow, etc.)
  if (norm.includes("agricultur") || norm.includes("sarad") || norm.includes("fallow") ||
      norm.includes("nigar") || norm.includes("garden")) {
    insights.push(make("transferability", "watchout", "Agricultural land — CLU required for non-farm use",
      "This land is classified as agricultural on the official record. If you intend to build or use it for residential or commercial purposes, you need a Change of Land Use (CLU) certificate from the Tehsildar. Budget 6–18 months and ₹30,000–3,00,000 per acre in fees.",
      SRC_PLOT, 2));
  }

  // Homestead / residential / commercial — no conversion needed
  if ((norm.includes("homestead") || norm.includes("gharabari") || norm.includes("byabasaika") ||
       norm.includes("unnayana") || norm.includes("buildable") || norm.includes("residential")) &&
      land.prohibited !== true && land.conversionRequired !== true) {
    insights.push(make("transferability", "positive", "Buildable land — no land-use conversion needed",
      "This land is classified for residential or commercial use on the Bhulekh record. No CLU certificate is required for construction, subject to building permission from the local authority.",
      SRC_PLOT, 3));
  }

  return insights;
}

// ---------------------------------------------------------------------------
// DIMENSION 2 — TITLE
// ---------------------------------------------------------------------------

function buildTitleInsights(input: RiskInsightInput): RiskInsight[] {
  const insights: RiskInsight[] = [];
  const owners = input.ownerRecords ?? [];
  const back   = input.backPage ?? {};
  const mutations = Array.isArray(back.mutationHistory) ? back.mutationHistory : [];
  const remarks   = Array.isArray(back.backPageRemarks)  ? back.backPageRemarks  : [];
  const encumbrances = Array.isArray(back.encumbranceEntries) ? back.encumbranceEntries : [];

  if (!input.bhulekhUsable) {
    insights.push(make("title", "watchout", "Owner data needs manual verification",
      "Bhulekh RoR could not be fetched. Obtain the current Khatiyan and verify every recorded owner with ID proof and title documents before any transaction.",
      SRC_OWNER, 50));
    return insights;
  }

  if (owners.length === 0) {
    insights.push(make("title", "watchout", "No owner records found in RoR",
      "The RoR was fetched but no owner block was parsed. Obtain the original Khatiyan and verify the ownership directly from the Tehsil office.",
      SRC_OWNER, 40));
    return insights;
  }

  // Single owner
  if (owners.length === 1) {
    insights.push(make("title", "positive", "Single owner recorded",
      `The Bhulekh record shows a single owner — ${displayName(owners[0])}. Any transaction requires only one person's consent, making the process straightforward.`,
      SRC_OWNER, 3));
  }

  // Multiple owners
  if (owners.length > 1) {
    insights.push(make("title", "watchout", `${owners.length} owners recorded`,
      `The Bhulekh record shows ${owners.length} owners. All must sign the sale deed. If any owner is deceased, their legal heir documentation is required. If any owner is outside Khordha, their consent may need to be notarized.`,
      SRC_OWNER, 3));
  }

  // Female owner (widow indicator)
  const hasFemaleOwner = owners.some(o => {
    const name = (o.odia ?? "").toLowerCase();
    return name.includes("vidhva") || name.includes("vidhava") || name.includes("swa:");
  });
  if (hasFemaleOwner) {
    insights.push(make("title", "watchout", "Female owner (widow) recorded",
      "The record shows a female owner who appears to be a widow. Widow-owned land can be sold, but the seller's marital history and whether she received her legal share from the estate should be confirmed by a lawyer before proceeding.",
      SRC_OWNER, 4));
  }

  // Name reading needs review
  const needsReview = owners.some(o => o.nameReading?.needsManualReview || o.guardianReading?.needsManualReview);
  if (needsReview) {
    insights.push(make("title", "watchout", "Owner name needs manual review",
      "One or more owner or guardian names in the record could not be read with confidence from the Odia text. Compare the Odia RoR spelling with the seller's ID and title documents to confirm the name.",
      SRC_OWNER, 5));
  }

  // Court case in remarks
  const courtCaseRemark = remarks.find(r => {
    const cat = (r.category ?? "").toLowerCase();
    const text = (r.text ?? r.remarkText ?? "").toLowerCase();
    return cat === "court_case" || text.includes("case") || text.includes("court") ||
           text.includes("injunction") || text.includes("attachment");
  });
  if (courtCaseRemark) {
    const caseText = courtCaseRemark.text ?? courtCaseRemark.remarkText ?? "";
    insights.push(make("title", "redFlag", "Court case mentioned in land records",
      `The Back Page records a court case reference: "${trunc(caseText, 100)}". Court cases can result in attachments or injunctions that block land transfer. Confirm the current case status at the concerned court and verify the land is not under any order before registration.`,
      SRC_BACK, 1));
  }

  // Bank charge in remarks
  const bankRemark = remarks.find(r => {
    const cat = (r.category ?? "").toLowerCase();
    return cat === "bank_charge" || (r.text ?? "").toLowerCase().includes("bank");
  });
  if (bankRemark) {
    insights.push(make("title", "redFlag", "Bank charge recorded in land records",
      "The Back Page records a bank charge on this land. Bank charges typically represent loans against the property. Ask the seller for the loan closure documents and a no-objection certificate from the bank before registration.",
      SRC_BACK, 1));
  }

  // Govt restriction in remarks
  const govtRestriction = remarks.find(r => {
    const cat = (r.category ?? "").toLowerCase();
    return cat === "govt_restriction" || (r.text ?? "").toLowerCase().includes("government") && (r.text ?? "").toLowerCase().includes("restriction");
  });
  if (govtRestriction) {
    insights.push(make("title", "watchout", "Government restriction noted in records",
      `The Back Page records a government restriction: "${trunc(govtRestriction.text ?? govtRestriction.remarkText ?? "", 100)}". Confirm with the Tehsildar whether the restriction is still active and what process applies to lift it.`,
      SRC_BACK, 3));
  }

  // Active encumbrance (mortgage / charge)
  const activeCharge = encumbrances.find(e => {
    const type = (e.type ?? "").toLowerCase();
    return type.includes("mortgage") || type.includes("charge") || type.includes("lien") || type.includes("hypothecation");
  });
  if (activeCharge) {
    const amount = activeCharge.amount ?? activeCharge.amountOdia ?? "";
    insights.push(make("title", "redFlag", "Registered mortgage or charge on land",
      `The Back Page records an active mortgage or charge${amount ? ` of approximately ₹${amount}` : ""}. A buyer takes the property subject to this encumbrance unless it has been formally discharged. Ask the seller for a bank no-objection certificate before registration.`,
      SRC_BACK, 1));
  }

  // Mutation count pattern
  if (mutations.length > 0) {
    if (mutations.length >= 15) {
      insights.push(make("title", "watchout", "High mutation count — request order copies",
        `${mutations.length} mutation entries are recorded in the Back Page. High volume may indicate frequent transfers, family disputes, or ongoing legal proceedings. Ask the seller for copies of each mutation order and confirm all have been formally finalized.`,
        SRC_BACK, 3));
    } else if (mutations.length <= 5) {
      insights.push(make("title", "positive", "Low mutation count — stable title",
        `Only ${mutations.length} mutation ${mutations.length === 1 ? "entry" : "entries"} recorded in the Back Page. A low mutation count is a positive indicator of title stability.`,
        SRC_BACK, 4));
    } else {
      insights.push(make("title", "watchout", `${mutations.length} mutation entries — request order copies`,
        `The Back Page records ${mutations.length} mutations. Verify with the seller that all mutation orders are formally finalized and that the title chain is complete.`,
        SRC_BACK, 4));
    }
  } else {
    // Back page fetched but no mutations = clean
    if (back.mutationHistory) {
      insights.push(make("title", "positive", "No mutation entries — clean title record",
        "The Back Page shows no recorded mutations. This is a positive indicator, but note that Bhulekh may not reflect all historical transfers. An EC from the Sub-Registrar office is still required for a complete picture.",
        SRC_BACK, 5));
    }
  }

  // Check encumbrance count
  if (encumbrances.length === 0 && (back.encumbranceEntries ?? []).length === 0 && back.backPageRemarks) {
    insights.push(make("title", "positive", "No encumbrance entries in Bhulekh",
      "The Back Page shows no recorded encumbrances in Bhulekh. This is a positive signal, but EC from the Sub-Registrar office — which covers all registered transactions — is still required for a complete picture.",
      SRC_BACK, 5));
  }

  return insights;
}

// ---------------------------------------------------------------------------
// DIMENSION 3 — FINANCIAL EXPOSURE
// ---------------------------------------------------------------------------

function buildFinancialInsights(input: RiskInsightInput): RiskInsight[] {
  const insights: RiskInsight[] = [];
  const dues = input.dues ?? {};
  const back = input.backPage ?? {};
  const totalNum = newNumberFromValue(dues.total);
  const encumbrances = Array.isArray(back.encumbranceEntries) ? back.encumbranceEntries : [];

  if (!input.bhulekhUsable) {
    insights.push(make("financial", "watchout", "Dues and encumbrance status needs manual verification",
      "Bhulekh RoR could not be fetched. Ask for current revenue clearance receipts and an Encumbrance Certificate from IGR Odisha before registration.",
      SRC_DUES, 50));
    return insights;
  }

  // Pending dues
  if (totalNum != null && totalNum > 0) {
    const formatted = formatNumber(totalNum);
    insights.push(make("financial", "watchout", `₹${formatted} revenue demand shown`,
      `The RoR shows a total revenue demand of ₹${formatted}. This amount is typically payable before registration. Ask the seller for payment receipts or a clearance certificate from the Tehsil office.`,
      SRC_DUES, 4));
  } else if (totalNum === 0) {
    insights.push(make("financial", "positive", "Zero revenue demand shown",
      "The RoR total demand field is explicitly zero. A positive indicator, but verify with the latest payment receipt from the Tehsil office before registration.",
      SRC_DUES, 6));
  }

  // Total not readable
  if (dues.total == null && (dues.khajana || dues.cess || dues.jalkar)) {
    insights.push(make("financial", "watchout", "Revenue demand fields not fully readable",
      "Some revenue demand fields were parsed, but the total demand could not be read. Ask the seller for current land tax and cess clearance receipts from the Tehsil office.",
      SRC_DUES, 5));
  }

  // Total completely missing
  if (dues.total == null && !dues.khajana && !dues.cess && !dues.jalkar && !dues.otherCess) {
    insights.push(make("financial", "watchout", "Revenue demand status unknown",
      "The RoR did not return readable revenue demand fields. Ask the seller for a revenue clearance certificate confirming no pending land tax, cess, or water tax before registration.",
      SRC_DUES, 6));
  }

  // Encumbrance amounts
  if (encumbrances.length > 0) {
    const amounts = encumbrances
      .map(e => newNumberFromValue(e.amount ?? e.amountOdia))
      .filter((n): n is number => n != null && n > 0);
    const totalAmount = amounts.reduce((sum, n) => sum + n, 0);
    const entryCount = amounts.length;

    insights.push(make("financial", "watchout", `${entryCount} encumbrance ${entryCount === 1 ? "entry" : "entries"} in Bhulekh`,
      `${entryCount} encumbrance ${entryCount === 1 ? "entry is" : "entries are"} recorded in the Back Page${totalAmount > 0 ? ` totaling approximately ₹${formatNumber(totalAmount)}` : ""}. Encumbrances may include mortgages, charges, or court attachments. A buyer typically takes the property subject to existing encumbrances unless they are formally discharged. Request certified copies of all encumbrance entries and confirm which are still active.`,
      SRC_BACK, 3));
  }

  // Old publication date
  const pubDate = displayValue(input.remarks?.finalPublicationDate);
  const yearNum = pubDate ? yearFromDate(pubDate) : null;
  if (yearNum != null && yearNum < 2006) {
    insights.push(make("financial", "watchout", "Old RoR publication date — verify currency",
      `The RoR was last published in ${yearNum}. Old publication dates may mean the record does not reflect recent transactions. Ask the seller for a current RoR (updated within the last 12 months) and verify the title chain going back 30 years.`,
      SRC_REG, 4));
  }

  // No encumbrances
  if (encumbrances.length === 0 && back.encumbranceEntries) {
    insights.push(make("financial", "positive", "No encumbrances in Bhulekh record",
      "The Back Page shows no recorded encumbrances in Bhulekh. This is a positive signal, but note that Bhulekh reflects only what has been entered in the digital record. Many transactions are registered at the Sub-Registrar without updating Bhulekh. Obtain an EC from IGR Odisha for a complete picture.",
      SRC_BACK, 5));
  }

  return insights;
}

// ---------------------------------------------------------------------------
// DIMENSION 4 — POSITIVE SIGNALS
// ---------------------------------------------------------------------------

function buildPositiveInsights(input: RiskInsightInput): RiskInsight[] {
  const insights: RiskInsight[] = [];
  const owners = input.ownerRecords ?? [];
  const land   = input.landClass ?? {};
  const back   = input.backPage ?? {};
  const norm   = normalize(land.rawKisam, land.displayKisam, land.standardizedKisam);

  if (!input.bhulekhUsable) return insights;

  // Clean scenario: single owner, no encumbrances, no court cases, buildable
  const encumbrances = Array.isArray(back.encumbranceEntries) ? back.encumbranceEntries : [];
  const remarks = Array.isArray(back.backPageRemarks) ? back.backPageRemarks : [];
  const noCourt = !remarks.some(r => (r.category ?? "").toLowerCase() === "court_case" || (r.text ?? "").toLowerCase().includes("case"));
  const noBank  = !remarks.some(r => (r.category ?? "").toLowerCase() === "bank_charge");
  const noBankEnc = !encumbrances.some(e => (e.type ?? "").toLowerCase().includes("mortgage") || (e.type ?? "").toLowerCase().includes("charge"));
  const isBuildable = land.buildable === true && land.conversionRequired !== true &&
    (norm.includes("homestead") || norm.includes("gharabari") || norm.includes("byabasaika") || norm.includes("buildable"));

  if (owners.length === 1 && encumbrances.length === 0 && noCourt && noBank && noBankEnc) {
    const ownerName = displayName(owners[0]);
    insights.push(make("positive", "positive", "Appears clean — single owner, no charges",
      `This plot appears clean: a single owner (${ownerName}) on record, no registered charges in Bhulekh, and no court case or bank charge mentions in the Back Page. This is the highest-confidence scenario, but EC from IGR Odisha and a lawyer's title verification are still required before any transaction.`,
      SRC_OWNER, 2));
  }

  // Buildable land
  if (isBuildable) {
    const category = norm.includes("homestead") ? "homestead" :
                     norm.includes("byabasaika") ? "commercial" : "residential";
    insights.push(make("positive", "positive", "Buildable land — no land-use conversion needed",
      `This land is classified as ${category} on the Bhulekh record. No Change of Land Use certificate is required for ${category} use. Obtain building permission from the local authority before construction.`,
      SRC_PLOT, 3));
  }

  // No court cases found (eCourts)
  if (input.courtCases && input.courtCases.total === 0 && input.courtCases.status === "success") {
    insights.push(make("positive", "positive", "No active court cases found (Khordha courts)",
      "Our search of eCourts services (civil and criminal cases in Khordha courts) found no registered cases against the recorded owner. Note: this covers Khordha courts only and is not a nationwide search. For complete peace of mind, ask the seller for a self-declaration of no pending litigation.",
      SRC_OWNER, 4));
  }

  // No restrictions in remarks
  const noRestrictions = remarks.length === 0;
  const hasNoRemarks = noRestrictions && back.mutationHistory && back.encumbranceEntries;
  if (hasNoRemarks) {
    insights.push(make("positive", "positive", "No remarks recorded — clean Back Page",
      "The Back Page returned no remark entries (court cases, bank charges, or government restrictions). This is a positive signal. An EC from IGR Odisha is still required for a complete picture.",
      SRC_BACK, 5));
  }

  // Multiple positive signals present
  const posCount = insights.filter(i => i.severity === "positive").length;
  if (posCount >= 2) {
    insights.push(make("positive", "positive", `${posCount} positive signals across data`,
      `The record shows ${posCount} positive indicators — ${insights.filter(i => i.severity === "positive").map(i => i.label).join(", ")}. These are reassuring, but not a substitute for EC from IGR Odisha and a lawyer's verification.`,
      SRC_FRONT, 4));
  }

  return insights;
}

// ---------------------------------------------------------------------------
// DIMENSION 5 — RED FLAGS
// ---------------------------------------------------------------------------

function buildRedFlagInsights(input: RiskInsightInput): RiskInsight[] {
  const insights: RiskInsight[] = [];
  const owners = input.ownerRecords ?? [];
  const land   = input.landClass ?? {};
  const back   = input.backPage ?? {};
  const norm   = normalize(land.rawKisam, land.displayKisam, land.standardizedKisam);
  const remarks = Array.isArray(back.backPageRemarks) ? back.backPageRemarks : [];
  const encumbrances = Array.isArray(back.encumbranceEntries) ? back.encumbranceEntries : [];

  if (!input.bhulekhUsable) return insights;

  // Government ownership (critical)
  const hasGovtOwner = owners.some(o => isGovtOwner(o.odia ?? o.latin ?? ""));
  if (hasGovtOwner) {
    insights.push(make("redFlag", "redFlag", "Government owner recorded — private sale not possible",
      "The Bhulekh record shows a government department as owner. Government-owned land cannot be transferred through a private sale. Any transaction without verified government consent and regularization is void.",
      SRC_OWNER, 1,
      "Do not proceed. Ask the seller to show government regularization or a valid land transfer order from the Revenue Department."));
  }

  // Neyanjori / government notified (critical)
  if (norm.includes("neyanjori") || norm.includes("neya_niyogita") || norm.includes("khalsa")) {
    insights.push(make("redFlag", "redFlag", "Government notified land — sale and construction prohibited",
      "This land is classified as Neyanjori (government notified / Gair Khalsa). Construction and private sale are prohibited without state government approval. Check for ongoing regularization schemes with the Revenue Department before any action.",
      SRC_PLOT, 1,
      "Ask the seller whether this plot falls under any government regularization scheme. If not, do not proceed."));
  }

  // Court case in remarks
  const courtRemark = remarks.find(r => (r.category ?? "").toLowerCase() === "court_case");
  if (courtRemark) {
    insights.push(make("redFlag", "redFlag", "Court case mentioned in Back Page",
      `The Back Page records a court case: "${trunc(courtRemark.text ?? courtRemark.remarkText ?? "", 100)}". Land under a court order or attachment cannot be transacted until the stay is vacated. Confirm the current status at the concerned court before any action.`,
      SRC_BACK, 1,
      "Ask the seller for the full case details, current status, and a court clearance order before proceeding."));
  }

  // Bank charge / mortgage
  const bankRemark = remarks.find(r => (r.category ?? "").toLowerCase() === "bank_charge");
  const activeMortgage = encumbrances.find(e => (e.type ?? "").toLowerCase().includes("mortgage"));
  if (bankRemark || activeMortgage) {
    insights.push(make("redFlag", "redFlag", "Registered mortgage or bank charge on land",
      "The Back Page records a bank charge or mortgage on this land. A buyer who purchases encumbered land may inherit the debt. Ask the seller for the bank's no-objection certificate confirming the charge has been released before registration.",
      SRC_BACK, 1,
      "Ask the seller for a no-objection certificate from the bank. Do not proceed without it."));
  }

  // Government restriction
  const govtRestr = remarks.find(r => (r.category ?? "").toLowerCase() === "govt_restriction");
  if (govtRestr) {
    insights.push(make("redFlag", "redFlag", "Government restriction in records",
      `The Back Page records a government restriction: "${trunc(govtRestr.text ?? govtRestr.remarkText ?? "", 100)}". Government restrictions can include acquisition notices, ceiling limits, or conversion bans. Confirm with the Tehsildar whether the restriction is still active and what process applies.`,
      SRC_BACK, 2,
      "Ask the Tehsildar to confirm whether the restriction is still active and what steps are required."));
  }

  // Prohibited land class
  if (land.prohibited === true && !norm.includes("neyanjori")) {
    insights.push(make("redFlag", "redFlag", "Prohibited land class — verify what this means",
      `The land is flagged as prohibited for the intended use. Land class: ${land.rawKisam ?? land.standardizedKisam ?? "unknown"}. Verify with the Tehsildar what restriction applies and whether any exception or conversion path exists.`,
      SRC_PLOT, 2,
      "Ask a lawyer or the Tehsildar what specific restriction applies to this land class."));
  }

  // Name mismatch
  if (input.nameMatch && input.nameMatch.state === "mismatch") {
    insights.push(make("redFlag", "redFlag", "Seller name does not match Bhulekh record",
      `The name you provided ("${input.nameMatch.claimedName}") does not match the Bhulekh record ("${input.nameMatch.officialName ?? "the recorded owner"}"). This requires immediate clarification. Ask the seller for the complete title chain — all sale deeds, inheritance certificates, and family settlement documents going back at least 30 years.`,
      SRC_OWNER, 1,
      "Do not proceed until the seller explains this discrepancy with documented proof."));
  }

  return insights;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function make(
  dimension: string,
  severity: RiskSeverity,
  label: string,
  body: string,
  source: string,
  priority: number,
  actionItem?: string
): RiskInsight {
  return { dimension: dimension as RiskDimension, severity, label, body, source, priority, panelId: dimension, actionItem };
}

function normalize(...values: unknown[]): string {
  return values.map(v => String(v ?? "").toLowerCase()).join(" ");
}

function displayName(owner: { odia?: string | null; latin?: string | null } | undefined | null): string {
  if (!owner) return "the owner";
  return owner.latin ?? owner.odia ?? "the owner";
}

function trunc(text: string, max: number): string {
  if (!text) return "";
  const t = text.trim();
  return t.length > max ? t.slice(0, max) + "…" : t;
}

function newNumberFromValue(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const normalized = String(value ?? "").replace(/[,₹]/g, "").match(/-?\d+(?:\.\d+)?/);
  if (!normalized) return null;
  const parsed = Number.parseFloat(normalized[0]);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatNumber(n: number): string {
  return n.toLocaleString("en-IN");
}

function yearFromDate(text: string): number | null {
  const match = String(text).match(/\d{4}/);
  return match ? Number.parseInt(match[0], 10) : null;
}

function isGovtOwner(name: string): boolean {
  const n = name.toLowerCase();
  return n.includes("purti bibhag") || n.includes("ପୂର୍ତ୍ତ ବିଭାଗ") ||
         n.includes("government") || n.includes("sarkar") || n.includes("ସରକାର") ||
         n.includes("state government") || n.includes("ରାଜ୍ୟ ସରକାର") ||
         n.includes("odisha government") || n.includes("ଓଡ଼ିଶା ସରକାର") ||
         n.includes("corporation") || n.includes("board") ||
         n.includes("department") || n.includes("ବିଭାଗ");
}

export type RoRInsightPanelId =
  | "plot"
  | "owner"
  | "land"
  | "plotTable"
  | "dues"
  | "backPage";

export interface RoRInsight {
  tone: RoRInsightTone;
  label: string;
  body: string;
  source: string;
  priority: number;
  panelId: RoRInsightPanelId;
}

export interface RoRInsightInput {
  bhulekhUsable: boolean;
  bhulekhStatus?: string | null;
  selectedPlotNo?: unknown;
  ownerRecords?: Array<{
    odia?: string | null;
    latin?: string | null;
    guardianOdia?: string | null;
    guardianLatin?: string | null;
    casteOdia?: string | null;
    residenceOdia?: string | null;
    nameReading?: { needsManualReview?: boolean } | null;
    guardianReading?: { needsManualReview?: boolean } | null;
  }> | null;
  plotRows?: any[] | null;
  selectedPlotRow?: any | null;
  plotArea?: {
    acres?: number | null;
    sqft?: number | null;
    acreRaw?: unknown;
    decimalRaw?: unknown;
    hectareRaw?: unknown;
    computation?: unknown;
  } | null;
  landClass?: {
    rawKisam?: unknown;
    standardizedKisam?: unknown;
    displayKisam?: unknown;
    conversionRequired?: boolean | null;
    prohibited?: boolean | null;
    buildable?: boolean | null;
  } | null;
  dues?: any | null;
  remarks?: any | null;
  backPage?: any | null;
}

export type RoRInsightGroups = Record<RoRInsightPanelId, RoRInsight[]>;

const SOURCE_FRONT = "Bhulekh RoR Front Page";
const SOURCE_PLOT_TABLE = "Bhulekh RoR plot table";
const SOURCE_OWNER = "Bhulekh RoR owner block";
const SOURCE_DUES = "Bhulekh RoR dues fields";
const SOURCE_BACK = "Bhulekh RoR Back Page";

export function buildRoRInsightGroups(input: RoRInsightInput): RoRInsightGroups {
  const groups: RoRInsightGroups = {
    plot: [],
    owner: [],
    land: [],
    plotTable: [],
    dues: [],
    backPage: [],
  };

  groups.plot = selectTopRoRInsights(buildPlotInsights(input));
  groups.owner = selectTopRoRInsights(buildOwnerInsights(input));
  groups.land = selectTopRoRInsights(buildLandInsights(input));
  groups.plotTable = selectTopRoRInsights(buildPlotTableInsights(input));
  groups.dues = selectTopRoRInsights(buildDuesInsights(input));
  groups.backPage = selectTopRoRInsights(buildBackPageInsights(input));

  return groups;
}

export function selectTopRoRInsights(insights: RoRInsight[]): RoRInsight[] {
  return [...insights]
    .sort((left, right) => {
      if (left.tone !== right.tone) return left.tone === "watchout" ? -1 : 1;
      return right.priority - left.priority;
    })
    .slice(0, 4);
}

function buildPlotInsights(input: RoRInsightInput): RoRInsight[] {
  const insights: RoRInsight[] = [];
  const selectedRow = getSelectedPlotRow(input);
  const plotRows = Array.isArray(input.plotRows) ? input.plotRows : [];
  const selectedPlotText = displayValue(input.selectedPlotNo);

  if (!input.bhulekhUsable) {
    insights.push(insight("plot", "watchout", "RoR data needs manual check", `Bhulekh did not return a usable RoR in this run. Ask for the current Khatiyan before relying on plot details. Source status: ${input.bhulekhStatus || "unknown"}.`, SOURCE_FRONT, 100));
    return insights;
  }

  if (selectedRow) {
    insights.push(insight("plot", "positive", "Selected plot found in RoR", `Plot ${selectedPlotText || displayValue(selectedRow?.plotNo) || "the selected plot"} appears in the parsed RoR plot table.`, SOURCE_PLOT_TABLE, 90));
  } else if (plotRows.length > 0) {
    insights.push(insight("plot", "watchout", "Selected plot not found in plot table", `The RoR plot table was parsed, but plot ${selectedPlotText || "the selected plot"} was not matched to a row. Confirm the plot number from the original Khatiyan.`, SOURCE_PLOT_TABLE, 95));
  } else {
    insights.push(insight("plot", "watchout", "Plot table not parsed", "The RoR did not return a usable plot table in this run. Confirm plot number, khata number, and area from the original Khatiyan.", SOURCE_PLOT_TABLE, 92));
  }

  if (hasRawAreaComponents(input.plotArea)) {
    insights.push(insight("plot", "positive", "Area components parsed", "The RoR area was read from its acre/decimal/hectare fields, so the report can show both acres and square feet from source-backed components.", SOURCE_PLOT_TABLE, 80));
  } else if (!hasDisplayValue(input.plotArea?.acres)) {
    insights.push(insight("plot", "watchout", "Area needs manual confirmation", "The report could not read source-backed RoR area components for the selected plot. Confirm the area against the Khatiyan and site boundaries.", SOURCE_PLOT_TABLE, 88));
  } else {
    insights.push(insight("plot", "watchout", "Area uses fallback value", "The report has an area value, but the RoR acre/decimal/hectare components were not fully parsed. Confirm the area in the original record.", SOURCE_PLOT_TABLE, 78));
  }

  if (hasDisplayValue(input.remarks?.finalPublicationDate) || hasDisplayValue(input.remarks?.generatedAtRaw)) {
    insights.push(insight("plot", "positive", "RoR dates available", "The report captured RoR publication or generated-date fields that can help a lawyer confirm the document version being reviewed.", SOURCE_FRONT, 55));
  }

  return insights;
}

function buildOwnerInsights(input: RoRInsightInput): RoRInsight[] {
  const owners = Array.isArray(input.ownerRecords) ? input.ownerRecords : [];
  const insights: RoRInsight[] = [];

  if (!input.bhulekhUsable) {
    insights.push(insight("owner", "watchout", "Owner block needs manual check", `Bhulekh did not return usable owner records in this run. Ask for the current Khatiyan and verify every recorded owner and legal heir. Source status: ${input.bhulekhStatus || "unknown"}.`, SOURCE_OWNER, 100));
    return insights;
  }

  if (owners.length === 0) {
    insights.push(insight("owner", "watchout", "Owner block not parsed", "The RoR was returned, but the owner block was not parsed into usable names. Open the original Khatiyan and verify the owner block manually.", SOURCE_OWNER, 100));
    return insights;
  }

  if (owners.length > 1) {
    insights.push(insight("owner", "watchout", "Multiple owners recorded", `The RoR lists ${owners.length} owner records. Any sale or transfer should account for every recorded owner's consent and legal-heir position.`, SOURCE_OWNER, 95));
  }

  if (owners.some((owner) => Boolean(owner.nameReading?.needsManualReview || owner.guardianReading?.needsManualReview))) {
    insights.push(insight("owner", "watchout", "English reading needs review", "At least one Odia owner or guardian name needs manual English-name review. Compare the Odia RoR text with ID, title-chain, and sale-document spellings.", SOURCE_OWNER, 82));
  }

  insights.push(insight("owner", "positive", "Owner block parsed from RoR", `The report extracted ${owners.length} owner record${owners.length === 1 ? "" : "s"} directly from the Bhulekh RoR owner block.`, SOURCE_OWNER, 80));

  if (owners.some((owner) => hasDisplayValue(owner.guardianOdia) || hasDisplayValue(owner.guardianLatin) || hasDisplayValue(owner.residenceOdia))) {
    insights.push(insight("owner", "positive", "Family or residence fields present", "Guardian/father/spouse or residence fields were parsed, which gives a lawyer more identity anchors to compare with seller documents.", SOURCE_OWNER, 70));
  }

  if (owners.some((owner) => hasDisplayValue(owner.casteOdia))) {
    insights.push(insight("owner", "positive", "Community field present", "The RoR includes a caste/community field for at least one owner. Treat it as an identity field to compare, not as a title conclusion.", SOURCE_OWNER, 45));
  }

  return insights;
}

function buildLandInsights(input: RoRInsightInput): RoRInsight[] {
  const land = input.landClass ?? {};
  const insights: RoRInsight[] = [];
  const rawKisam = displayValue(land.rawKisam || land.displayKisam || land.standardizedKisam);
  const normalized = [land.rawKisam, land.displayKisam, land.standardizedKisam]
    .map((value) => String(value ?? "").toLowerCase())
    .join(" ");
  const isAgricultural = normalized.includes("agricultur") || normalized.includes("sharad") || normalized.includes("sarad");
  const isResidential = normalized.includes("residential") || normalized.includes("homestead") || normalized.includes("gharabari") || normalized.includes("gharabadi");

  if (!input.bhulekhUsable) {
    insights.push(insight("land", "watchout", "Land class needs manual check", `Bhulekh land-class data was not usable in this run. Confirm the kisam and any conversion requirement from the current Khatiyan. Source status: ${input.bhulekhStatus || "unknown"}.`, SOURCE_PLOT_TABLE, 100));
    return insights;
  }

  if (land.prohibited === true) {
    insights.push(insight("land", "watchout", "Restricted kisam flag", "The parsed land-class logic flagged a restricted category. Ask a lawyer or tehsil office what restrictions apply to the intended use.", SOURCE_PLOT_TABLE, 100));
  }

  if (land.conversionRequired === true || isAgricultural) {
    insights.push(insight("land", "watchout", "Conversion may be required", "The parsed kisam points to agricultural or conversion-sensitive land. Confirm whether conversion approval is needed before any residential or commercial use.", SOURCE_PLOT_TABLE, 92));
  }

  if (!hasDisplayValue(rawKisam)) {
    insights.push(insight("land", "watchout", "RoR kisam not parsed", "The report could not read a usable kisam for the selected plot. Confirm land class directly from the original Khatiyan.", SOURCE_PLOT_TABLE, 88));
  }

  if ((land.buildable === true || isResidential) && land.conversionRequired !== true) {
    insights.push(insight("land", "positive", "Buildable category parsed", "The RoR kisam was parsed as a residential or developed category. Use this as a source-backed land-class observation, not as building-permission approval.", SOURCE_PLOT_TABLE, 80));
  }

  if (hasDisplayValue(rawKisam)) {
    insights.push(insight("land", "positive", "RoR kisam captured", `The selected plot has a readable RoR kisam: ${rawKisam}.`, SOURCE_PLOT_TABLE, 65));
  }

  return insights;
}

function buildPlotTableInsights(input: RoRInsightInput): RoRInsight[] {
  const plotRows = Array.isArray(input.plotRows) ? input.plotRows : [];
  const selectedRow = getSelectedPlotRow(input);
  const insights: RoRInsight[] = [];

  if (!input.bhulekhUsable) {
    insights.push(insight("plotTable", "watchout", "Plot table needs manual check", "Bhulekh did not return a usable RoR plot table in this run. Confirm every plot row from the current Khatiyan.", SOURCE_PLOT_TABLE, 100));
    return insights;
  }

  if (plotRows.length === 0) {
    insights.push(insight("plotTable", "watchout", "No plot rows parsed", "The RoR owner data was returned, but the plot table was not parsed. Confirm plot number, area, boundaries, and remarks from the original record.", SOURCE_PLOT_TABLE, 100));
    return insights;
  }

  const relevantRows = selectedRow ? [selectedRow] : plotRows;
  if (!selectedRow && hasDisplayValue(input.selectedPlotNo)) {
    insights.push(insight("plotTable", "watchout", "Selected plot row missing", `Plot ${displayValue(input.selectedPlotNo)} was not matched inside the parsed plot table.`, SOURCE_PLOT_TABLE, 95));
  }

  if (relevantRows.some(hasPlotRemarks)) {
    insights.push(insight("plotTable", "watchout", "Plot remarks found", "At least one relevant RoR plot row includes a remarks field. Use the raw remark as an anchor for lawyer follow-up.", SOURCE_PLOT_TABLE, 85));
  }

  if (selectedRow) {
    insights.push(insight("plotTable", "positive", "Selected row highlighted", `The full plot table includes a matched row for plot ${displayValue(selectedRow.plotNo) || displayValue(input.selectedPlotNo) || "the selected plot"}.`, SOURCE_PLOT_TABLE, 80));
  }

  if (plotRows.length > 1) {
    insights.push(insight("plotTable", "positive", "Full khata context parsed", `The report parsed ${plotRows.length} plot rows from the Khatiyan, so nearby khata context can be reviewed without mixing it with the selected plot.`, SOURCE_PLOT_TABLE, 65));
  }

  if (relevantRows.some(hasBoundaryFields)) {
    insights.push(insight("plotTable", "positive", "Boundary fields present", "Boundary or occupier fields were parsed for the relevant plot row. Compare them with site inspection and the map before relying on boundaries.", SOURCE_PLOT_TABLE, 60));
  }

  return insights;
}

function buildDuesInsights(input: RoRInsightInput): RoRInsight[] {
  const dues = input.dues;
  const insights: RoRInsight[] = [];
  const total = dues?.total;
  const totalNumber = numberFromValue(total);
  const fields = [dues?.khajana, dues?.cess, dues?.otherCess, dues?.jalkar, total];
  const anyFieldPresent = fields.some(hasDisplayValue);

  if (!input.bhulekhUsable) {
    insights.push(insight("dues", "watchout", "Dues need manual check", "Bhulekh RoR dues fields were not available in this run. Ask for current receipts and confirm pending revenue demand before registration.", SOURCE_DUES, 100));
    return insights;
  }

  if (!dues || !anyFieldPresent) {
    insights.push(insight("dues", "watchout", "Dues fields not parsed", "The RoR did not return usable revenue-demand fields. Ask the seller for current rent/cess receipts and confirm with the tehsil office if needed.", SOURCE_DUES, 100));
    return insights;
  }

  if (totalNumber != null && totalNumber > 0) {
    insights.push(insight("dues", "watchout", "Revenue demand shown", `The RoR total demand field shows ${displayValue(total)}. Ask for payment receipts or updated clearance before registration.`, SOURCE_DUES, 95));
  } else if (hasDisplayValue(total) && totalNumber === 0) {
    insights.push(insight("dues", "positive", "Total demand field is zero", "The RoR total demand field is explicitly shown as zero in the parsed source. Still keep the latest receipt with the sale file.", SOURCE_DUES, 75));
  } else {
    insights.push(insight("dues", "watchout", "Dues total not shown", "Some dues fields were parsed, but the RoR total demand field was blank or unreadable. Confirm current demand from the original record or tehsil office.", SOURCE_DUES, 90));
  }

  if (anyFieldPresent) {
    insights.push(insight("dues", "positive", "Dues fields captured", "The report captured one or more RoR revenue-demand fields, which can be checked against seller receipts.", SOURCE_DUES, 55));
  }

  return insights;
}

function buildBackPageInsights(input: RoRInsightInput): RoRInsight[] {
  const backPage = input.backPage;
  const insights: RoRInsight[] = [];
  const mutations = Array.isArray(backPage?.mutationHistory) ? backPage.mutationHistory : [];
  const encumbrances = Array.isArray(backPage?.encumbranceEntries) ? backPage.encumbranceEntries : [];
  const remarks = Array.isArray(backPage?.backPageRemarks) ? backPage.backPageRemarks : [];

  if (!input.bhulekhUsable) {
    insights.push(insight("backPage", "watchout", "Back Page needs manual check", "Bhulekh did not return a usable RoR in this run. Pull the current Back Page and review mutation, charge, and remark entries manually.", SOURCE_BACK, 100));
    return insights;
  }

  if (!backPage) {
    insights.push(insight("backPage", "watchout", "Back Page not available", "The report did not receive the RoR Back Page. Ask for the full Khatiyan Back Page before treating the RoR review as complete.", SOURCE_BACK, 100));
    return insights;
  }

  if (mutations.length > 0) {
    insights.push(insight("backPage", "watchout", "Mutation entries found", `${mutations.length} mutation entr${mutations.length === 1 ? "y was" : "ies were"} parsed. Ask a lawyer to connect each mutation to the title chain and current khata.`, SOURCE_BACK, 95));
  }

  if (encumbrances.length > 0) {
    insights.push(insight("backPage", "watchout", "Charge-style entries found", `${encumbrances.length} charge-style entr${encumbrances.length === 1 ? "y was" : "ies were"} parsed. Compare these anchors with the IGR EC and lender release papers where relevant.`, SOURCE_BACK, 92));
  }

  if (remarks.length > 0) {
    insights.push(insight("backPage", "watchout", "Back Page remarks found", `${remarks.length} Back Page remark${remarks.length === 1 ? "" : "s"} were parsed. Use the extracted case, bank, or restriction anchors for manual follow-up.`, SOURCE_BACK, 88));
  }

  if (mutations.length === 0 && encumbrances.length === 0 && remarks.length === 0) {
    insights.push(insight("backPage", "positive", "Back Page returned no parsed entries", "The Back Page was fetched, but it did not return parsed mutation, charge-style, or remark entries in this run. This is a source observation, not a legal conclusion.", SOURCE_BACK, 70));
  }

  return insights;
}

function insight(
  panelId: RoRInsightPanelId,
  tone: RoRInsightTone,
  label: string,
  body: string,
  source: string,
  priority: number
): RoRInsight {
  return { panelId, tone, label, body, source, priority };
}

function getSelectedPlotRow(input: RoRInsightInput): any | null {
  if (input.selectedPlotRow) return input.selectedPlotRow;
  const rows = Array.isArray(input.plotRows) ? input.plotRows : [];
  return rows.find((row) => plotNosMatch(row?.plotNo, input.selectedPlotNo)) ?? null;
}

function hasRawAreaComponents(area: RoRInsightInput["plotArea"]): boolean {
  return Boolean(
    area &&
    (hasDisplayValue(area.acreRaw) || hasDisplayValue(area.decimalRaw) || hasDisplayValue(area.hectareRaw))
  );
}

function hasPlotRemarks(row: any): boolean {
  return hasDisplayValue(row?.remarksOdia) || hasDisplayValue(row?.remarks) || hasDisplayValue(row?.remarksRawOdia);
}

function hasBoundaryFields(row: any): boolean {
  return [
    row?.northBoundaryOdia,
    row?.southBoundaryOdia,
    row?.eastBoundaryOdia,
    row?.westBoundaryOdia,
    row?.northBoundary,
    row?.southBoundary,
    row?.eastBoundary,
    row?.westBoundary,
  ].some(hasDisplayValue);
}

function plotNosMatch(left: unknown, right: unknown): boolean {
  const normalize = (value: unknown) => String(value ?? "").trim().replace(/^0+/, "");
  const leftText = normalize(left);
  const rightText = normalize(right);
  return Boolean(leftText && rightText && leftText === rightText);
}

function displayValue(value: unknown): string {
  if (!hasDisplayValue(value)) return "";
  return String(value).trim();
}

function hasDisplayValue(value: unknown): boolean {
  if (value == null) return false;
  if (typeof value === "number") return Number.isFinite(value);
  const text = String(value).trim();
  if (!text) return false;
  if (text === "-" || text === "—") return false;
  return !["null", "undefined", "not verified", "unknown"].includes(text.toLowerCase());
}

function numberFromValue(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const normalized = String(value ?? "").replace(/,/g, "").match(/-?\d+(?:\.\d+)?/);
  if (!normalized) return null;
  const parsed = Number.parseFloat(normalized[0]);
  return Number.isFinite(parsed) ? parsed : null;
}
