import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock supabaseAdmin BEFORE importing client
vi.mock("../../db", () => ({
  supabaseAdmin: vi.fn(),
}));

import { supabaseAdmin } from "../../db";
import {
  pidUpsertArtifact,
  pidInsertFactAssertion,
  pidInsertEvent,
  pidUpsertProperty,
} from "./client";

function makeMockSupabase(impl: (table: string) => Promise<{ data: unknown; error: unknown }>) {
  return {
    from: vi.fn((table: string) => ({
      upsert: vi.fn((payload: unknown, opts: unknown) => ({
        select: vi.fn(() => ({
          single: vi.fn(() => impl(table)),
        })),
        then: undefined,
        _payload: payload,
        _opts: opts,
      })),
      insert: vi.fn((payload: unknown) => ({
        select: vi.fn(() => ({
          single: vi.fn(() => impl(table)),
        })),
        _payload: payload,
      })),
    })),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("pidUpsertArtifact", () => {
  it("returns the inserted artifact id on success", async () => {
    const sb = makeMockSupabase(async () => ({ data: { id: "art-1" }, error: null }));
    vi.mocked(supabaseAdmin).mockReturnValue(sb as never);
    const id = await pidUpsertArtifact({
      artifactKey: "a".repeat(64),
      sourceId: "bhulekh",
      artifactType: "html",
      storagePath: "p",
      sha256: "b".repeat(64),
      query: {},
      metadata: {},
    });
    expect(id).toBe("art-1");
    expect(sb.from).toHaveBeenCalledWith("pid_artifacts");
  });

  it("returns null when supabase returns an error", async () => {
    const sb = makeMockSupabase(async () => ({ data: null, error: { message: "x" } }));
    vi.mocked(supabaseAdmin).mockReturnValue(sb as never);
    const id = await pidUpsertArtifact({
      artifactKey: "a".repeat(64),
      sourceId: "bhulekh",
      artifactType: "html",
      storagePath: "p",
      sha256: "b".repeat(64),
      query: {},
      metadata: {},
    });
    expect(id).toBeNull();
  });
});

describe("pidInsertFactAssertion", () => {
  it("returns the inserted fact id on success", async () => {
    const sb = makeMockSupabase(async () => ({ data: { id: "fact-1" }, error: null }));
    vi.mocked(supabaseAdmin).mockReturnValue(sb as never);
    const id = await pidInsertFactAssertion({
      subjectType: "property",
      predicate: "owner_name",
      rawValue: "Ram",
      sourceId: "bhulekh",
      valueJson: {},
      metadata: {},
    });
    expect(id).toBe("fact-1");
    expect(sb.from).toHaveBeenCalledWith("pid_fact_assertions");
  });
});

describe("pidInsertEvent", () => {
  it("returns the inserted event id on success", async () => {
    const sb = makeMockSupabase(async () => ({ data: { id: "ev-1" }, error: null }));
    vi.mocked(supabaseAdmin).mockReturnValue(sb as never);
    const id = await pidInsertEvent({
      eventType: "lead_signal",
      sourceId: "bhulekh",
      eventSummary: "x",
      metadata: {},
    });
    expect(id).toBe("ev-1");
    expect(sb.from).toHaveBeenCalledWith("pid_events");
  });
});

describe("pidUpsertProperty", () => {
  it("returns the upserted property id on success", async () => {
    const sb = makeMockSupabase(async () => ({ data: { id: "prop-1" }, error: null }));
    vi.mocked(supabaseAdmin).mockReturnValue(sb as never);
    const id = await pidUpsertProperty({
      state: "Odisha",
      district: "Khordha",
      tahasil: "Bhubaneswar",
      village: "Mendhasala",
      metadata: {},
    });
    expect(id).toBe("prop-1");
    expect(sb.from).toHaveBeenCalledWith("pid_properties");
  });
});