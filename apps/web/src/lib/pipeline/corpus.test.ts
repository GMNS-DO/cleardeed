import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../db", () => ({ supabaseAdmin: vi.fn() }));

import { supabaseAdmin } from "../db";
import { readPidArtifactsForReport, readPidEventsForProperty } from "./corpus";

function mockSupabase(impl: (table: string) => Promise<{ data: unknown; error: unknown }>) {
  return {
    from: vi.fn((table: string) => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          order: vi.fn(() => ({
            limit: vi.fn(() => impl(table)),
          })),
        })),
      })),
    })),
  };
}

beforeEach(() => vi.clearAllMocks());

describe("readPidArtifactsForReport", () => {
  it("returns artifacts joined to the report", async () => {
    const sb = mockSupabase(async () => ({
      data: [{ id: "art-1", storage_path: "x" }],
      error: null,
    }));
    vi.mocked(supabaseAdmin).mockReturnValue(sb as never);
    const out = await readPidArtifactsForReport("r-1");
    expect(out).toHaveLength(1);
    expect(sb.from).toHaveBeenCalledWith("pid_artifacts");
  });

  it("returns empty array on error", async () => {
    const sb = mockSupabase(async () => ({ data: null, error: { message: "x" } }));
    vi.mocked(supabaseAdmin).mockReturnValue(sb as never);
    const out = await readPidArtifactsForReport("r-1");
    expect(out).toEqual([]);
  });
});

describe("readPidEventsForProperty", () => {
  it("returns events for a property", async () => {
    const sb = mockSupabase(async () => ({
      data: [{ id: "ev-1", event_type: "fetch_completed" }],
      error: null,
    }));
    vi.mocked(supabaseAdmin).mockReturnValue(sb as never);
    const out = await readPidEventsForProperty("p-1");
    expect(out).toHaveLength(1);
    expect(sb.from).toHaveBeenCalledWith("pid_events");
  });
});