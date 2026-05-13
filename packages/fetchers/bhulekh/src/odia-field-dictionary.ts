/**
 * Odia field dictionary for Bhulekh RoR Front and Back pages.
 *
 * Maps Bhulekh Odia field labels (as they appear in HTML) to English equivalents
 * and provides translation utilities for parsing Bhulekh HTML output.
 *
 * Sources: Bhulekh Portal User Manual PDF + live site observation
 * Last verified: 2026-05-12
 */

// ─────────────────────────────────────────────────────────────────────────────
// Front Page labels (SRoRFront_Uni.aspx)
// ─────────────────────────────────────────────────────────────────────────────

/** Odia → English label map for Front Page header fields */
export const FRONT_PAGE_HEADER_LABELS: Record<string, string> = {
  // Village / Tehsil / RI
  "ମୌଜା": "Village",
  "ଗ୍ରାମ": "Village",
  "ତହସିଲ": "Tehsil",
  "ଥାନା": "Thana",
  "ଆର୍.ଆଇ. ସର୍କଲ": "RI Circle",

  // Khatiyan header fields
  "ଖାତୀୟ ନମ୍ବର": "Khatiyan Number",
  "ମାଲିକ": "Landlord / Owner",
  "ନାମ": "Name",
  "ପ୍ରକାଶ ତାରିଖ": "Publication Date",
  "ଶ୍ରେଣୀ": "Classification",
  "ସ୍ଥିତି": "Status",
};

/** Odia → English label map for Front Page plot table columns */
export const FRONT_PAGE_PLOT_TABLE_LABELS: Record<string, string> = {
  "ପ୍ଲଟ ନଂ": "Plot Number",
  "ପ୍ଲଟ ନମ୍ବର": "Plot Number",
  "ଖାତ ପ୍ରକାର": "Land Type",
  "ଖାତ ପ୍ରକାର/ଶ୍ରେଣୀ": "Land Type / Classification",
  "ଏକର": "Acre",
  "ଏକର ସଂଖ୍ୟା": "Acre Count",
  "ଡେସିମଲ": "Decimal",
  "ହେକ୍ଟର": "Hectare",
  "ଦକ୍ଷିଣ": "South",
  "ଉତ୍ତର": "North",
  "ପୂର୍ବ": "East",
  "ପଶ୍ଚିମ": "West",
};

// ─────────────────────────────────────────────────────────────────────────────
// Back Page labels (SRoRBack_Uni.aspx)
// ─────────────────────────────────────────────────────────────────────────────

/** Odia → English label map for Back Page mutation history table */
export const BACK_PAGE_MUTATION_LABELS: Record<string, string> = {
  "ଚୌକିଦାରୀ ନଂ": "Chowkidari Number",
  "ଖାତୀୟ ନଂ": "Khatiyan Number",
  "ମ୍ୟୁଟେସନ ନଂ": "Mutation Number",
  "ମ୍ୟୁଟେସନ କ୍ରମାଙ୍କ": "Mutation Sequence",
  "ତାରିଖ": "Date",
  "ପ୍ଲଟ ନଂ": "Plot Number",
  "ପ୍ଲଟ ନମ୍ବର": "Plot Number",
  "କରି": "From",
  "ପ୍ରତି": "To",
  "ରୁଜୁ": "From",
  "ଗସ୍ତ": "To",
};

/** Odia → English label map for Back Page encumbrance table */
export const BACK_PAGE_ENCUMBRANCE_LABELS: Record<string, string> = {
  "ପ୍ରକାର": "Type",
  "ପ୍ରକାର/ପ୍ରକୃତି": "Type / Nature",
  "ସମ୍ପତ୍ତି ବିବରଣ": "Property Description",
  "ବିବରଣ": "Description",
  "ପକ୍ଷ ନାମ": "Party Name",
  "ପକ୍ଷ": "Party",
  "ରାଶି": "Amount",
  "ମୂଲ୍ୟ": "Value / Amount",
  "ସମୟ": "Period",
  "ମିଆଦ": "Period / Duration",
  "କାଗଜ ନଂ": "Document Number",
  "କାଗଜ ନମ୍ବର": "Document Number",
  "ତାରିଖ": "Date",
  "ପଂଜୀକରଣ ବର୍ଷ": "Registration Year",
  "ବର୍ଷ": "Year",
  "ରୁଜୁ": "From",
  "ଗସ୍ତ": "To",
};

/** Odia → English label map for Back Page govt. reservation section */
export const BACK_PAGE_RESERVATION_LABELS: Record<string, string> = {
  "ସରକାରୀ ସଂରକ୍ଷଣ": "Government Reservation",
  "ସଂରକ୍ଷଣ": "Reservation",
  "ଚିହ୍ନ ଟଂ": "Demarcation",
  "ଚିହ୍ନ": "Mark",
  "ଅଧିଗ୍ରହଣ": "Acquisition",
  "ପ୍ରତିବନ୍ଧକ": "Restriction",
};

// ─────────────────────────────────────────────────────────────────────────────
// Generic page labels (both pages)
// ─────────────────────────────────────────────────────────────────────────────

export const GENERIC_PAGE_LABELS: Record<string, string> = {
  "ଖାତୀୟ ନଂ": "Khatiyan Number",
  "ମୌଜା": "Village",
  "ତହସିଲ": "Tehsil",
  "ଶୀର୍ଷ": "Head / Header",
  "ସମୁଚାଳ": "Total",
  "ସମୁଏ": "Total",
  "ଚୋର": "Row",
  "ପୃଷ୍ଠା": "Page",
  "ପୂର୍ବ": "Previous",
  "ପରବର୍ତୀ": "Next",
};

// ─────────────────────────────────────────────────────────────────────────────
// Field name extraction from Bhulekh HTML element IDs
// Bhulekh uses ASP.NET client-side IDs like ctl00$ContentPlaceHolder1$gvRorBack$ctl02$lblPlotNo
// The meaningful part is the final field name (lblPlotNo, lblAcre, etc.)
// ─────────────────────────────────────────────────────────────────────────────

/** Maps Bhulekh element ID suffixes to readable English names */
export const BHULEKH_ELEMENT_ID_MAP: Record<string, string> = {
  // Front page header spans (gvfront_ctl02_*)
  lblMouja: "Village",
  lblTehsil: "Tehsil",
  lblThana: "Thana / RI Circle",
  lblLandlordName: "Landlord Name",
  lblKhatiyanslNo: "Khatiyan Number",
  lblName: "Owner / Tenant Name",
  lblStatuta: "Land Classification",
  lblLastPublishDate: "Last Publication Date",

  // Front page plot table cells (gvRorBack GridView)
  lblPlotNo: "Plot Number",
  lbllType: "Land Type",
  lblAcre: "Area (Acres)",
  lblDecimil: "Area (Decimals)",
  lblHector: "Area (Hectares)",

  // Back page elements
  lblChowkidariNo: "Chowkidari Number",
  lblMutationNo: "Mutation Number",
  lblDate: "Date",
  lblFrom: "From Khatiyan",
  lblTo: "To Khatiyan",

  // Encumbrance
  lblType: "Encumbrance Type",
  lblPropDesc: "Property Description",
  lblPartyName: "Party Name",
  lblAmount: "Amount",
  lblPeriod: "Period",
  lblDocNo: "Document Number",
  lblRegYear: "Registration Year",
};

// ─────────────────────────────────────────────────────────────────────────────
// Translation utilities
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Extract field name from a Bhulekh ASP.NET element ID.
 * e.g. "ctl00$ContentPlaceHolder1$gvRorBack$ctl02$lblPlotNo" → "lblPlotNo"
 */
export function extractFieldNameFromId(elementId: string): string {
  const parts = elementId.split("$");
  return parts[parts.length - 1] ?? elementId;
}

/**
 * Translate an Odia text label to English.
 * Falls back to returning the original text if no translation found.
 */
export function translateOdiaLabel(text: string): string {
  const clean = text.replace(/\s+/g, " ").trim();

  // Check all dictionaries in order of specificity
  const dictionaries = [
    FRONT_PAGE_HEADER_LABELS,
    FRONT_PAGE_PLOT_TABLE_LABELS,
    BACK_PAGE_MUTATION_LABELS,
    BACK_PAGE_ENCUMBRANCE_LABELS,
    BACK_PAGE_RESERVATION_LABELS,
    GENERIC_PAGE_LABELS,
  ];

  for (const dict of dictionaries) {
    if (dict[clean]) {
      return dict[clean];
    }
  }

  // Partial match: check if the text starts with any key
  for (const dict of dictionaries) {
    for (const [key, value] of Object.entries(dict)) {
      if (clean.startsWith(key)) {
        return value;
      }
    }
  }

  return text; // Return original if no translation found
}

/**
 * Check if text contains any Odia script characters (U+0B00–U+0B7F).
 */
export function containsOdia(text: string): boolean {
  return /[଀-୿]/.test(text);
}

/**
 * Convert Odia numerals to Arabic numerals.
 * Odia digits: ୦୧୨୩୪୫୬୭୮୯
 * Arabic:     0123456789
 */
export function odiaDigitsToArabic(text: string): string {
  const odiaDigits = ["୦", "୧", "୨", "୩", "୪", "୫", "୬", "୭", "୮", "୯"];
  let result = text;
  for (let i = 0; i < odiaDigits.length; i++) {
    result = result.replace(new RegExp(odiaDigits[i], "g"), String(i));
  }
  return result;
}

/**
 * Parse a Bhulekh area string (may contain Odia digits and units).
 * e.g. "୫.୫ ଏକର" → "5.5 acres"
 */
export function parseAreaString(text: string): { value: number; unit: string } | null {
  const normalized = odiaDigitsToArabic(text.trim());
  const match = normalized.match(/^([\d.]+)\s*(acre|hectare|ha|decimil|decimal|d)?$/i);
  if (!match) return null;

  const value = parseFloat(match[1]);
  const rawUnit = (match[2] ?? "acre").toLowerCase();

  let unit = "acre";
  if (rawUnit === "hectare" || rawUnit === "ha") unit = "hectare";
  else if (rawUnit === "decimil" || rawUnit === "decimal" || rawUnit === "d") unit = "decimal";

  return { value, unit };
}

/**
 * Check if a Bhulekh field value is empty/placeholder.
 * Bhulekh sometimes shows "&nbsp;" or "nbsp" for empty fields.
 */
export function isEmptyField(value: string): boolean {
  const normalized = value.replace(/&nbsp;/gi, "").replace(/nbsp/gi, "").trim();
  return normalized === "" || normalized === "-" || normalized === "—";
}