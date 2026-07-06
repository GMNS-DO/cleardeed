/**
 * Tests for /api/admin/dashboard/rerun — V1.1 dispatch via persisted dropdown
 * inputs (T-009 follow-up, migration 020).
 *
 * The rerun route now reads `v11Inputs` from get_report and dispatches to
 * either generateReportV11 or generateReport based on which set of inputs is
 * present on the report row. This test covers:
 *
 *   - auth: missing/bad token returns 401
 *   - admin env: missing ADMIN_VIEW_TOKEN returns 503
 *   - V1.0 GPS reports: re-runs generateReport with original lat/lon
 *   - V1.1 reports with persisted inputs: re-runs generateReportV11
 *   - V1.1 reports with NO persisted inputs (legacy predating migration 020):
 *     returns 400 V11_RERUN_UNSUPPORTED
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => {
  const chain: Record<string, unknown> = {};
  const methods = ["from", "select", "insert", "single", "eq"];
  for (const m of methods) chain[m] = vi.fn(() => chain);
  // .insert(...).select(...).single() resolves with a row.
  chain.then = (resolve: (v: unknown) => void) => {
    resolve({ data: { id: "new-report-1" }, error: null });
  };
  return {
    getReport: vi.fn(),
    supabaseAdmin: vi.fn(() => chain),
    setReportV11Inputs: vi.fn(),
    generateReport: vi.fn(),
    generateReportV11: vi.fn(),
    isDashboardAuthorized: vi.fn(),
    updateReportResults: vi.fn(),
    addReportAccessTokensToHtml: vi.fn((h: string) => h),
    buildReportUrl: vi.fn(() => "https://x/r/new-report-1"),
  };
});

vi.mock("@/lib/db", () => ({
  getReport: mocks.getReport,
  supabaseAdmin: mocks.supabaseAdmin,
  setReportV11Inputs: mocks.setReportV11Inputs,
  updateReportResults: mocks.updateReportResults,
}));

vi.mock("@/lib/dashboard-auth", () => ({
  isDashboardAuthorized: mocks.isDashboardAuthorized,
}));

vi.mock("@/lib/pipeline", () => ({
  generateReport: mocks.generateReport,
  generateReportV11: mocks.generateReportV11,
}));

vi.mock("@/lib/report-access", () => ({
  addReportAccessTokensToHtml: mocks.addReportAccessTokensToHtml,
  buildReportUrl: mocks.buildReportUrl,
}));

import { POST } from "./route";

function makeRequest(body: unknown, headers: Record<string, string> = {}): Request {
  return new Request("http://localhost/api/admin/dashboard/rerun", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json", ...headers },
  });
}

function resetEnv(extra: Record<string, string | undefined> = {}) {
  process.env.ADMIN_VIEW_TOKEN = "test-token";
  process.env.CLEARDEED_BASE_URL = "https://cleardeed.in";
  for (const [k, v] of Object.entries(extra)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
}

describe("POST /api/admin/dashboard/rerun", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetEnv();
    mocks.isDashboardAuthorized.mockReturnValue(true);
    mocks.generateReport.mockResolvedValue({
      html: "<html>V10</html>",
      title: "V10 Report",
      sourceSummary: { bhulekh: "success" },
      validationFindings: [],
    });
    mocks.generateReportV11.mockResolvedValue({
      html: "<html>V11</html>",
      htmlLawyer: "<html>V11-Lawyer</html>",
      title: "V11 Report",
      sourceSummary: { bhulekh: "success" },
      validationFindings: [],
    });
    mocks.updateReportResults.mockResolvedValue(undefined);
    mocks.setReportV11Inputs.mockResolvedValue(undefined);
  });

  it("returns 503 when ADMIN_VIEW_TOKEN is unset", async () => {
    resetEnv({ ADMIN_VIEW_TOKEN: undefined });
    const res = await POST(makeRequest({ reportId: "r1" }) as never);
    expect(res.status).toBe(503);
    expect(await res.json()).toMatchObject({ error: expect.stringMatching(/ADMIN_VIEW_TOKEN/) });
  });

  it("returns 401 when token is invalid", async () => {
    mocks.isDashboardAuthorized.mockReturnValue(false);
    const res = await POST(makeRequest({ reportId: "r1" }) as never);
    expect(res.status).toBe(401);
  });

  it("returns 400 when body has no reportId", async () => {
    const res = await POST(makeRequest({}) as never);
    expect(res.status).toBe(400);
  });

  it("re-runs a V1.0 GPS report via generateReport", async () => {
    mocks.getReport.mockResolvedValue({
      report: {
        id: "r1",
        gps_lat: 20.27,
        gps_lon: 85.84,
        claimed_owner_name: "Owner",
        plot_description: "desc",
        v11Inputs: null,
      },
    });
    const res = await POST(makeRequest({ reportId: "r1" }) as never);
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.reportId).toBe("new-report-1");
    expect(mocks.generateReport).toHaveBeenCalledTimes(1);
    expect(mocks.generateReportV11).not.toHaveBeenCalled();
    // V1.0 path does not persist V1.1 inputs.
    expect(mocks.setReportV11Inputs).not.toHaveBeenCalled();
  });

  it("re-runs a V1.1 report with persisted inputs via generateReportV11", async () => {
    mocks.getReport.mockResolvedValue({
      report: {
        id: "r1",
        gps_lat: 0,
        gps_lon: 0,
        claimed_owner_name: "Owner",
        paidTier: "standard",
        v11Inputs: {
          tehsil: "Bhubaneswar",
          tehsilCode: "2",
          village: "Mendhasala",
          villageCode: "402101",
          plotNo: "415/1",
          searchMode: "Plot",
        },
      },
    });
    const res = await POST(makeRequest({ reportId: "r1" }) as never);
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(mocks.generateReportV11).toHaveBeenCalledTimes(1);
    expect(mocks.generateReportV11).toHaveBeenCalledWith(
      expect.objectContaining({
        tehsil: "Bhubaneswar",
        tehsilValue: "2",
        village: "Mendhasala",
        villageCode: "402101",
        searchMode: "Plot",
        identifier: "415/1",
      }),
    );
    expect(mocks.generateReport).not.toHaveBeenCalled();
    // V1.1 inputs are persisted on the NEW report row.
    expect(mocks.setReportV11Inputs).toHaveBeenCalledWith(
      expect.objectContaining({
        reportId: "new-report-1",
        tehsil: "Bhubaneswar",
        villageCode: "402101",
        plotNo: "415/1",
        tier: "standard",
      }),
    );
  });

  it("returns 400 V11_RERUN_UNSUPPORTED for V1.1 reports without persisted inputs", async () => {
    mocks.getReport.mockResolvedValue({
      report: {
        id: "r1",
        gps_lat: 0,
        gps_lon: 0,
        claimed_owner_name: "Owner",
        v11Inputs: null,
      },
    });
    const res = await POST(makeRequest({ reportId: "r1" }) as never);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.code).toBe("V11_RERUN_UNSUPPORTED");
    expect(mocks.generateReportV11).not.toHaveBeenCalled();
    expect(mocks.generateReport).not.toHaveBeenCalled();
  });

  it("returns 404 when getReport returns no report object", async () => {
    mocks.getReport.mockResolvedValue({ report: null });
    const res = await POST(makeRequest({ reportId: "missing" }) as never);
    expect(res.status).toBe(404);
  });
});
