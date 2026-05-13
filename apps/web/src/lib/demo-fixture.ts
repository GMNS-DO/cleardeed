/**
 * Demo-mode fixture for T-017.
 *
 * Complete orchestrator output for test coordinates (20.272688, 85.701271).
 * Captured from a live golden-path run on 2026-04-19.
 *
 * The report page uses this when government sites are unreachable or when
 * a quick demo is needed. The report is flagged as "demo" and a "Refresh live data"
 * button allows users to trigger a real fetch.
 *
 * Coordinate: GPS 20.272688°N, 85.701271°E (Mendhasala/Haripur area, Khordha)
 * Owner searched: Mohapatra
 * Bhulekh result: Plot 415 → 5 tenants under Khatiyan 94 (Krushnachandra Barajena family)
 */

export interface DemoSourceResult {
  source: string;
  status: "success" | "partial" | "failed";
  verification: "verified" | "unverified" | "manual_required";
  fetchedAt: string;
  data?: Record<string, unknown>;
  error?: string;
}

export interface DemoOrchestratorOutput {
  isDemo: true;
  reportId: string;
  sources: DemoSourceResult[];
  completedAt: string;
}

export const DEMO_GOLDEN_PATH: DemoOrchestratorOutput = {
  isDemo: true,
  reportId: "CLD-DEMO-001",
  completedAt: "2026-04-19T21:03:53.638Z",
  sources: [
    {
      source: "nominatim",
      status: "success",
      verification: "verified",
      fetchedAt: "2026-04-19T21:03:08.848Z",
      data: {
        displayName: "Chandaka, Khordha, Odisha, 752054, India",
        village: null,
        tahasil: null,
        district: "Chandaka",
        state: "Odisha",
        postcode: "752054",
        category: null,
      },
    },
    {
      source: "bhunaksha",
      status: "partial",
      verification: "manual_required",
      fetchedAt: "2026-04-19T21:03:13.851Z",
      data: {
        plotNo: "415",
        village: "Haripur",
        tahasil: "Bhubaneswar",
        area: 0.024,
        areaUnit: "sq_km",
        shapeAreaUnit: "degrees2",
        sourceDocument: "https://mapserver.odisha4kgeo.in/geoserver/revenue/wfs",
      },
    },
    {
      source: "bhulekh",
      status: "success",
      verification: "verified",
      fetchedAt: "2026-04-19T21:03:21.069Z",
      data: {
        plotNo: "415",
        khataNo: "94",
        village: "Mendhasala",
        tenants: [
          {
            surveyNo: "415",
            area: 8.5,
            unit: "acre",
            landClass: "ଶାରଦ ଦୁଇ",
            tenantName: "କୃଷ୍ଣଚନ୍ଦ୍ର ବଡ଼ଯେନା ପି:ବାଉରିବନ୍ଧୁ ବଡ଼ଯେନା ଜା: ମହାଲାଏକ ବା: ନିଜଗାଁ",
            fatherHusbandName: undefined,
          },
          {
            surveyNo: "1823",
            area: 24.5,
            unit: "acre",
            landClass: "ଶାରଦ ଦୁଇ",
            tenantName: "କୃଷ୍ଣଚନ୍ଦ୍ର ବଡ଼ଯେନା ପି:ବାଉରିବନ୍ଧୁ ବଡ଼ଯେନା ଜା: ମହାଲାଏକ ବା: ନିଜଗାଁ",
            fatherHusbandName: undefined,
          },
          {
            surveyNo: "424",
            area: 7,
            unit: "acre",
            landClass: "ଶାରଦ ତିନି",
            tenantName: "କୃଷ୍ଣଚନ୍ଦ୍ର ବଡ଼ଯେନା ପି:ବାଉରିବନ୍ଧୁ ବଡ଼ଯେନା ଜା: ମହାଲାଏକ ବା: ନିଜଗାଁ",
            fatherHusbandName: undefined,
          },
          {
            surveyNo: "427",
            area: 26,
            unit: "acre",
            landClass: "ଶାରଦ ତିନି",
            tenantName: "କୃଷ୍ଣଚନ୍ଦ୍ର ବଡ଼ଯେନା ପି:ବାଉରିବନ୍ଧୁ ବଡ଼ଯେନା ଜା: ମହାଲାଏକ ବା: ନିଜଗାଁ",
            fatherHusbandName: undefined,
          },
          {
            surveyNo: "1441",
            area: 9.6,
            unit: "acre",
            landClass: "ବାରି",
            tenantName: "କୃଷ୍ଣଚନ୍ଦ୍ର ବଡ଼ଯେନା ପି:ବାଉରିବନ୍ଧୁ ବଡ଼ଯେନା ଜା: ମହାଲାଏକ ବା: ନିଜଗାଁ",
            fatherHusbandName: undefined,
          },
        ],
        lastUpdated: "06/03/1962",
        sourceDocument: "https://bhulekh.ori.nic.in/SRoRFront_Uni.aspx",
      },
    },
    {
      source: "ecourts",
      status: "partial",
      verification: "manual_required",
      fetchedAt: "2026-04-19T21:03:34.302Z",
      data: {
        cases: [],
        total: 0,
        searchMetadata: {
          districtName: "Khurda",
          districtCode: "8",
          complexesTried: ["Bhubaneswar", "Khurda", "Banapur", "Jatni", "Tangi"],
          captchaAcceptedCount: 0,
          captchaFailedCount: 0,
          attempts: [],
        },
      },
    },
  ],
};
