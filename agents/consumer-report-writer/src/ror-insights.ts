export type RoRInsightTone = "positive" | "watchout";

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
