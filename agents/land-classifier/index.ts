/**
 * LandClassifier (A6) — Odisha Kisam classification for ClearDeed
 *
 * Based on Odisha's 22 standardized Kisam categories (2024-2026 rationalization):
 *   SAFE/READY: Gharabari, Byabasaika, Unnayana jogya
 *   CONVERSION REQUIRED: Anajalasechita, Bagayat, Patita, Jalasechita (single/double)
 *   PROHIBITED/HIGH RISK: Jalasaya, Jungle, Gochar, Smasana, Nala/Nadi
 *
 * Inputs: Bhulekh RoR plots + GPS coordinates
 * Output: LandClassificationReport for A10 ConsumerReportWriter
 */
import {
  LandClassifierInputSchema,
  type LandClassifierInput,
  type LandClassifierResult,
  type LandRestriction,
  type OdishaKisam,
  KisamCategorySchema,
  OdishaKisamSchema,
} from "./schema";

// Re-export types for external consumers (pipeline, tests)
export type { LandClassifierInput } from "./schema";

// ─── Odia → Kisam mapping (Bhulekh Odia labels → standardized) ─────────────

const ODIA_KISAM_MAP: Record<string, OdishaKisam> = {
  // Standardized identifiers emitted by Bhulekh fetcher
  "nagariya_jogya": "gharabari",
  "gharabari": "gharabari",
  "byabasaika": "byabasaika",
  "unnayana_jogya": "unnayana_jogya",
  "anajalasechita": "anajalasechita",
  "bagayat": "bagayat",
  "patita": "patita",
  "jalasechita_single": "jalasechita_single",
  "jalasechita_double": "jalasechita_double",
  "agricultural": "agricultural",
  "danda": "danda",
  "godanda": "godanda",
  "khalsa": "khalsa",
  "neya_niyogita": "neya_niyogita",
  "jungle": "jungle",
  "jalasaya": "jalasaya",
  "nadi": "nadi",
  "gochar": "gochar",
  "smasana": "smasana",
  // SAFE/READY
  "ଗୃହ ବାଡ଼ି": "gharabari", "ଘର ବାଡ଼": "gharabari", "Gharabari": "gharabari",
  "ଗୃହ": "gharabari", "ଘର": "gharabari", "ଘରବାରି": "gharabari", "ଘର ବାରି": "gharabari",
  "Homestead / Residential": "gharabari",
  "ବ୍ୟବସାୟିକ": "byabasaika", "Byabasaika": "byabasaika",
  "ଉନ୍ନୟନ ଯୋଗ୍ୟ": "unnayana_jogya", "Unnayana jogya": "unnayana_jogya",
  // CONVERSION REQUIRED
  "ଆନଜାଳ ସେଚିତ": "anajalasechita", "Anajalasechita": "anajalasechita",
  "ବାଗାତ": "bagayat", "Bagayat": "bagayat", "ଦାନ୍ଥା": "bagayat",
  "ପତିତ": "patita", "Patita": "patita",
  "ଜଳ ସେଚିତ": "jalasechita_single", "Jalasechita": "jalasechita_single",
  // PROHIBITED
  "ଜଳାଶୟ": "jalasaya", "Jalasaya": "jalasaya",
  "ଜଙ୍ଗଲ": "jungle", "Jungle": "jungle", "ବନ": "jungle", "ବନ୍ଜାର": "jungle",
  "ଗୋଚର": "gochar", "Gochar": "gochar",
  "ସ୍ମଶନ": "smasana", "Smasana": "smasana",
  "ନଦୀ": "nadi", "Nadi": "nadi",
  // Legacy Bhulekh terms
  "ସ୍ଥିତିବାନ": "anajalasechita",   // agricultural = rain-fed
  "ଦଣ୍ଡା":     "jalasechita_single", // irrigated single crop = Danda
  "ଗୋଦଣ୍ଡା":   "jalasechita_single", // go-danda = irrigated (single crop)
  "ଶାରଦ": "agricultural",
  "ଶାରଦ ଏକ": "agricultural",
  "ଶାରଦ ଦୁଇ": "agricultural",
  "ଶାରଦ ତିନି": "agricultural",
  "ଖାସର":     "other",              // khalsa = government land — classified as "other"
  "ପାଥର":     "other",
};

export function translateOdiaToKisam(odia: string): OdishaKisam {
  if (!odia) return "other";
  const t = odia.trim();
  if (ODIA_KISAM_MAP[t]) return ODIA_KISAM_MAP[t];
  for (const [key, val] of Object.entries(ODIA_KISAM_MAP)) {
    if (t.includes(key) || key.includes(t)) return val;
  }
  return "other";
}

export function getKisamCategory(kisam: OdishaKisam): "safe" | "conversion_required" | "prohibited" | "unknown" {
  switch (kisam) {
    case "gharabari": case "byabasaika": case "unnayana_jogya": return "safe";
    case "anajalasechita": case "bagayat": case "patita":
    case "jalasechita_single": case "jalasechita_double": return "conversion_required";
    case "jalasaya": case "jungle": case "gochar": case "smasana": case "nadi": return "prohibited";
    case "agricultural": case "danda": case "godanda": return "conversion_required";
    case "khalsa": case "neya_niyogita": return "prohibited";
    default: return "unknown";
  }
}

export const KISAM_ENGLISH: Record<OdishaKisam, string> = {
  gharabari:           "Gharabari (Homestead/Residential)",
  byabasaika:          "Byabasaika (Commercial)",
  unnayana_jogya:      "Unnayana Jogya (Developable/Planning Area)",
  anajalasechita:      "Anajalasechita (Rain-fed Agriculture)",
  bagayat:             "Bagayat (Orchard/Plantation)",
  patita:              "Patita (Fallow Land)",
  jalasechita_single:  "Jalasechita (Single Crop Irrigated)",
  jalasechita_double:  "Jalasechita Do-Fasali (Double Crop — High Difficulty Conversion)",
  jalasaya:            "Jalasaya (Water Body/Pond)",
  jungle:              "Jungle (Forest Land)",
  gochar:              "Gochar (Grazing Common Land)",
  smasana:             "Smasana (Cremation/Burial Ground)",
  nadi:                "Nadi (River/Waterway)",
  agricultural:        "Agricultural (Legacy)",
  danda:               "Danda/Irrigated (Legacy)",
  godanda:             "Go-Danda/Private Irrigation (Legacy)",
  khalsa:              "Khalsa/Government Land (Legacy)",
  pathra:              "Pathra (Stony/Waste)",
  banjara:             "Banjara/Forest (Legacy)",
  neya_niyogita:     "Neya Niyogita (Notified Govt. Land — Gair Khalsa)",
  other:               "Unknown/Other",
};

export const KISAM_CATEGORY_LABEL: Record<string, string> = {
  safe:                "READY — No conversion needed",
  conversion_required: "CONVERSION REQUIRED — CLU certificate needed",
  prohibited:          "PROHIBITED — Construction not allowed",
  unknown:             "UNKNOWN — Manual verification required",
};

// ─── GPS-based overlay checks ─────────────────────────────────────────────────

const PESA_BLOCKS_KHORDHA = [
  "Chandaka", "Balipatna", "Bhubaneswar", "Jatni", "Banapur",
];

function checkGPSOverlays(lat: number, lng: number, village?: string): string[] {
  const flags: string[] = [];
  if (village) {
    const vl = village.toLowerCase();
    for (const block of PESA_BLOCKS_KHORDHA) {
      if (vl.includes(block.toLowerCase())) { flags.push("pessa"); break; }
    }
  }
  // Approximate CRZ: coastal Khordha (lng < 85.80, lat < 20.15)
  if (lat < 20.15 && lng < 85.80) flags.push("crz");
  return flags;
}

// ─── CLU fee estimation ───────────────────────────────────────────────────────

function estimateCLUFee(
  proximityTo?: LandClassifierInput["proximityTo"],
  areaAcres?: number
): string | undefined {
  if (!proximityTo || areaAcres === undefined) return undefined;
  const perAcre = {
    municipality:   "₹3,00,000",
    nh_500m:        "₹3,00,000",
    state_hwy_250m: "₹1,00,000",
    planned_area:   "₹30,000",
    rural:          "₹30,000",
  }[proximityTo] ?? "₹30,000";
  const total = (areaAcres * (parseInt(perAcre.replace(/[^0-9]/g, "")) / 1000)).toLocaleString("en-IN");
  return `${perAcre} per acre — estimated total: ₹${total}`;
}

// ─── Main classifier ──────────────────────────────────────────────────────────

export function classifyLand(input: LandClassifierInput): LandClassifierResult {
  const parsed = LandClassifierInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      primaryKisam: "other", primaryCategory: "unknown",
      classificationExplanation: "Could not parse land classification input.",
      restrictions: [], conversionRequired: false,
      plotClassifications: [], overallRestrictionCount: 0,
      hasCriticalRestriction: false, prohibitedPlotCount: 0,
    };
  }

  const { plots, gpsCoordinates, village, overlayFlags, proximityTo } = parsed.data;
  const { lat, lng } = gpsCoordinates;

  const externalFlags = overlayFlags
    ? (Object.entries(overlayFlags).filter(([, v]) => v).map(([k]) => k) as string[])
    : [];
  const gpsFlags = externalFlags.length > 0 ? externalFlags : checkGPSOverlays(lat, lng, village);

  // Classify each plot
  const plotClassifications = plots.map(p => {
    const raw = p.landClassOdia ?? p.landClassEnglish ?? "";
    const kisam = translateOdiaToKisam(raw);
    const category = getKisamCategory(kisam);
    return {
      plotNo: p.plotNo,
      kisam,
      category,
      kisamEnglish: KISAM_ENGLISH[kisam] ?? raw,
      areaAcres: p.areaAcres,
    };
  });

  // Dominant Kisam by area
  const kisamAreas: Record<string, number> = {};
  for (const pc of plotClassifications) kisamAreas[pc.kisam] = (kisamAreas[pc.kisam] ?? 0) + pc.areaAcres;
  const dominant = (Object.entries(kisamAreas).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "other") as OdishaKisam;
  const dominantCategory = getKisamCategory(dominant);

  // Build restrictions
  const restrictions: LandRestriction[] = [];

  for (const pc of plotClassifications) {
    const cat = pc.category;
    if (pc.kisam === "jalasaya") {
      restrictions.push({
        type: "wetland", severity: "critical",
        description: `Plot ${pc.plotNo} (${pc.areaAcres} acres) is Jalasaya — a water body or pond. Construction on wetland is prohibited under the Wetland Rules, 2017. Any reclamation requires central approval.`,
        citation: "Wetland (Conservation and Management) Rules, 2017; Environment Protection Act, 1986",
        action: "Do not proceed. Verify if pond has been officially registered. Confirm with Revenue Department.",
        source: "Bhulekh Kisam",
      });
    }
    if (pc.kisam === "jungle" || pc.kisam === "banjara") {
      restrictions.push({
        type: "forest", severity: "critical",
        description: `Plot ${pc.plotNo} (${pc.areaAcres} acres) is Jungle/Forest land. Conversion requires central government approval under the Forest Conservation Act, 1980. A private sale of forest land is void.`,
        citation: "Forest Conservation Act, 1980; Van Adhikaran Niyam, 1967",
        action: "Do not proceed without Forest Department NOC. Obtain tree-cutting permission or reforestation clearance.",
        source: "Bhulekh Kisam",
      });
    }
    if (pc.kisam === "gochar") {
      restrictions.push({
        type: "prohibited_construction", severity: "critical",
        description: `Plot ${pc.plotNo} (${pc.areaAcres} acres) is Gochar — common grazing land. Grazing land cannot be converted to private non-agricultural use without government approval.`,
        citation: "Orissa Land Reforms Act, 1960; Common Land Protection Act",
        action: "Do not proceed. Gochar land is held for community use and cannot be individually sold.",
        source: "Bhulekh Kisam",
      });
    }
    if (pc.kisam === "smasana") {
      restrictions.push({
        type: "prohibited_construction", severity: "critical",
        description: `Plot ${pc.plotNo} is Smasana — a cremation or burial ground. Such land is a community resource and cannot be commercially sold or built upon.`,
        citation: "Public Premise Act; Local revenue rules",
        action: "Do not proceed. Confirm with Gram Panchayat and Tehsildar.",
        source: "Bhulekh Kisam",
      });
    }
    if (pc.kisam === "nadi") {
      restrictions.push({
        type: "wetland", severity: "critical",
        description: `Plot ${pc.plotNo} (${pc.areaAcres} acres) is Nadi/River — a waterway or riverbed. Riverbed is government land; construction is prohibited.`,
        citation: "Odisha Survey and Settlement Act, 1957; Irrigation Act",
        action: "Verify mutation. Riverbed plots often belong to Revenue Department, not private parties.",
        source: "Bhulekh Kisam",
      });
    }
    if (pc.kisam === "khalsa" || pc.kisam === "other") {
      restrictions.push({
        type: "land_ceiling", severity: "critical",
        description: `Plot ${pc.plotNo} (${pc.areaAcres} acres) is Khalsa/Government land. Government land cannot be sold by a private party.`,
        citation: "Odisha Land Reforms Act, 1960; Land Ceiling Act",
        action: "Do not proceed without checking government land regularization. Ask for conversion order.",
        source: "Bhulekh Kisam",
      });
    }
    if (pc.kisam === "jalasechita_double") {
      restrictions.push({
        type: "conversion_high_difficulty", severity: "warning",
        description: `Plot ${pc.plotNo} (${pc.areaAcres} acres) is Jalasechita Do-Fasali — double-crop irrigated land under food security protection. Conversion is extremely difficult and requires state-level approval.`,
        citation: "Right to Fair Compensation and Transparency in Land Acquisition Act, 2013; State Agriculture Policy",
        action: "High difficulty conversion — budget 2–3 years for CLU. Check with district collector if conversion is possible at all.",
        source: "Bhulekh Kisam",
      });
    }
    if (pc.kisam === "anajalasechita" || pc.kisam === "bagayat" || pc.kisam === "patita" ||
        pc.kisam === "jalasechita_single" || pc.kisam === "danda" || pc.kisam === "godanda" ||
        pc.kisam === "agricultural") {
      restrictions.push({
        type: "clu_required", severity: "warning",
        description: `Plot ${pc.plotNo} (${pc.areaAcres} acres) is classified as ${pc.kisamEnglish}. Converting to non-agricultural use requires a Change of Land Use (CLU) certificate from the Tehsildar.`,
        citation: "Orissa Land Changes (Levy and Readjustment of Rates) Rules, 1960; Section 8-A",
        action: "Get NA certificate from Tehsildar before construction. Factor CLU fees into your decision.",
        source: "Bhulekh Kisam",
      });
    }
  }

  // GPS overlays
  if (gpsFlags.includes("pessa")) {
    restrictions.push({
      type: "pessa", severity: "critical",
      description: `This area is in a PESA (Panchayat Extension to Scheduled Areas) block. Land sale requires Gram Sabha consent — a private sale without it is void.`,
      citation: "PESA Act, 1996; Fifth Schedule, Constitution of India",
      action: "Obtain Gram Sabha resolution. Property lawyer mandatory.",
      source: "GPS + Village in PESA block",
    });
  }
  if (gpsFlags.includes("crz")) {
    restrictions.push({
      type: "crz", severity: "critical",
      description: `This area falls within the Coastal Regulation Zone (CRZ). Construction, redevelopment, or change of use requires CRZ clearance from Odisha SCZMA.`,
      citation: "CRZ Notification 2019; Environment Protection Act, 1986",
      action: "Check CRZ category (I–IV). Obtain NOC from Odisha SCZMA before any construction.",
      source: "GPS near coastal boundary",
    });
  }

  const totalArea = plots.reduce((s, p) => s + p.areaAcres, 0);
  const hasCrit = restrictions.some(r => r.severity === "critical");
  const prohibitedCount = plotClassifications.filter(p => p.category === "prohibited").length;

  let explanation = `${totalArea.toFixed(2)} acres across ${plots.length} plot(s). `;
  explanation += `Dominant Kisam: ${KISAM_ENGLISH[dominant]} (${KISAM_CATEGORY_LABEL[dominantCategory]}). `;
  if (prohibitedCount > 0) explanation += `${prohibitedCount} prohibited plot(s) detected — see restrictions. `;
  if (restrictions.some(r => r.type === "clu_required")) explanation += `CLU certificate required for agricultural plots. `;

  return {
    primaryKisam: dominant,
    primaryCategory: dominantCategory,
    classificationExplanation: explanation,
    restrictions,
    conversionRequired: dominantCategory === "conversion_required",
    cluFeeEstimate: proximityTo ? estimateCLUFee(proximityTo, totalArea) : undefined,
    conversionNote: dominantCategory === "conversion_required"
      ? "Change of Land Use (CLU) required. Apply to Tehsildar with form and fee."
      : dominantCategory === "prohibited"
      ? "Construction strictly prohibited on this land type. Do not proceed."
      : undefined,
    plotClassifications,
    overallRestrictionCount: restrictions.length,
    hasCriticalRestriction: hasCrit,
    prohibitedPlotCount: prohibitedCount,
  };
}
