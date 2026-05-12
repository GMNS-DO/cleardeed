/**
 * Odia Kisam (land classification) dictionary for Bhulekh RoR documents.
 *
 * Maps Bhulekh land class codes and Odia Kisam names to standardized
 * Odisha Kisam categories per the 2024-2026 Kisam rationalization.
 *
 * Sources: Bhulekh Portal User Manual PDF + Odisha Revenue Department Kisam list
 * Last verified: 2026-05-12
 */

// ─────────────────────────────────────────────────────────────────────────────
// Bhulekh Kisam code → standardized Odisha Kisam
// Bhulekh uses numeric codes for Kisam classification
// ─────────────────────────────────────────────────────────────────────────────

export const BHULEKH_KISAM_CODE_MAP: Record<string, string> = {
  // Standard agricultural land classifications
  "1": "nagariya_jogya",        // Homestead / Residential
  "2": "anajalasechita",        // Single crop irrigated (Danda)
  "3": "jalasechita_single",    // Single crop irrigated (Danda — alternative term)
  "4": "jalasechita_double",    // Double crop irrigated
  "5": "bagayat",               // Orchard / Plantation
  "6": "doba",                  // Low land / Paddy field
  "7": "kharab",                // Barren / Wasteland
  "8": "gochar",                // Grazing land
  "9": "jalasaya",              // Water body / Pond
  "10": "nadi",                 // River / Stream
  "11": "jungle",               // Forest / Jungle
  "12": "path",                 // Path / Road
  "13": "smasana",              // Cremation ground
  "14": "abadi",                // Habitation / Settlement
  "15": "ghurna",               // Brick kiln site
  "16": "patita",               // Fallow land
  "17": "rakh",                 // Protected forest
  "18": "khalsa",               // Government land
  "19": "khasra",               // Khasra (under preparation)
  "20": "chandigarh",           // Developed plot
  "21": "byabasaika",           // Commercial / Industrial
  "22": "neya_niyogita",        // Neyanjori / notified govt. land
};

// ─────────────────────────────────────────────────────────────────────────────
// Odia Kisam names → standardized Odisha Kisam
// Bhulekh displays Kisam in Odia script in the plot table
// ─────────────────────────────────────────────────────────────────────────────

export const ODIA_KISAM_MAP: Record<string, string> = {
  // Irrigated land (most common)
  "ଦଣ୍ଡା": "jalasechita_single",          // Irrigated single crop
  "ବାଣ ଦଣ୍ଡା": "jalasechita_single",       // Single crop irrigated (explicit)
  "ଦ୍ଵା ଦଣ୍ଡା": "jalasechita_single",       // Double crop irrigated
  "ଦ୍ଵା ଚାଷ": "jalasechita_double",         // Irrigated (two crops)
  "ଚାଷ": "jalasechita_single",             // Crop / Cultivation

  // Rainfed / upland
  "ଅନାବାଧୀ": "anajalasechita",            // Unirrigated / Rainfed
  "ବାଡ଼": "anajalasechita",                // Upland / Unirrigated
  "ଖାସର": "anajalasechita",                // Rainfed / Govt. land (khasra + khalsa overlap)

  // Wetland / lowland
  "ଢାଡି": "dobha",                         // Low land / Paddy field
  "ଢାବ": "dobha",                           // Low land
  "ବୋଧ": "dobha",                           // Low land (variant)

  // Orchard / plantation
  "ବାଗ": "bagayat",                         // Garden / Orchard
  "ଫଳ ବାଗ": "bagayat",                     // Fruit garden

  // Forest / vegetation
  "ବନ୍ଜାର": "jungle",                      // Jungle / Forest
  "ଜଙ୍ଗଲ": "jungle",                        // Forest
  "ରକ୍ଷ": "rakh",                           // Protected forest

  // Water bodies
  "ନଦୀ": "nadi",                            // River
  "ଜଳାଶୟ": "jalasaya",                      // Water body / Pond
  "ପୋଡ଼": "jalasaya",                        // Pond
  "କେଦା": "jalasaya",                        // Canal

  // Government / public
  "ସରକାର": "khalsa",                        // Government
  "ସ୍ଥିତି ବାନ": "khalsa",                  // Govt. land (Sitibon)
  "ଖେୱାଟ": "khalsa",                         // Khata / Govt. record
  "ନୟନଯୋରୀ": "neya_niyogita",              // Neyanjori — notified government land / GairKhalsa
  "ନୟୟୋନ୍ଜୋରୀ": "neya_niyogita",          // Variant spelling of Neyanjori

  // Community / public use
  "ଗୋଚର": "gochar",                         // Grazing land
  "ସ୍ମଶନ": "smasana",                        // Cremation ground
  "ରାସ୍ତା": "path",                          // Road / Path
  "ପଥ": "path",                               // Path

  // Habitation
  "ଆବାସୀ": "abadi",                         // Habitation
  "ବାସା": "abadi",                           // Settlement

  // Buildable / residential
  "ଗୃହ": "nagariya_jogya",                  // House / Residential
  "ଘର": "nagariya_jogya",                   // Home
  "କ୍ଷେତ୍ର": "unnayana_jogya",             // Building site
  "ନିର୍ମାଣ ଯୋଗ୍ୟ": "unnayana_jogya",       // Construction ready

  // Commercial / industrial
  "ବ୍ୟବସାୟିକ": "byabasaika",                // Commercial
  "କାରଖାନା": "byabasaika",                  // Factory

  // Barren / fallow
  "ଖାରବ": "kharab",                         // Barren
  "ପତିତ": "patita",                         // Fallow
  "ପର୍ଯ୍ୟକ୍ତ": "patita",                    // Fallow (formal)

  // Brick kiln
  "ଘୃଣ": "ghurna",                           // Brick kiln
  "ଇଟା": "ghurna",                           // Brick
};

// ─────────────────────────────────────────────────────────────────────────────
// Bhulekh Kisam display names (as shown on RoR)
// These are the exact strings Bhulekh uses in the plot table (lbllType column)
// ─────────────────────────────────────────────────────────────────────────────

export const BHULEKH_KISAM_DISPLAY: Record<string, { odia: string; english: string; standardized: string }> = {
  // Irrigated
  Danda: { odia: "ଦଣ୍ଡା", english: "Irrigated Single Crop", standardized: "jalasechita_single" },
  DoubleDanda: { odia: "ଦ୍ଵା ଦଣ୍ଡା", english: "Irrigated Double Crop", standardized: "jalasechita_double" },
  Chas: { odia: "ଚାଷ", english: "Cultivation / Crops", standardized: "jalasechita_single" },

  // Rainfed
  Anabadhi: { odia: "ଅନାବାଧୀ", english: "Unirrigated / Rainfed", standardized: "anajalasechita" },
  Baada: { odia: "ବାଡ଼", english: "Upland Rainfed", standardized: "anajalasechita" },
  Kharab: { odia: "ଖାରବ", english: "Barren / Wasteland", standardized: "kharab" },

  // Low land
  Dhaada: { odia: "ଢାଡି", english: "Low Land / Paddy", standardized: "dobha" },

  // Forest
  Banaja: { odia: "ବନ୍ଜାର", english: "Forest / Jungle", standardized: "jungle" },
  Jangala: { odia: "ଜଙ୍ଗଲ", english: "Forest", standardized: "jungle" },

  // Water
  Nadi: { odia: "ନଦୀ", english: "River", standardized: "nadi" },
  Jalasaya: { odia: "ଜଳାଶୟ", english: "Water Body / Pond", standardized: "jalasaya" },

  // Govt land
  Khalsa: { odia: "ଖାସର", english: "Government Land", standardized: "khalsa" },
  SthitiBon: { odia: "ସ୍ଥିତି ବାନ", english: "Government Land (Sitibon)", standardized: "khalsa" },

  // Community
  Gochara: { odia: "ଗୋଚର", english: "Grazing Land", standardized: "gochar" },
  Smasana: { odia: "ସ୍ମଶନ", english: "Cremation Ground", standardized: "smasana" },

  // Buildable
  Griha: { odia: "ଗୃହ", english: "House / Residential", standardized: "nagariya_jogya" },
  SetBandha: { odia: "ସେତ ବନ୍ଧ", english: "Embankment", standardized: "path" },
  Rasta: { odia: "ରାସ୍ତା", english: "Road", standardized: "path" },

  // Orchard
  Bag: { odia: "ବାଗ", english: "Garden / Orchard", standardized: "bagayat" },

  // Abadi
  Abadi: { odia: "ଆବାସୀ", english: "Habitation", standardized: "abadi" },

  // Fallow
  Patita: { odia: "ପତିତ", english: "Fallow Land", standardized: "patita" },
};

// ─────────────────────────────────────────────────────────────────────────────
// Utility functions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Standardize a Bhulekh Kisam value to the Odisha Kisam enum.
 * Accepts Odia text, English text, or numeric codes.
 */
export function standardizeKisam(kisamValue: string): string {
  const clean = kisamValue.replace(/\s+/g, " ").trim();

  // Direct Odia match
  if (ODIA_KISAM_MAP[clean]) {
    return ODIA_KISAM_MAP[clean];
  }

  // Numeric code match
  if (BHULEKH_KISAM_CODE_MAP[clean]) {
    return BHULEKH_KISAM_CODE_MAP[clean];
  }

  // Case-insensitive English match via display map
  for (const [, info] of Object.entries(BHULEKH_KISAM_DISPLAY)) {
    if (info.english.toLowerCase() === clean.toLowerCase()) {
      return info.standardized;
    }
  }

  // Partial Odia match (text contains key)
  for (const [key, value] of Object.entries(ODIA_KISAM_MAP)) {
    if (clean.includes(key)) {
      return value;
    }
  }

  // Unknown — return as-is
  return clean;
}

/**
 * Get the English display name for a standardized Kisam.
 */
export function getKisamEnglish(standardizedKisam: string): string {
  const displayMap: Record<string, string> = {
    nagariya_jogya: "Homestead / Residential",
    anajalasechita: "Unirrigated / Rainfed",
    jalasechita_single: "Irrigated (Single Crop)",
    jalasechita_double: "Irrigated (Double Crop)",
    bagayat: "Garden / Orchard",
    dobha: "Low Land / Paddy",
    kharab: "Barren / Wasteland",
    gochar: "Grazing Land",
    jalasaya: "Water Body",
    nadi: "River",
    jungle: "Forest",
    path: "Path / Road",
    smasana: "Cremation Ground",
    abadi: "Habitation",
    ghurna: "Brick Kiln",
    patita: "Fallow Land",
    rakh: "Protected Forest",
    khalsa: "Government Land",
    byabasaika: "Commercial / Industrial",
    unnayana_jogya: "Buildable / Construction Ready",
    agricultural: "Agricultural",
  };

  return displayMap[standardizedKisam] ?? standardizedKisam;
}

/**
 * Check if a Kisam requires Conversion (CLU certificate) for sale/construction.
 * Returns true for agricultural land that needs conversion before non-agricultural use.
 */
export function requiresConversion(kisam: string): boolean {
  const conversionRequired: string[] = [
    "anajalasechita",
    "jalasechita_single",
    "jalasechita_double",
    "bagayat",
    "dobha",
    "patita",
    "agricultural",
  ];
  return conversionRequired.includes(kisam);
}

/**
 * Check if a Kisam is prohibited from construction/conversion.
 * Returns true for forest, water bodies, grazing land, cremation ground, etc.
 */
export function isProhibited(kisam: string): boolean {
  const prohibited: string[] = [
    "jungle",
    "rakh",
    "nadi",
    "jalasaya",
    "gochar",
    "smasana",
    "khalsa", // govt land — needs conversion + permission
  ];
  return prohibited.includes(kisam);
}

/**
 * Check if a Kisam is safe for immediate construction without CLU.
 * Returns true for already-developed land.
 */
export function isBuildable(kisam: string): boolean {
  const buildable: string[] = [
    "nagariya_jogya",
    "byabasaika",
    "unnayana_jogya",
    "abadi",
    "ghurna",
    "path", // road land
  ];
  return buildable.includes(kisam);
}

/**
 * Estimate CLU (Conversion of Land Use) fee for a given Kisam and location.
 * Returns fee in INR per acre, or null if conversion not required.
 *
 * Based on Odisha CLU fee schedule 2024:
 * - Within 500m of NH/municipality: ₹3L/acre
 * - Within 250m of state highway: ₹1L/acre
 * - Planned area / rural: ₹30k/acre
 */
export function estimateCLUFee(
  kisam: string,
  distanceToNH_m?: number,
  distanceToStateHW_m?: number,
  inMunicipality?: boolean
): { fee: number; category: string } | null {
  if (!requiresConversion(kisam)) {
    return null; // No conversion needed
  }

  if (inMunicipality || (distanceToNH_m !== undefined && distanceToNH_m <= 500)) {
    return { fee: 3_00_000, category: "municipality_or_NH_500m" };
  }
  if (distanceToStateHW_m !== undefined && distanceToStateHW_m <= 250) {
    return { fee: 1_00_000, category: "state_hwy_250m" };
  }
  return { fee: 30_000, category: "planned_or_rural" };
}

/**
 * Convert Bhulekh Kisam to Odia display string for report output.
 */
export function toOdiaKisamDisplay(standardizedKisam: string): string {
  const reverseMap: Record<string, string> = {
    jalasechita_single: "ଦଣ୍ଡା",
    jalasechita_double: "ଦ୍ଵା ଦଣ୍ଡା",
    anajalasechita: "ଅନାବାଧୀ",
    jungle: "ବନ୍ଜାର",
    nadi: "ନଦୀ",
    jalasaya: "ଜଳାଶୟ",
    gochar: "ଗୋଚର",
    smasana: "ସ୍ମଶନ",
    khalsa: "ଖାସର",
    path: "ରାସ୍ତା",
    nagariya_jogya: "ଗୃହ",
    bagayat: "ବାଗ",
    kharab: "ଖାରବ",
    dobha: "ଢାଡି",
    abadi: "ଆବାସୀ",
    patita: "ପତିତ",
    byabasaika: "ବ୍ୟବସାୟିକ",
    unnayana_jogya: "କ୍ଷେତ୍ର",
    rakh: "ରକ୍ଷ",
    ghurna: "ଘୃଣ",
    agricultural: "କୃଷି",
  };

  return reverseMap[standardizedKisam] ?? standardizedKisam;
}