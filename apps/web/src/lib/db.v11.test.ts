/**
 * Tests for setReportV11Inputs (db.ts) — V1.1 dropdown input persistence.
 *
 * T-009 follow-up: migration 020 added set_v11_inputs RPC. We verify the
 * wire shape (snake_case param names, null substitution) by invoking the
 * real wrapper with a mocked Supabase client. The actual RPC is exercised
 * against Supabase in the live smoke test (not in unit).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({ rpc: mocks.rpc }),
}));

process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY = "test-key";

import { setReportV11Inputs } from "./db";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.rpc.mockResolvedValue({ error: null });
});

describe("setReportV11Inputs", () => {
  it("calls set_v11_inputs RPC with all snake_case params", async () => {
    await setReportV11Inputs({
      reportId: "r-123",
      tehsil: "Bhubaneswar",
      tehsilCode: "2",
      village: "Mendhasala",
      villageCode: "402101",
      plotNo: "415/1",
      searchMode: "Plot",
      tier: "standard",
    });

    expect(mocks.rpc).toHaveBeenCalledTimes(1);
    expect(mocks.rpc).toHaveBeenCalledWith("set_v11_inputs", {
      p_report_id: "r-123",
      p_tehsil: "Bhubaneswar",
      p_tehsil_code: "2",
      p_village: "Mendhasala",
      p_village_code: "402101",
      p_plot_no: "415/1",
      p_search_mode: "Plot",
      p_tier: "standard",
    });
  });

  it("substitutes null for missing optional fields", async () => {
    await setReportV11Inputs({ reportId: "r-only" });
    expect(mocks.rpc).toHaveBeenCalledWith("set_v11_inputs", {
      p_report_id: "r-only",
      p_tehsil: null,
      p_tehsil_code: null,
      p_village: null,
      p_village_code: null,
      p_plot_no: null,
      p_search_mode: null,
      p_tier: null,
    });
  });

  it("throws with the Supabase error message verbatim on RPC failure", async () => {
    mocks.rpc.mockResolvedValue({ error: { message: "permission denied" } });
    await expect(setReportV11Inputs({ reportId: "r" })).rejects.toThrow(
      /set_v11_inputs failed: permission denied/,
    );
  });
});