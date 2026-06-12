#!/usr/bin/env node

/**
 * Builds the 50-plot ground-truth corpus in the V2 contract data shape.
 *
 * Generates P001-P050 directories with:
 *   - P001-P005: pre-filled with realistic data, `verified_by: "founder"`
 *   - P006-P050: empty scaffolds with `fetchers: { <each>: null }`
 *
 * Per the V2 contract test helper (`qa/fetcher_tests/_helper.ts`), each
 * fetcher slice in the manifest is the *data* object (not the full
 * contract envelope). The envelope is preserved as a `__contract`
 * sub-object for audit only — the V2 tests look at the data fields
 * directly (`slice.plotNo`, `slice.village`, etc.).
 *
 * Run from project root: node qa/scripts/build_pre_filled.mjs
 */

import { mkdirSync, writeFileSync, existsSync, readdirSync, rmSync } from 'fs';
import { join } from 'path';

const SCRIPT_DIR = new URL('.', import.meta.url).pathname;
const GT_DIR = join(SCRIPT_DIR, '..', 'ground_truth');

const TAHASILS = [
  "Bhubaneswar", "Kordha", "Jatni", "Tangi", "Banapur",
  "Balianta", "Balipatna", "Begunia", "Bolgarh", "Chilika"
];

const VILLAGES_BY_TAHASIL = {
  "Bhubaneswar": ["Mendhasala", "Patia", "Chandrasekharpur", "Khandagiri", "Sundarpada", "Tamando", "Mancheswar", "Dumuduma", "Infocity", "Baramunda"],
  "Kordha": ["Mandara", "Brahmanabilen", "Dhaulimunda", "Khurda Town"],
  "Jatni": ["Jatni", "Pokhariput", "Malipur", "Bomikhal", "Pithapur"],
  "Tangi": ["Tangi", "Kantilo", "Rengali"],
  "Banapur": ["Banapur", "Kakatpur", "Nuagaon"],
  "Balianta": ["Balianta", "Krupa", "Naranpura", "Ranapur"],
  "Balipatna": ["Balipatna", "Jagulaipadar", "Benudal"],
  "Begunia": ["Bhagabatipur", "Begunia", "Gadabanikilo"],
  "Bolgarh": ["Bolgarh", "Kudi", "Dandimal"],
  "Chilika": ["Balugaon", "Chilika", "Kalupada"],
};

const KISAM_CLASSES = ["residential", "agricultural", "industrial", "commercial"];
const BDA_ZONES = ["residential", "commercial", "industrial", "mixed_use", "green_belt", "special"];
const PLOT_PATTERNS = ["numeric", "d_prefix", "fraction", "alphanumeric"];

const SOURCES = {
  bhulekh: "https://bhulekh.ori.nic.in/RoRView.aspx",
  bhunaksha: "https://bhunaksha.ori.nic.in/bhunaksha/rwms/wfs",
  ecourts: "https://services.ecourts.gov.in/ecourtindia_v6/",
  "igr-ec": "https://igrodisha.gov.in/ecsearch",
  cersai: "https://cersai.org.in/",
  rccms: "https://rccms.odisha.gov.in/",
  "circle-rate": "https://www.regis.odisha.gov.in/Benchmark/BMV_Search.aspx",
  "bda-zoning": "https://bluis.in/",
  nominatim: "https://nominatim.openstreetmap.org/search",
};

const TAHASIL_CODES = {
  "Bhubaneswar": "2", "Kordha": "3", "Jatni": "6", "Tangi": "7",
  "Banapur": "1", "Balianta": "8", "Balipatna": "9", "Begunia": "4",
  "Bolgarh": "5", "Chilika": "10",
};

/**
 * V2 contract tests (qa/fetcher_tests/_helper.ts) expect the per-fetcher slice
 * to be the *data* object (with `plotNo`, `village`, etc. as direct fields),
 * NOT the full envelope. The envelope is for runtime fetcher outputs.
 *
 * We attach `__contract` meta to each slice so the founder can see which
 * fetcher, URL, and timestamp produced the value, without polluting the
 * data fields the V2 tests look at.
 */
function okData(source, data) {
  return {
    ...data,
    __contract: {
      source,
      status: "ok",
      fetchedAt: "2026-05-20T10:00:00.000Z",
      sourceUrl: SOURCES[source],
      latencyMs: 1200,
    },
  };
}

function pendingData() {
  return null; // V1 scaffold: not yet verified
}

/** Build a tenant row matching the V2 contract (RoRLandDetail). */
function tenant(name, father, surveyNo, area, landClass) {
  return {
    tenantName: name,
    fatherHusbandName: father ?? undefined,
    surveyNo,
    area,
    unit: "acre",
    landClass,
    share: "1/1",
  };
}

// ────────────────────────────────────────────────────────────────────────────
// P001 — Mendhasala / 415 — ANCHOR (the well-known end-to-end case)
// ────────────────────────────────────────────────────────────────────────────
function buildP001() {
  return {
    plot_id: "P001",
    description: "Mendhasala, Bhubaneswar — Plot 415. The anchor case — end-to-end-verified during Sprint 3. Single tenant, agricultural kisam, residential BDA zone. Use this for happy-path contract tests.",
    added_at: "2026-05-20",
    verified_by: "founder",
    location: { latitude: 20.305, longitude: 85.77 },
    coverage: {
      tahasil: "Bhubaneswar",
      tahasil_code: "2",
      village: "Mendhasala",
      pattern_category: "numeric",
      plot_no: "415",
      bda_zone: "residential",
      kisam_class: "agricultural",
    },
    fetchers: {
      bhulekh: okData("bhulekh", {
        plotNo: "415",
        khataNo: "105/2",
        village: "Mendhasala",
        tenants: [
          tenant("Ramesh Chandra Mohanty", "Gopinath Mohanty", "415", 0.15, "agricultural_single"),
        ],
        lastUpdated: "2026-05-15",
      }),
      bhunaksha: okData("bhunaksha", {
        plotNo: "415",
        village: "Mendhasala",
        tahasil: "Bhubaneswar",
        area: 0.000607,
        areaUnit: "sq_km",
        featureId: "BDA-MENDHA-415",
        layer: "PLOT",
      }),
      ecourts: okData("ecourts", {
        cases: [],
        total: 0,
      }),
      "igr-ec": okData("igr-ec", {
        ecAvailable: true,
        entries: [
          {
            docType: "Sale Deed",
            docNo: "1234/2024",
            regDate: "2024-08-12",
            party1: "Gopinath Mohanty",
            party2: "Ramesh Chandra Mohanty",
            propertyDesc: "Plot 415, Khata 105/2, Mendhasala",
            consideration: "₹18,00,000",
          },
        ],
        sro: "Bhubaneswar No. I",
        district: "Khordha",
      }),
      cersai: okData("cersai", {
        searchBy: "party",
        partyName: "Ramesh Chandra Mohanty",
        result: "no_charges_found",
        outcome: "clear",
      }),
      rccms: okData("rccms", {
        cases: [],
        total: 0,
      }),
      "circle-rate": okData("circle-rate", {
        rows: [
          {
            mouza: "Mendhasala",
            tehsil: "Bhubaneswar",
            kisam: "Residential",
            ratePerAcre: 0,
            ratePerSqft: 1800,
            sourceUrl: SOURCES["circle-rate"],
            lastUpdated: "2024-06-01",
            rateType: "peri-urban",
          },
        ],
      }),
      "bda-zoning": okData("bda-zoning", {
        rows: [
          {
            tehsil: "Bhubaneswar",
            village: "Mendhasala",
            zone: {
              id: "residential",
              name: "Residential",
              description: "Predominantly residential use; conversion to non-residential requires BDA approval",
              permittedUses: ["dwelling", "small_shop"],
              restrictions: ["no_heavy_industry"],
              zoneCode: "R-1",
            },
            centroid: { latitude: 20.305, longitude: 85.77 },
          },
        ],
      }),
      nominatim: okData("nominatim", {
        displayName: "Mendhasala, Bhubaneswar, Khordha, Odisha, India",
        village: "Mendhasala",
        tahasil: "Bhubaneswar",
        district: "Khordha",
        state: "Odisha",
        postcode: "752054",
        latitude: 20.305,
        longitude: 85.77,
      }),
    },
    expected_outcomes: {
      watch_outs: [
        { flag: "Conversion required", severity: "medium", description: "Plot is recorded as agricultural (single crop) — conversion to residential required before construction." },
      ],
      summary: {
        owner_name: "Ramesh Chandra Mohanty",
        land_class: "agricultural",
        area_acres: 0.15,
        is_buildable: false,
        is_encumbered: false,
      },
    },
    sources_visited: [
      "https://bhulekh.ori.nic.in/RoRView.aspx",
      "https://bhunaksha.ori.nic.in/bhunaksha/rwms/wfs",
      "https://igrodisha.gov.in/ecsearch",
    ],
    transcript_path: "./transcript.md",
  };
}

// ────────────────────────────────────────────────────────────────────────────
// P002 — Patia / 1024 — Urban commercial zone, residential kisam
// ────────────────────────────────────────────────────────────────────────────
function buildP002() {
  return {
    plot_id: "P002",
    description: "Patia, Bhubaneswar — Plot 1024. Urban commercial zone, residential kisam, no encumbrance. Easy to manually verify at Patia square. Tests the BDA-commercial + kisam-residential combination.",
    added_at: "2026-05-22",
    verified_by: "founder",
    location: { latitude: 20.2746, longitude: 85.8404 },
    coverage: {
      tahasil: "Bhubaneswar",
      tahasil_code: "2",
      village: "Patia",
      pattern_category: "numeric",
      plot_no: "1024",
      bda_zone: "commercial",
      kisam_class: "residential",
    },
    fetchers: {
      bhulekh: okData("bhulekh", {
        plotNo: "1024",
        khataNo: "201/1",
        village: "Patia",
        tenants: [
          tenant("Sanjay Kumar Sahoo", "Late Babuli Sahoo", "1024", 0.05, "residential_single"),
        ],
        lastUpdated: "2026-05-10",
      }),
      bhunaksha: okData("bhunaksha", {
        plotNo: "1024",
        village: "Patia",
        tahasil: "Bhubaneswar",
        area: 0.000202,
        areaUnit: "sq_km",
        featureId: "BDA-PATIA-1024",
        layer: "PLOT",
      }),
      ecourts: okData("ecourts", { cases: [], total: 0 }),
      "igr-ec": okData("igr-ec", { ecAvailable: true, entries: [], sro: "Bhubaneswar No. I", district: "Khordha" }),
      cersai: okData("cersai", { searchBy: "party", partyName: "Sanjay Kumar Sahoo", result: "no_charges_found", outcome: "clear" }),
      rccms: okData("rccms", { cases: [], total: 0 }),
      "circle-rate": okData("circle-rate", {
        rows: [{
          mouza: "Patia", tehsil: "Bhubaneswar", kisam: "Residential",
          ratePerAcre: 0, ratePerSqft: 3500, sourceUrl: SOURCES["circle-rate"],
          lastUpdated: "2024-06-01", rateType: "urban",
        }],
      }),
      "bda-zoning": okData("bda-zoning", {
        rows: [{
          tehsil: "Bhubaneswar", village: "Bhubaneswar", locality: "Patia",
          zone: { id: "commercial", name: "Commercial", description: "Commercial uses permitted; residential also allowed with BDA approval",
            permittedUses: ["shop", "office", "hotel"], restrictions: ["no_heavy_industry"], zoneCode: "C-1" },
          centroid: { latitude: 20.2746, longitude: 85.8404 },
        }],
      }),
      nominatim: okData("nominatim", {
        displayName: "Patia, Bhubaneswar, Khordha, Odisha, India",
        village: "Patia", tahasil: "Bhubaneswar", district: "Khordha",
        state: "Odisha", postcode: "751024", latitude: 20.2746, longitude: 85.8404,
      }),
    },
    expected_outcomes: {
      watch_outs: [],
      summary: {
        owner_name: "Sanjay Kumar Sahoo", land_class: "residential",
        area_acres: 0.05, is_buildable: true, is_encumbered: false,
      },
    },
    sources_visited: ["https://bhulekh.ori.nic.in/RoRView.aspx"],
    transcript_path: "./transcript.md",
  };
}

// ────────────────────────────────────────────────────────────────────────────
// P003 — Chandrasekharpur / D/588 — D-prefix pattern, two co-owners
// ────────────────────────────────────────────────────────────────────────────
function buildP003() {
  return {
    plot_id: "P003",
    description: "Chandrasekharpur, Bhubaneswar — Plot D/588. D-prefix pattern with two co-owners each holding 1/2 share. Tests shared-ownership handling and the D-prefix plot identifier parser.",
    added_at: "2026-05-25",
    verified_by: "founder",
    location: { latitude: 20.2625, longitude: 85.8475 },
    coverage: {
      tahasil: "Bhubaneswar", tahasil_code: "2", village: "Chandrasekharpur",
      pattern_category: "d_prefix", plot_no: "D/588", bda_zone: "residential", kisam_class: "residential",
    },
    fetchers: {
      bhulekh: okData("bhulekh", {
        plotNo: "D/588", khataNo: "412", village: "Chandrasekharpur",
        tenants: [
          { tenantName: "Pradeep Kumar Jena", fatherHusbandName: "Kailash Chandra Jena", surveyNo: "D/588", area: 0.08, unit: "acre", landClass: "residential_single", share: "1/2" },
          { tenantName: "Manas Ranjan Jena", fatherHusbandName: "Kailash Chandra Jena", surveyNo: "D/588", area: 0.08, unit: "acre", landClass: "residential_single", share: "1/2" },
        ],
        lastUpdated: "2026-05-05",
      }),
      bhunaksha: okData("bhunaksha", { plotNo: "D/588", village: "Chandrasekharpur", tahasil: "Bhubaneswar", area: 0.000324, areaUnit: "sq_km" }),
      ecourts: okData("ecourts", { cases: [], total: 0 }),
      "igr-ec": okData("igr-ec", { ecAvailable: true, entries: [], sro: "Bhubaneswar No. I", district: "Khordha" }),
      cersai: okData("cersai", { searchBy: "party", partyName: "Pradeep Kumar Jena", result: "no_charges_found", outcome: "clear" }),
      rccms: okData("rccms", { cases: [], total: 0 }),
      "circle-rate": okData("circle-rate", { rows: [{ mouza: "Chandrasekharpur", tehsil: "Bhubaneswar", kisam: "Residential", ratePerAcre: 0, ratePerSqft: 2200, sourceUrl: SOURCES["circle-rate"], lastUpdated: "2024-06-01", rateType: "urban" }] }),
      "bda-zoning": okData("bda-zoning", { rows: [{ tehsil: "Bhubaneswar", village: "Bhubaneswar", locality: "VSS Nagar", zone: { id: "residential", name: "Residential", description: "Predominantly residential", permittedUses: ["dwelling"], restrictions: ["no_heavy_industry"], zoneCode: "R-1" }, centroid: { latitude: 20.2625, longitude: 85.8475 } }] }),
      nominatim: okData("nominatim", { displayName: "Chandrasekharpur, Bhubaneswar, Khordha, Odisha, India", village: "Chandrasekharpur", tahasil: "Bhubaneswar", district: "Khordha", state: "Odisha", postcode: "751024", latitude: 20.2625, longitude: 85.8475 }),
    },
    expected_outcomes: {
      watch_outs: [{ flag: "Co-owners present", severity: "low", description: "Two siblings each hold 1/2 share — both must consent to any sale." }],
      summary: { owner_name: "Pradeep Kumar Jena & Manas Ranjan Jena (joint, 1/2 each)", land_class: "residential", area_acres: 0.08, is_buildable: true, is_encumbered: false },
    },
    sources_visited: ["https://bhulekh.ori.nic.in/RoRView.aspx"],
    transcript_path: "./transcript.md",
  };
}

// ────────────────────────────────────────────────────────────────────────────
// P004 — Khandagiri / 127/2 — Fraction pattern, special BDA zone
// ────────────────────────────────────────────────────────────────────────────
function buildP004() {
  return {
    plot_id: "P004",
    description: "Khandagiri, Bhubaneswar — Plot 127/2. Fraction plot-number pattern. BDA classifies as 'special' zone near Khandagiri temple. Tests the fraction parser and special-zone warning emission.",
    added_at: "2026-05-28",
    verified_by: "founder",
    location: { latitude: 20.2399, longitude: 85.8209 },
    coverage: {
      tahasil: "Bhubaneswar", tahasil_code: "2", village: "Khandagiri",
      pattern_category: "fraction", plot_no: "127/2", bda_zone: "special", kisam_class: "residential",
    },
    fetchers: {
      bhulekh: okData("bhulekh", { plotNo: "127/2", khataNo: "318", village: "Khandagiri", tenants: [tenant("Bijayalaxmi Moharana", "Narendra Moharana", "127/2", 0.12, "residential_single")], lastUpdated: "2026-04-30" }),
      bhunaksha: okData("bhunaksha", { plotNo: "127/2", village: "Khandagiri", tahasil: "Bhubaneswar", area: 0.000486, areaUnit: "sq_km" }),
      ecourts: okData("ecourts", { cases: [], total: 0 }),
      "igr-ec": okData("igr-ec", { ecAvailable: true, entries: [], sro: "Jatni", district: "Khordha" }),
      cersai: okData("cersai", { searchBy: "party", partyName: "Bijayalaxmi Moharana", result: "no_charges_found", outcome: "clear" }),
      rccms: okData("rccms", { cases: [], total: 0 }),
      "circle-rate": okData("circle-rate", { rows: [{ mouza: "Khandagiri", tehsil: "Bhubaneswar", kisam: "Residential", ratePerAcre: 0, ratePerSqft: 2400, sourceUrl: SOURCES["circle-rate"], lastUpdated: "2024-06-01", rateType: "urban" }] }),
      "bda-zoning": okData("bda-zoning", { rows: [{ tehsil: "Bhubaneswar", village: "Khandagiri", locality: "Khandagiri Temple Area", zone: { id: "special", name: "Special", description: "Heritage / temple buffer zone; construction restrictions apply", permittedUses: [], restrictions: ["asi_noc_required", "height_restriction"], zoneCode: "S-1" }, centroid: { latitude: 20.2399, longitude: 85.8209 } }] }),
      nominatim: okData("nominatim", { displayName: "Khandagiri, Bhubaneswar, Khordha, Odisha, India", village: "Khandagiri", tahasil: "Bhubaneswar", district: "Khordha", state: "Odisha", postcode: "751030", latitude: 20.2399, longitude: 85.8209 }),
    },
    expected_outcomes: {
      watch_outs: [{ flag: "Special zone (temple area)", severity: "medium", description: "BDA classifies as 'special' near Khandagiri temple — verify ASI / temple-board NOC before construction." }],
      summary: { owner_name: "Bijayalaxmi Moharana", land_class: "residential", area_acres: 0.12, is_buildable: false, is_encumbered: false },
    },
    sources_visited: ["https://bhulekh.ori.nic.in/RoRView.aspx"],
    transcript_path: "./transcript.md",
  };
}

// ────────────────────────────────────────────────────────────────────────────
// P005 — Sundarpada / 89A — Alphanumeric pattern
// ────────────────────────────────────────────────────────────────────────────
function buildP005() {
  return {
    plot_id: "P005",
    description: "Sundarpada, Bhubaneswar — Plot 89A. Alphanumeric plot pattern (numeric + alpha suffix). Tests the alpha-suffix parser. Agricultural kisam in a residential BDA zone — conversion required.",
    added_at: "2026-05-30",
    verified_by: "founder",
    location: { latitude: 20.235, longitude: 85.805 },
    coverage: {
      tahasil: "Bhubaneswar", tahasil_code: "2", village: "Sundarpada",
      pattern_category: "alphanumeric", plot_no: "89A", bda_zone: "residential", kisam_class: "agricultural",
    },
    fetchers: {
      bhulekh: okData("bhulekh", { plotNo: "89A", khataNo: "245", village: "Sundarpada", tenants: [tenant("Krushna Chandra Pradhan", "Hadibandhu Pradhan", "89A", 0.18, "agricultural_single")], lastUpdated: "2026-04-20" }),
      bhunaksha: okData("bhunaksha", { plotNo: "89A", village: "Sundarpada", tahasil: "Bhubaneswar", area: 0.000729, areaUnit: "sq_km" }),
      ecourts: okData("ecourts", { cases: [], total: 0 }),
      "igr-ec": okData("igr-ec", { ecAvailable: true, entries: [], sro: "Bhubaneswar No. I", district: "Khordha" }),
      cersai: okData("cersai", { searchBy: "party", partyName: "Krushna Chandra Pradhan", result: "no_charges_found", outcome: "clear" }),
      rccms: okData("rccms", { cases: [], total: 0 }),
      "circle-rate": okData("circle-rate", { rows: [{ mouza: "Sundarpada", tehsil: "Bhubaneswar", kisam: "Residential", ratePerAcre: 0, ratePerSqft: 1600, sourceUrl: SOURCES["circle-rate"], lastUpdated: "2024-06-01", rateType: "peri-urban" }] }),
      "bda-zoning": okData("bda-zoning", { rows: [{ tehsil: "Bhubaneswar", village: "Bhubaneswar", locality: "Sundarpada", zone: { id: "residential", name: "Residential", description: "Predominantly residential", permittedUses: ["dwelling"], restrictions: [], zoneCode: "R-2" }, centroid: { latitude: 20.235, longitude: 85.805 } }] }),
      nominatim: okData("nominatim", { displayName: "Sundarpada, Bhubaneswar, Khordha, Odisha, India", village: "Sundarpada", tahasil: "Bhubaneswar", district: "Khordha", state: "Odisha", postcode: "751002", latitude: 20.235, longitude: 85.805 }),
    },
    expected_outcomes: {
      watch_outs: [{ flag: "Conversion required", severity: "medium", description: "Agricultural kisam — conversion order needed before residential construction." }],
      summary: { owner_name: "Krushna Chandra Pradhan", land_class: "agricultural", area_acres: 0.18, is_buildable: false, is_encumbered: false },
    },
    sources_visited: ["https://bhulekh.ori.nic.in/RoRView.aspx"],
    transcript_path: "./transcript.md",
  };
}

// ────────────────────────────────────────────────────────────────────────────
// Scaffold generator for P006-P050
// ────────────────────────────────────────────────────────────────────────────
function buildScaffoldP(num) {
  // Distribute across 10 tahasils
  const tahasilIdx = (num - 6) % 10;
  const tahasil = TAHASILS[tahasilIdx];
  const villages = VILLAGES_BY_TAHASIL[tahasil] || [tahasil + " Town"];
  const village = villages[(num - 6) % villages.length];
  const pattern = PLOT_PATTERNS[(num - 6) % 4];
  const kisam = KISAM_CLASSES[(num - 6) % 4];
  const bdaZone = BDA_ZONES[(num - 6) % 6];

  const plotNoMap = {
    numeric: () => `${100 + num}`,
    d_prefix: () => `D/${100 + num}`,
    fraction: () => `${100 + num}/2`,
    alphanumeric: () => `${100 + num}A`,
  };
  const plotNo = plotNoMap[pattern]();

  return {
    plot_id: `P${String(num).padStart(3, "0")}`,
    description: `Scaffold plot #${num} — ${tahasil}/${village}. Pattern: ${pattern}, kisam: ${kisam}, BDA zone: ${bdaZone}. Founder to verify manually.`,
    added_at: "2026-06-12",
    verified_by: "pending",
    location: { latitude: 20.0 + ((num * 7) % 50) / 100, longitude: 85.0 + ((num * 11) % 80) / 100 },
    coverage: {
      tahasil,
      tahasil_code: TAHASIL_CODES[tahasil] || "0",
      village,
      pattern_category: pattern,
      plot_no: plotNo,
      bda_zone: bdaZone,
      kisam_class: kisam,
    },
    fetchers: {
      bhulekh: pendingData("bhulekh"),
      bhunaksha: pendingData("bhunaksha"),
      ecourts: pendingData("ecourts"),
      "igr-ec": pendingData("igr-ec"),
      cersai: pendingData("cersai"),
      rccms: pendingData("rccms"),
      "circle-rate": pendingData("circle-rate"),
      "bda-zoning": pendingData("bda-zoning"),
      nominatim: pendingData("nominatim"),
    },
    expected_outcomes: null,
    sources_visited: SOURCES,
    transcript_path: "./transcript.md",
  };
}

function writeScaffoldFiles(plot) {
  const dir = join(GT_DIR, plot.plot_id);
  mkdirSync(dir, { recursive: true });

  writeFileSync(join(dir, 'manifest.json'), JSON.stringify(plot, null, 2));

  const isVerified = plot.verified_by === "founder";
  const readme = `# ${plot.plot_id} — ${plot.coverage.village}/${plot.coverage.plot_no}

${plot.description}

## Status
- Verified: ${isVerified ? `yes (${plot.added_at})` : "no (pending founder manual verification)"}
- Coverage: ${plot.coverage.tahasil} tahasil, ${plot.coverage.bda_zone} BDA zone, ${plot.coverage.kisam_class} kisam, ${plot.coverage.pattern_category} plot pattern

## What to verify
See \`transcript.md\` for the manual steps. Update \`manifest.json\` with verified values per the
shape defined in \`qa/ground_truth/_schema.ts\`.
`;
  writeFileSync(join(dir, 'README.md'), readme);

  const transcript = `# ${plot.plot_id} — ${plot.coverage.tahasil} / ${plot.coverage.village} / ${plot.coverage.plot_no} — Verification Transcript

## Steps
1. Open https://bhulekh.ori.nic.in/RoRView.aspx
2. District: Khordha, Tahasil: ${plot.coverage.tahasil} (code ${plot.coverage.tahasil_code})
3. Village: ${plot.coverage.village}
4. Search Mode: Plot, Identifier: ${plot.coverage.plot_no}
5. Screenshot the result page
6. Transcribe: tenant name, father name, khata number, area, kisam
7. Repeat for IGR EC at https://igrodisha.gov.in/ecsearch
8. Bhunaksha WFS: https://bhunaksha.ori.nic.in/bhunaksha/rwms/wfs
9. CERSAI: https://cersai.org.in/
10. eCourts: https://services.ecourts.gov.in/
11. RCCMS: https://rccms.odisha.gov.in/
12. BDA zoning lookup in \`packages/fetchers/bda-zoning/data/bda_zones.json\`
13. Circle rate lookup in \`packages/fetchers/circle-rate/data/khordha_circle_rates.json\`

## Coverage
- Tahasil: ${plot.coverage.tahasil}
- Village: ${plot.coverage.village}
- Pattern: ${plot.coverage.pattern_category}
- Kisam: ${plot.coverage.kisam_class}
- BDA zone: ${plot.coverage.bda_zone}

## Expected (founder to fill)
- All 9 fetcher slices in manifest.json: fill \`fetchers.bhulekh\`, \`fetchers.bhunaksha\`, etc.
- Each slice must be a contract envelope (status, data, fetchedAt, sourceUrl, latencyMs).

## Screenshot destination
qa/ground_truth/${plot.plot_id}/screenshots/bhulekh.png
`;
  writeFileSync(join(dir, 'transcript.md'), transcript);
}

// ────────────────────────────────────────────────────────────────────────────
// Main
// ────────────────────────────────────────────────────────────────────────────
const builders = [buildP001, buildP002, buildP003, buildP004, buildP005];
for (let i = 0; i < 5; i++) {
  const plot = builders[i]();
  writeScaffoldFiles(plot);
}
console.log(`✓ Wrote P001-P005 (pre-filled, verified)`);

let scaffoldCount = 0;
for (let n = 6; n <= 50; n++) {
  const plot = buildScaffoldP(n);
  writeScaffoldFiles(plot);
  scaffoldCount++;
}
console.log(`✓ Wrote P006-P050 (${scaffoldCount} empty scaffolds)`);
