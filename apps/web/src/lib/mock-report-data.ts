/**
 * Mock report data for ClearDeed demo / development.
 *
 * All shapes match the Zod schemas in packages/schema/src/index.ts.
 * Replace with real fetched data once the orchestrator (T-007) is wired.
 */

import type {
  Report,
  NominatimResult,
  BhunakshaResult,
  RoRResult,
  CourtCaseResult,
} from "@cleardeed/schema";

// ---------------------------------------------------------------------------
// Source results
// ---------------------------------------------------------------------------

const nominatimResult: NominatimResult = {
  source: "nominatim",
  status: "success",
  verification: "verified",
  fetchedAt: new Date().toISOString(),
  data: {
    displayName: "Chandaka, Khordha, Odisha 752054, India",
    village: "Chandaka",
    tahasil: "Bhubaneswar",
    district: "Khordha",
    state: "Odisha",
    postcode: "752054",
    category: "village",
  },
};

const bhunakshaResult: BhunakshaResult = {
  source: "bhunaksha",
  status: "success",
  verification: "verified",
  fetchedAt: new Date().toISOString(),
  data: {
    plotNo: "128",
    village: "Mendhasala",
    tahasil: "Bhubaneswar",
    area: 0.006,
    areaUnit: "sq_km",
    shapeAreaUnit: "degrees2",
    classification: "NA",
    sourceDocument: "GeoServer WFS (mapserver.odisha4kgeo.in)",
  },
};

// Bhulekh is currently BROKEN (T-015 in progress) — return a failed result
const bhulekhResult: RoRResult = {
  source: "bhulekh",
  status: "failed",
  verification: "error",
  fetchedAt: new Date().toISOString(),
  error:
    "Bhulekh public RoR lookup temporarily unavailable. ASP.NET session handshake failed.",
};

const ecourtsResult: CourtCaseResult = {
  source: "ecourts",
  status: "partial",
  verification: "manual_required",
  fetchedAt: new Date().toISOString(),
  data: {
    cases: [],
    total: 0,
  },
};

// ---------------------------------------------------------------------------
// IGR deep-link (V1 — link-only, no automated fetch)
// ---------------------------------------------------------------------------

const igrLink = {
  url: "https://igrodisha.gov.in/ecsearch",
  params: {
    district: "Khordha",
    sro: "Not verified",
    plotNo: "128",
  },
  instructions:
    "Visit igrodisha.gov.in, select the relevant district/SRO, then search by plot number or owner name. EC must be obtained from IGR Odisha; fees and SRO mapping must be verified in the live government flow.",
};

// ---------------------------------------------------------------------------
// Manual verification checklist
// ---------------------------------------------------------------------------

const manualChecklist = [
  {
    dimension: "Land Records (Bhulekh RoR)",
    description:
      "Bhulekh records could not be retrieved automatically. Verify ownership by visiting bhulekh.ori.nic.in manually.",
    source: "bhulekh.ori.nic.in",
    action:
      "Navigate to RoRView.aspx, select District: Khordha, Tahasil: Bhubaneswar, Village: Mendhasala, then use the Bhulekh village/khatiyan/plot options confirmed in the live flow. Do not assume the revenue-map plot number is the Bhulekh lookup number unless the resolver has matched them.",
  },
  {
    dimension: "Court Cases (eCourts)",
    description:
      "Automated eCourts output is not enough to claim no active cases unless captcha acceptance and zero-record metadata are present.",
    source: "services.ecourts.gov.in",
    action:
      "Search for Mohapatra (petitioner/respondent) in Khurda district across all court complexes: Bhubaneswar, Khurda, Banapur, Jatni, Tangi.",
  },
  {
    dimension: "Encumbrance Certificate (EC)",
    description:
      "EC retrieval is not automated in V1. EC must be obtained from IGR Odisha before making any encumbrance claim.",
    source: "igrodisha.gov.in",
    action:
      "Visit igrodisha.gov.in, select the current district/SRO in the live flow, search using the confirmed plot/khata/owner details, and obtain the EC for lawyer review.",
  },
];

// ---------------------------------------------------------------------------
// Full report (matches Report Zod schema)
// ---------------------------------------------------------------------------

export const mockReport: Report = {
  id: "CLD-2026-001",
  plot: {
    gps: { lat: 20.272688, lon: 85.701271 },
    village: "Mendhasala",
    tahasil: "Bhubaneswar",
    district: "Khordha",
    riCircle: "11",
    source: "nominatim",
  },
  owner: {
    claimedOwnerName: "Mohapatra",
    fatherHusbandName: undefined,
    source: "user_claim",
  },
  sourceResults: [
    nominatimResult,
    bhunakshaResult,
    bhulekhResult,
    ecourtsResult,
  ],
  igrLink,
  manualChecklist,
  reportGeneratedAt: new Date().toISOString(),
  disclaimer:
    "This report aggregates public records only. It does not certify ownership, guarantee absence of fraud, or recommend transactions. All findings must be independently verified by a qualified property lawyer before any sale, purchase, or registration.",
};
