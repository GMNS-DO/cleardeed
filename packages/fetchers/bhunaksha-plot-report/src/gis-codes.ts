/**
 * Bhunaksha GIS codes for Khordha district villages.
 *
 * Per the bhulekh_bhunaksha_guide.md §3.3, the giscode passed to plotreportOR.jsp
 * encodes the geographic hierarchy:
 *
 *   2   00   2   11   10   500
 *   |   |    |   |    |    |
 *   |   |    |   |    |    └── mouza code
 *   |   |    |   |    └────── RI circle code
 *   |   |    |   └────────── tehsil code (Bhunaksha's own numbering)
 *   |   |    └────────────── district code (2 = Khordha)
 *   |   └────────────────── state sub-code (always 00 for Odisha)
 *   └────────────────────── state code (2 = Odisha)
 *
 * The Tehsil code in Bhunaksha is NOT the same as Bhulekh's `bhulekhTahasilCode`.
 * Bhulekh's Bhubaneswar is code 2; Bhunaksha's Bhubaneswar appears to be 11
 * (per guide sample 20021110500). The RI and mouza codes are Bhunaksha's own
 * numbering, distinct from Bhulekh's bhulekhVillageCode and bhulekhRICode.
 *
 * NOTE: Only Mendhasala (the ROR sample) is verified against the live portal.
 * Other entries are placeholders to be probed and verified in a future pass.
 * The fetcher falls back to a search-and-perturb strategy when the lookup
 * returns a partial entry — see index.ts buildGisCodeCandidates().
 */

export interface GisCodeEntry {
  /** English village name (matches KHRDHA_VILLAGES[].english in the bhulekh fetcher) */
  village: string;
  /** Bhulekh tahasil name — for disambiguation */
  tahasil: string;
  /** District code (2 = Khordha for our launch district) */
  districtCode: string;
  /** Tehsil code on Bhunaksha (distinct from Bhulekh's tahasil code) */
  bhunakshaTehsilCode: string;
  /** RI circle code on Bhunaksha */
  bhunakshaRiCode: string;
  /** Mouza code on Bhunaksha (often equals Bhulekh village code, but not always) */
  bhunakshaMouzaCode: string;
  /** True when probed against the live portal and a plot report loaded */
  verified: boolean;
  /** Optional source note for verification */
  verifiedFrom?: string;
}

/**
 * Top-50 Khordha villages, seeded with known codes. Only Mendhasala is
 * verified. Other rows are best-effort guesses that the fetcher will probe
 * and either confirm (mark verified=true) or fall back to the perturb-and-try
 * strategy.
 */
export const KHRDHA_BHUNAKSHA_GIS_CODES: GisCodeEntry[] = [
  // ── Verified (ROR sample + guide §3.3) ───────────────────────────────────
  {
    village: "Mendhasala",
    tahasil: "Bhubaneswar",
    districtCode: "2",
    bhunakshaTehsilCode: "11",
    bhunakshaRiCode: "10",
    bhunakshaMouzaCode: "500",
    verified: true,
    verifiedFrom: "ROR_sample.pdf + bhulekh_bhunaksha_guide.md §3.3",
  },

  // ── Unverified — to be probed. Most-likely guesses based on Bhulekh's
  //    bhulekhRICode and bhulekhVillageCode; the fetcher will perturb
  //    and try if the exact code fails. ────────────────────────────────────
  {
    village: "Chandaka",     tahasil: "Bhubaneswar",
    districtCode: "2", bhunakshaTehsilCode: "11", bhunakshaRiCode: "10",
    bhunakshaMouzaCode: "76", verified: false,
  },
  {
    village: "Sijua",        tahasil: "Bhubaneswar",
    districtCode: "2", bhunakshaTehsilCode: "11", bhunakshaRiCode: "10",
    bhunakshaMouzaCode: "301", verified: false,
  },
  {
    village: "Nuagaon",      tahasil: "Bhubaneswar",
    districtCode: "2", bhunakshaTehsilCode: "11", bhunakshaRiCode: "10",
    bhunakshaMouzaCode: "309", verified: false,
  },
  {
    village: "Gothapada",    tahasil: "Bhubaneswar",
    districtCode: "2", bhunakshaTehsilCode: "11", bhunakshaRiCode: "10",
    bhunakshaMouzaCode: "307", verified: false,
  },
  {
    village: "Khurda",       tahasil: "Bhubaneswar",
    districtCode: "2", bhunakshaTehsilCode: "11", bhunakshaRiCode: "10",
    bhunakshaMouzaCode: "383", verified: false,
  },
  {
    village: "Haripur",      tahasil: "Bhubaneswar",
    districtCode: "2", bhunakshaTehsilCode: "11", bhunakshaRiCode: "10",
    bhunakshaMouzaCode: "0", verified: false,  // not yet digitized per villages.ts
  },
  {
    village: "Mandara",      tahasil: "Kordha",
    districtCode: "2", bhunakshaTehsilCode: "11", bhunakshaRiCode: "10",
    bhunakshaMouzaCode: "41", verified: false,
  },
  {
    village: "Brahmanabilen", tahasil: "Kordha",
    districtCode: "2", bhunakshaTehsilCode: "11", bhunakshaRiCode: "10",
    bhunakshaMouzaCode: "49", verified: false,
  },
  {
    village: "Dhaulimunda",  tahasil: "Kordha",
    districtCode: "2", bhunakshaTehsilCode: "11", bhunakshaRiCode: "10",
    bhunakshaMouzaCode: "44", verified: false,
  },
  {
    village: "Banapur",      tahasil: "Banapur",
    districtCode: "2", bhunakshaTehsilCode: "11", bhunakshaRiCode: "10",
    bhunakshaMouzaCode: "95", verified: false,
  },
  {
    village: "Kakatpur",     tahasil: "Banapur",
    districtCode: "2", bhunakshaTehsilCode: "11", bhunakshaRiCode: "10",
    bhunakshaMouzaCode: "342", verified: false,
  },
  {
    village: "Bhagabatipur", tahasil: "Begunia",
    districtCode: "2", bhunakshaTehsilCode: "11", bhunakshaRiCode: "10",
    bhunakshaMouzaCode: "108", verified: false,
  },
  {
    village: "Kudi",         tahasil: "Bolgarh",
    districtCode: "2", bhunakshaTehsilCode: "11", bhunakshaRiCode: "10",
    bhunakshaMouzaCode: "84", verified: false,
  },
  {
    village: "Ranapur",      tahasil: "Balianta",
    districtCode: "2", bhunakshaTehsilCode: "11", bhunakshaRiCode: "10",
    bhunakshaMouzaCode: "41", verified: false,
  },
  {
    village: "Balipatna",    tahasil: "Balipatna",
    districtCode: "2", bhunakshaTehsilCode: "11", bhunakshaRiCode: "10",
    bhunakshaMouzaCode: "19", verified: false,
  },
  {
    village: "Balugaon",     tahasil: "Chilika",
    districtCode: "2", bhunakshaTehsilCode: "11", bhunakshaRiCode: "10",
    bhunakshaMouzaCode: "43", verified: false,
  },
  {
    village: "Sangram",      tahasil: "Jatni",
    districtCode: "2", bhunakshaTehsilCode: "11", bhunakshaRiCode: "10",
    bhunakshaMouzaCode: "0", verified: false,  // not yet digitized
  },
  {
    village: "Naikendud",    tahasil: "Balipatna",
    districtCode: "2", bhunakshaTehsilCode: "11", bhunakshaRiCode: "10",
    bhunakshaMouzaCode: "0", verified: false,  // not yet digitized
  },
  {
    village: "Jatni",        tahasil: "Jatni",
    districtCode: "2", bhunakshaTehsilCode: "11", bhunakshaRiCode: "10",
    bhunakshaMouzaCode: "25", verified: false,
  },
];

const STATE_CODE = "2";
const STATE_SUB = "00";

/**
 * Build a single giscode from parts. Format: {state}{sub}{district}{tehsil}{ri}{mouza}.
 * Each part is zero-padded to a fixed width:
 *   - state: 1 digit
 *   - sub:   2 digits
 *   - district: 1 digit
 *   - tehsil: 2 digits
 *   - ri:     2 digits
 *   - mouza:  3 digits
 */
export function buildGisCode(
  districtCode: string,
  tehsilCode: string,
  riCode: string,
  mouzaCode: string
): string {
  return [
    STATE_CODE,
    STATE_SUB,
    districtCode,
    tehsilCode.padStart(2, "0"),
    riCode.padStart(2, "0"),
    mouzaCode.padStart(3, "0"),
  ].join("");
}

/**
 * Look up a giscode by village + tahasil. Returns null if the village is not
 * in the lookup table or is marked not-digitized (mouzaCode "0").
 */
export function findGisCode(
  village: string,
  tahasil: string
): { gisCode: string; entry: GisCodeEntry } | null {
  const match = KHRDHA_BHUNAKSHA_GIS_CODES.find(
    (e) =>
      e.village.toLowerCase() === village.toLowerCase() &&
      e.tahasil.toLowerCase() === tahasil.toLowerCase()
  );
  if (!match) return null;
  if (match.bhunakshaMouzaCode === "0") return null;
  return {
    gisCode: buildGisCode(
      match.districtCode,
      match.bhunakshaTehsilCode,
      match.bhunakshaRiCode,
      match.bhunakshaMouzaCode
    ),
    entry: match,
  };
}

/**
 * Build a small list of giscode candidates to try, in order. Used when the
 * exact lookup either fails or returns an unverified code. We try a few
 * RI/mouza perturbations before giving up.
 */
export function buildGisCodeCandidates(
  districtCode: string,
  tehsilCode: string,
  riCode: string,
  mouzaCode: string
): string[] {
  const canonical = buildGisCode(districtCode, tehsilCode, riCode, mouzaCode);
  const candidates = [canonical];
  // Try a couple of nearby RI codes (off-by-one) — common when RI and
  // tahasil numbering shifted in the digitisation.
  const riNum = parseInt(riCode, 10);
  if (!Number.isNaN(riNum)) {
    for (const delta of [1, -1, 2, -2]) {
      const alt = riNum + delta;
      if (alt > 0) {
        candidates.push(buildGisCode(districtCode, tehsilCode, String(alt), mouzaCode));
      }
    }
  }
  return candidates;
}
