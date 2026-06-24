import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock supabaseAdmin BEFORE importing the module under test
vi.mock("../../db", () => ({
  supabaseAdmin: vi.fn(),
}));

vi.mock("./client", () => ({
  pidInsertPatternCandidate: vi.fn(),
  pidUpsertPatternCandidateByKey: vi.fn(),
  pidInsertEvent: vi.fn(),
  pidInsertFactAssertion: vi.fn(),
}));

import { supabaseAdmin } from "../../db";
import {
  pidInsertPatternCandidate,
  pidUpsertPatternCandidateByKey,
  pidInsertEvent,
  pidInsertFactAssertion,
} from "./client";
import { recordPatternFires } from "./record-pattern-fires";
import type { Insight } from "@cleardeed/consumer-report-writer";

function makeInsight(overrides: Partial<Insight> = {}): Insight {
  return {
    panel: "land",
    issueLens: "title_chain",
    evidenceStrength: "document_anchor",
    source: "bhulekh:ror:page-1",
    severity: "redFlag",
    headline: "Patia lease red flag",
    body: "Body",
    actionItem: "Action",
    ruleId: "ROR-INS-180",
    ...overrides,
  };
}

const baseRuleInput = {
  ror: {
    page1: {
      khatiyanNumber: "830",
      village: "Mendhasala",
      tahasil: "Bhubaneswar",
      tenant: { name: "Ram Kumar" },
    },
    page2: { selectedPlotNumber: "309" },
  },
  claimedOwnerName: "Ram Kumar",
  tehsil: "Bhubaneswar",
  village: "Mendhasala",
  plotGPS: { lat: 20.272688, lon: 85.701271 },
};

function makePreReadMock(existingKeys: string[]) {
  return {
    from: vi.fn((_table: string) => ({
      select: vi.fn((_cols: string) => ({
        in: vi.fn((_col: string, keys: string[]) => {
          // Pre-read returns the intersection of the requested keys and
          // existing keys. The test fixtures control what's in `existingKeys`.
          const filtered = existingKeys.filter((k) => keys.includes(k));
          return Promise.resolve({ data: filtered.map((k) => ({ candidate_key: k })), error: null });
        }),
      })),
    })),
  };
}

function makePreReadFailingMock() {
  return {
    from: vi.fn((_table: string) => ({
      select: vi.fn(() => ({
        in: vi.fn(() => Promise.resolve({ data: null, error: { message: "boom" } })),
      })),
    })),
  };
}

const savedEnv = { ...process.env };

beforeEach(() => {
  vi.clearAllMocks();
  // Default: kill switch ON for these tests
  process.env.PID_RECORDING_ENABLED = "true";
});

afterEach(() => {
  process.env = { ...savedEnv };
});

describe("recordPatternFires — kill switch", () => {
  it("returns null when PID_RECORDING_ENABLED is unset", async () => {
    delete process.env.PID_RECORDING_ENABLED;
    const result = await recordPatternFires({
      insights: [makeInsight()],
      ctx: { reportId: "r1", ruleInput: baseRuleInput },
    });
    expect(result).toBeNull();
    expect(pidInsertPatternCandidate).not.toHaveBeenCalled();
  });

  it("returns null when PID_RECORDING_ENABLED is false", async () => {
    process.env.PID_RECORDING_ENABLED = "false";
    const result = await recordPatternFires({
      insights: [makeInsight()],
      ctx: { reportId: "r1", ruleInput: baseRuleInput },
    });
    expect(result).toBeNull();
  });

  it("returns null when insights array is empty", async () => {
    const result = await recordPatternFires({
      insights: [],
      ctx: { reportId: "r1", ruleInput: baseRuleInput },
    });
    expect(result).toBeNull();
  });
});

describe("recordPatternFires — insert vs upsert path", () => {
  it("first time: pre-read returns empty → calls pidInsertPatternCandidate", async () => {
    vi.mocked(supabaseAdmin).mockReturnValue(makePreReadMock([]) as never);
    vi.mocked(pidInsertPatternCandidate).mockResolvedValue("cand-1");
    vi.mocked(pidInsertEvent).mockResolvedValue("ev-1");
    vi.mocked(pidInsertFactAssertion).mockResolvedValue("fact-1");

    const result = await recordPatternFires({
      insights: [makeInsight()],
      ctx: { reportId: "r1", propertyId: "p1", ruleInput: baseRuleInput },
    });

    expect(pidInsertPatternCandidate).toHaveBeenCalledTimes(1);
    expect(pidUpsertPatternCandidateByKey).not.toHaveBeenCalled();
    expect(pidInsertEvent).toHaveBeenCalledTimes(1);
    expect(pidInsertFactAssertion).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      candidateIds: ["cand-1"],
      eventIds: ["ev-1"],
      factIds: ["fact-1"],
      ok: true,
    });
  });

  it("repeat time: pre-read returns existing key → calls pidUpsertPatternCandidateByKey", async () => {
    // Compute the candidateKey the mapper will produce
    const insight = makeInsight();
    const expectedKey = `ROR-INS-180:${"0".repeat(16)}`; // we'll let the test compute the real one
    void expectedKey;

    // We need the actual key. Build it via the same logic.
    // Easier: pre-read on whatever the mapper returns. We can spy on
    // pidInsertPatternCandidate to capture the candidateKey argument, then
    // arrange the pre-read to include it. For now, hardcode by using a
    // deterministic ruleInput.
    vi.mocked(supabaseAdmin).mockReturnValue(makePreReadMock([]) as never);
    vi.mocked(pidInsertPatternCandidate).mockImplementation(async (c) => {
      // Capture the candidateKey for the pre-read setup of the next call
      return "cand-1";
    });
    vi.mocked(pidInsertEvent).mockResolvedValue("ev-1");
    vi.mocked(pidInsertFactAssertion).mockResolvedValue("fact-1");

    // Run once to capture the candidateKey
    await recordPatternFires({
      insights: [insight],
      ctx: { reportId: "r1", ruleInput: baseRuleInput },
    });
    const capturedCandidate = vi.mocked(pidInsertPatternCandidate).mock
      .calls[0]?.[0] as { candidateKey: string } | undefined;
    expect(capturedCandidate).toBeDefined();
    const realKey = capturedCandidate!.candidateKey;

    // Now run again with the pre-read reporting the key as already existing
    vi.clearAllMocks();
    process.env.PID_RECORDING_ENABLED = "true";
    vi.mocked(supabaseAdmin).mockReturnValue(makePreReadMock([realKey]) as never);
    vi.mocked(pidUpsertPatternCandidateByKey).mockResolvedValue("cand-1");
    vi.mocked(pidInsertEvent).mockResolvedValue("ev-1");
    vi.mocked(pidInsertFactAssertion).mockResolvedValue("fact-1");

    const result = await recordPatternFires({
      insights: [makeInsight()],
      ctx: { reportId: "r2", ruleInput: baseRuleInput },
    });

    expect(pidInsertPatternCandidate).not.toHaveBeenCalled();
    expect(pidUpsertPatternCandidateByKey).toHaveBeenCalledTimes(1);
    expect(result?.ok).toBe(true);
  });

  it("falls back to upsert when insert returns null (race condition)", async () => {
    vi.mocked(supabaseAdmin).mockReturnValue(makePreReadMock([]) as never);
    vi.mocked(pidInsertPatternCandidate)
      .mockResolvedValueOnce(null) // first call: race-lost
      .mockResolvedValueOnce("never");
    vi.mocked(pidUpsertPatternCandidateByKey).mockResolvedValue("cand-2");
    vi.mocked(pidInsertEvent).mockResolvedValue("ev-2");
    vi.mocked(pidInsertFactAssertion).mockResolvedValue("fact-2");

    const result = await recordPatternFires({
      insights: [makeInsight()],
      ctx: { reportId: "r1", ruleInput: baseRuleInput },
    });

    expect(pidInsertPatternCandidate).toHaveBeenCalledTimes(1);
    expect(pidUpsertPatternCandidateByKey).toHaveBeenCalledTimes(1);
    expect(result?.candidateIds).toEqual(["cand-2"]);
    expect(result?.ok).toBe(true);
  });
});

describe("recordPatternFires — failure handling", () => {
  it("pre-read failure does not block the write path (returns empty existing set → insert path)", async () => {
    vi.mocked(supabaseAdmin).mockReturnValue(makePreReadFailingMock() as never);
    vi.mocked(pidInsertPatternCandidate).mockResolvedValue("cand-1");
    vi.mocked(pidInsertEvent).mockResolvedValue("ev-1");
    vi.mocked(pidInsertFactAssertion).mockResolvedValue("fact-1");

    const result = await recordPatternFires({
      insights: [makeInsight()],
      ctx: { reportId: "r1", ruleInput: baseRuleInput },
    });

    // Insert path (not upsert) because the failed pre-read is treated as
    // "no existing keys" — conservative + non-blocking.
    expect(pidInsertPatternCandidate).toHaveBeenCalledTimes(1);
    expect(result?.ok).toBe(true);
  });

  it("returns ok:false when an insert returns null, never throws", async () => {
    vi.mocked(supabaseAdmin).mockReturnValue(makePreReadMock([]) as never);
    vi.mocked(pidInsertPatternCandidate).mockResolvedValue(null);
    vi.mocked(pidUpsertPatternCandidateByKey).mockResolvedValue(null);
    vi.mocked(pidInsertEvent).mockResolvedValue("ev-1");
    vi.mocked(pidInsertFactAssertion).mockResolvedValue("fact-1");

    const result = await recordPatternFires({
      insights: [makeInsight()],
      ctx: { reportId: "r1", ruleInput: baseRuleInput },
    });

    expect(result).not.toBeNull();
    expect(result?.candidateIds).toEqual([]);
    expect(result?.ok).toBe(false);
  });

  it("never throws out — a thrown insert becomes ok:false", async () => {
    vi.mocked(supabaseAdmin).mockReturnValue(makePreReadMock([]) as never);
    vi.mocked(pidInsertPatternCandidate).mockRejectedValue(new Error("network"));
    vi.mocked(pidInsertEvent).mockResolvedValue("ev-1");
    vi.mocked(pidInsertFactAssertion).mockResolvedValue("fact-1");

    // Should not throw
    const result = await recordPatternFires({
      insights: [makeInsight()],
      ctx: { reportId: "r1", ruleInput: baseRuleInput },
    });

    expect(result).not.toBeNull();
    expect(result?.ok).toBe(false);
    expect(result?.candidateIds).toEqual([]);
  });
});

describe("recordPatternFires — all-positive or all-stub insights", () => {
  it("returns null when no candidates survive the buildPatternPayload filters", async () => {
    const stubInsight = makeInsight({
      ruleId: "ROR-INS-180",
      evidenceStrength: "parser_uncertain",
    });
    const result = await recordPatternFires({
      insights: [stubInsight],
      ctx: { reportId: "r1", ruleInput: baseRuleInput },
    });
    expect(result).toBeNull();
    expect(pidInsertPatternCandidate).not.toHaveBeenCalled();
    expect(pidInsertEvent).not.toHaveBeenCalled();
    expect(pidInsertFactAssertion).not.toHaveBeenCalled();
  });
});
