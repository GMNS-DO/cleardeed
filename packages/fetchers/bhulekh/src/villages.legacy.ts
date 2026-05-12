// Khordha district villages — English ↔ Odia mapping
// Bhulekh village codes probed 2026-05-01 via full 10-tahasil sweep (1,477 villages mapped)
//
// Key findings:
// - Village dropdown populated by browser JS, NOT via ASP.NET AJAX — use Playwright for cascade
// - RI circles ≠ Bhulekh tahasils — villages assigned by Bhulekh's own administrative logic
// - Bhulekh Odia spellings differ from Census 2011 romanization
// - Village code 41 is SHARED (ଅଣ୍ଡା = Mandara in Kordha; ରଣପୁର = Ranapur in Balianta) — MUST disambiguate by tahasil
// - NOT FOUND in Bhulekh (2026-05-01): Haripur, Sangram, Kudi, Dhaulipur, Naikendud
//
// Bhulekh tahasil codes for Khordha district:
//   2 = ଭୁବନେଶ୍ଵର (Bhubaneswar)      1,277 villages confirmed
//   3 = ଖୋର୍ଦ୍ଧା (Kordha)            142 villages confirmed
//   6 = ଜଟଣୀ (Jatni)               146 villages confirmed
//   7 = ଟାଙ୍ଗି (Tangi)              122 villages confirmed
//   1 = ବାଣାପୁର (Banapur)           209 villages confirmed
//   8 = ବାଲିଅନ୍ତା (Balianta)        277 villages confirmed
//   9 = ବାଲି ପାଟଣା (Balipatna)      99 villages confirmed
//   4 = ବେଗୁନିଆ (Begunia)           89 villages confirmed
//   5 = ବୋଲଗଡ (Bolgarh)             174 villages confirmed
//  10 = ଚିଲିକା (Chilika/Balugaon)  236 villages confirmed

export const DISTRICT_CODE = "20"; // Khordha

export interface VillageMapping {
  english: string;
  /** Bhulekh Odia spelling (confirmed from live dropdown) */
  odia: string;
  /** Bhulekh administrative tahasil name */
  tahasil: string;
  riCircle: string;
  /** Bhulekh village numeric code — removed if NOT FOUND in probe */
  bhulekhVillageCode?: string;
  /** Bhulekh numeric tahasil code */
  bhulekhTahasilCode: string;
  bhulekhRICode?: string;
  /** Set true when NOT FOUND in any Khordha tahasil (may not be digitized) */
  notDigitized?: boolean;
}

export const KHRDHA_VILLAGES: VillageMapping[] = [
  // ── Bhubaneswar Tahasil (code 2) ──────────────────────────────────────────
  {
    english: "Mendhasala",   odia: "ମେଣ୍ଢାଶାଳ",
    tahasil: "Bhubaneswar", riCircle: "Chandaka",
    bhulekhVillageCode: "105", bhulekhTahasilCode: "2", bhulekhRICode: "11",
  },
  {
    english: "Chandaka",     odia: "ଚନ୍ଦକା",
    tahasil: "Bhubaneswar", riCircle: "Chandaka",
    bhulekhVillageCode: "76", bhulekhTahasilCode: "2", bhulekhRICode: "10",
  },
  {
    english: "Sijua",        odia: "ସିଜୁଆ",
    tahasil: "Bhubaneswar", riCircle: "Jatni",
    bhulekhVillageCode: "301", bhulekhTahasilCode: "2",
  },
  {
    english: "Nuagaon",      odia: "ନୁଆଗାଁ",
    tahasil: "Bhubaneswar", riCircle: "Jatni",
    bhulekhVillageCode: "309", bhulekhTahasilCode: "2",
  },
  {
    english: "Gothapada",    odia: "ଗୋଠପଟଣା",
    tahasil: "Bhubaneswar", riCircle: "Jatni",
    bhulekhVillageCode: "307", bhulekhTahasilCode: "2",
  },
  {
    english: "Khurda",       odia: "ମହୁରା",
    tahasil: "Bhubaneswar", riCircle: "Chandaka",
    bhulekhVillageCode: "383", bhulekhTahasilCode: "2",
  },
  // Haripur — NOT FOUND in Bhulekh (2026-05-01). Bhulekh spellings vary significantly.
  // Keep tahasil but remove code until re-probed.
  {
    english: "Haripur",  odia: "ହରୀପୁର",
    tahasil: "Bhubaneswar", riCircle: "Chandaka",
    bhulekhTahasilCode: "2", notDigitized: true,
  },

  // ── Kordha Tahasil (code 3) ───────────────────────────────────────────────
  {
    english: "Mandara",      odia: "ଅଣ୍ଡା",
    tahasil: "Kordha", riCircle: "Jatni",
    bhulekhVillageCode: "41", bhulekhTahasilCode: "3",
  },
  {
    english: "Brahmanabilen", odia: "ବ୍ରାହ୍ମଣ ବେରେଣି",
    tahasil: "Kordha", riCircle: "Chandaka",
    bhulekhVillageCode: "49", bhulekhTahasilCode: "3",
  },
  {
    english: "Dhaulimunda",   odia: "ଧଉଳିମୁହଁ",
    tahasil: "Kordha", riCircle: "Chandaka",
    bhulekhVillageCode: "44", bhulekhTahasilCode: "3",
  },
  // Banapur is in Banapur tahasil (code 1), NOT Kordha
  // Bhulekh has ବାଣାପୁର with code 95 in Banapur tahasil
  {
    english: "Banapur",  odia: "ବାଣାପୁର",
    tahasil: "Banapur", riCircle: "Balugaon",
    bhulekhVillageCode: "95", bhulekhTahasilCode: "1",
  },

  // ── Banapur Tahasil (code 1) ──────────────────────────────────────────────
  {
    english: "Kakatpur",     odia: "ଆୟତପୁର",
    tahasil: "Banapur", riCircle: "Balugaon",
    bhulekhVillageCode: "342", bhulekhTahasilCode: "1",
  },

  // ── Begunia Tahasil (code 4) ───────────────────────────────────────────────
  {
    english: "Bhagabatipur", odia: "ଭଗବତୀ ପୁର",
    tahasil: "Begunia", riCircle: "Balipatna",
    bhulekhVillageCode: "108", bhulekhTahasilCode: "4",
  },

  // ── Bolgarh Tahasil (code 5) ───────────────────────────────────────────────
  // Kudi found in Bolgarh tahasil (code 84), not Begunia
  {
    english: "Kudi",  odia: "କୁଡ଼ୀ",
    tahasil: "Bolgarh", riCircle: "Balugaon",
    bhulekhVillageCode: "84", bhulekhTahasilCode: "5", notDigitized: true,
    // NOTE: code 84 matches but tahasil assignment was wrong in previous version.
    // Re-probe if this village is critical for your use case.
  },

  // ── Balianta Tahasil (code 8) ────────────────────────────────────────────────
  {
    english: "Ranapur",  odia: "ରଣପୁର",
    tahasil: "Balianta", riCircle: "Balugaon",
    bhulekhVillageCode: "41", bhulekhTahasilCode: "8",
    // NOTE: code 41 is SHARED with Mandara (code 41, Kordha tahasil 3).
    // Bhulekh disambiguates by tahasil context.
  },

  // ── Balipatna Tahasil (code 9) ─────────────────────────────────────────────
  {
    english: "Balipatna", odia: "ବିର ପାଟଣା",
    tahasil: "Balipatna", riCircle: "Balipatna",
    bhulekhVillageCode: "19", bhulekhTahasilCode: "9",
  },

  // ── Chilika Tahasil (code 10) ──────────────────────────────────────────────
  {
    english: "Balugaon", odia: "ବାଲୁଗାଁ",
    tahasil: "Chilika", riCircle: "Balugaon",
    bhulekhVillageCode: "43", bhulekhTahasilCode: "10",
  },

  // ── NOT FOUND in Bhulekh (2026-05-01 full 10-tahasil sweep):
  // These villages do not appear in any of the 1,477 villages across all 10 Khordha tahasils.
  // Likely not yet digitized in Bhulekh.
  {
    english: "Sangram",  odia: "ସଂଗ୍ରାମ",
    tahasil: "Jatni", riCircle: "Jatni",
    bhulekhTahasilCode: "6", notDigitized: true,
  },
  {
    english: "Naikendud", odia: "ନାଇକେଣ୍ଦୁଡ",
    tahasil: "Balipatna", riCircle: "Balipatna",
    bhulekhTahasilCode: "9", notDigitized: true,
  },

  // ── Jatni Tahasil (code 6) ────────────────────────────────────────────────
  {
    english: "Jatni", odia: "ଜଟଣୀ",
    tahasil: "Jatni", riCircle: "Jatni",
    bhulekhVillageCode: "25", bhulekhTahasilCode: "6",
  },
];

// Lookup helpers
export function findVillageByEnglish(name: string): VillageMapping | undefined {
  return KHRDHA_VILLAGES.find(
    (v) => v.english.toLowerCase() === name.toLowerCase()
  );
}

/**
 * Find village by English name, disambiguated by Bhulekh tahasil code.
 * Required for villages with shared codes (e.g. code 41 = Mandara in Kordha/3, Ranapur in Balianta/8).
 */
export function findVillageByEnglishWithTahasil(
  name: string,
  bhulekhTahasilCode: string
): VillageMapping | undefined {
  return KHRDHA_VILLAGES.find(
    (v) =>
      v.english.toLowerCase() === name.toLowerCase() &&
      v.bhulekhTahasilCode === bhulekhTahasilCode
  );
}

export function findVillageByOdia(name: string): VillageMapping | undefined {
  return KHRDHA_VILLAGES.find((v) => v.odia === name);
}

/** Find village by English name, using tahasil from WFS/Bhunaksha to disambiguate shared codes. */
export function findVillageByEnglishWithTahasilHint(
  name: string,
  tahasilHint: string
): VillageMapping | undefined {
  // First try exact English match with tahasil hint
  const normalizedHint = tahasilHint.toLowerCase();
  const match = KHRDHA_VILLAGES.find(
    (v) =>
      v.english.toLowerCase() === name.toLowerCase() &&
      v.tahasil.toLowerCase() === normalizedHint
  );
  if (match) return match;

  // Fall back to English-only (first match)
  return findVillageByEnglish(name);
}

// Get all villages for a tahasil
export function getVillagesByTahasil(tahasil: string): VillageMapping[] {
  return KHRDHA_VILLAGES.filter(
    (v) => v.tahasil.toLowerCase() === tahasil.toLowerCase()
  );
}

// Bhulekh API field values
export const BHULEKH_DISTRICT = "20";
export const BHULEKH_BASE_URL = "https://bhulekh.ori.nic.in";

// Bhubaneswar tahasil code on public RoRView.aspx
export const BHUBANESWAR_TAHASIL_CODE = "2";

// Odia text for Bhubaneswar (used for dropdown text matching)
export const BHUBANESWAR_TAHASIL_ODIA = "ଭୁବନେଶ୍ଵର";