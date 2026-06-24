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
  pidInsertPatternCandidate,
  pidUpsertPatternCandidateByKey,
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

  it("returns null (does not throw) on malformed artifactKey — honors non-blocking contract", async () => {
    // artifactKey must be 64 hex chars; passing a short non-hex value fails Zod validation.
    const id = await pidUpsertArtifact({
      artifactKey: "not-hex-too-short",
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

describe("pidInsertPatternCandidate (Sub-plan B Task B.2)", () => {
  const validCandidate = {
    candidateKey: "ROR-INS-180:abcdef0123456789",
    patternFamily: "lease_resumption",
    ruleVersion: "v1.5",
    metadata: {},
  };

  it("returns the inserted candidate id on success", async () => {
    const sb = makeMockSupabase(async () => ({ data: { id: "cand-1" }, error: null }));
    vi.mocked(supabaseAdmin).mockReturnValue(sb as never);
    const id = await pidInsertPatternCandidate(validCandidate);
    expect(id).toBe("cand-1");
    expect(sb.from).toHaveBeenCalledWith("pid_pattern_candidates");
  });

  it("returns null when supabase returns an error", async () => {
    const sb = makeMockSupabase(async () => ({
      data: null,
      error: { message: "duplicate key", code: "23505" },
    }));
    vi.mocked(supabaseAdmin).mockReturnValue(sb as never);
    const id = await pidInsertPatternCandidate(validCandidate);
    expect(id).toBeNull();
  });

  it("returns null (does not throw) on invalid input — non-blocking contract", async () => {
    const id = await pidInsertPatternCandidate({
      candidateKey: "", // invalid: empty
      patternFamily: "lease_resumption",
      ruleVersion: "v1.5",
      metadata: {},
    });
    expect(id).toBeNull();
  });

  it("uses snake_case keys in the Supabase payload", async () => {
    let captured: Record<string, unknown> | null = null;
    const sb = {
      from: vi.fn((_table: string) => ({
        insert: vi.fn((payload: Record<string, unknown>) => {
          captured = payload;
          return {
            select: vi.fn(() => ({
              single: vi.fn(async () => ({ data: { id: "x" }, error: null })),
            })),
          };
        }),
      })),
    };
    vi.mocked(supabaseAdmin).mockReturnValue(sb as never);
    await pidInsertPatternCandidate({
      ...validCandidate,
      evidenceCount: 5,
      reviewedExampleCount: 2,
    });
    expect(captured).not.toBeNull();
    expect(captured).toHaveProperty("candidate_key", validCandidate.candidateKey);
    expect(captured).toHaveProperty("pattern_family", "lease_resumption");
    expect(captured).toHaveProperty("evidence_count", 5);
    expect(captured).toHaveProperty("reviewed_example_count", 2);
    expect(captured).toHaveProperty("rule_version", "v1.5");
    // camelCase must NOT leak through
    expect(captured).not.toHaveProperty("candidateKey");
    expect(captured).not.toHaveProperty("evidenceCount");
  });
});

describe("pidUpsertPatternCandidateByKey (Sub-plan B Task B.2)", () => {
  const validCandidate = {
    candidateKey: "ROR-INS-180:abcdef0123456789",
    patternFamily: "lease_resumption",
    ruleVersion: "v1.5",
    metadata: {},
  };

  it("returns the upserted candidate id on success", async () => {
    const sb = makeMockSupabase(async () => ({ data: { id: "cand-2" }, error: null }));
    vi.mocked(supabaseAdmin).mockReturnValue(sb as never);
    const id = await pidUpsertPatternCandidateByKey(validCandidate);
    expect(id).toBe("cand-2");
    expect(sb.from).toHaveBeenCalledWith("pid_pattern_candidates");
  });

  it("returns null (does not throw) on invalid input", async () => {
    const id = await pidUpsertPatternCandidateByKey({
      ...validCandidate,
      evidenceCount: -3, // invalid
    });
    expect(id).toBeNull();
  });

  it("uses candidate_key as the onConflict target", async () => {
    let capturedOpts: unknown = null;
    const sb = {
      from: vi.fn((_table: string) => ({
        upsert: vi.fn((_payload: unknown, opts: unknown) => {
          capturedOpts = opts;
          return {
            select: vi.fn(() => ({
              single: vi.fn(async () => ({ data: { id: "x" }, error: null })),
            })),
          };
        }),
      })),
    };
    vi.mocked(supabaseAdmin).mockReturnValue(sb as never);
    await pidUpsertPatternCandidateByKey(validCandidate);
    expect(capturedOpts).toEqual({ onConflict: "candidate_key", ignoreDuplicates: false });
  });
});