// apps/web/src/lib/pipeline/pid/record-fetch-result.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../db", () => ({ supabaseAdmin: vi.fn() }));
vi.mock("./client", () => ({
  pidUpsertArtifact: vi.fn(),
  pidInsertFactAssertion: vi.fn(),
  pidInsertEvent: vi.fn(),
  pidUpsertProperty: vi.fn(),
}));

import {
  pidUpsertArtifact,
  pidInsertFactAssertion,
  pidInsertEvent,
  pidUpsertProperty,
} from "./client";
import { recordFetchResult } from "./record-fetch-result";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("recordFetchResult", () => {
  it("returns null when mapper says no artifact and no facts (no_data)", async () => {
    const out = await recordFetchResult(
      "bhulekh",
      { village: "X" },
      {
        status: "no_data",
        sourceId: "bhulekh",
        input: { village: "X" },
        data: {},
        fetchedAt: "2026-06-25T10:00:00.000Z",
      }
    );
    expect(out).toBeNull();
    expect(pidUpsertArtifact).not.toHaveBeenCalled();
    expect(pidInsertFactAssertion).not.toHaveBeenCalled();
  });

  it("writes property before facts so subject_id is available", async () => {
    vi.mocked(pidUpsertProperty).mockResolvedValue("prop-1");
    vi.mocked(pidUpsertArtifact).mockResolvedValue("art-1");
    vi.mocked(pidInsertFactAssertion).mockResolvedValue("fact-1");
    vi.mocked(pidInsertEvent).mockResolvedValue("ev-1");

    const callOrder: string[] = [];
    vi.mocked(pidUpsertProperty).mockImplementation(async () => {
      callOrder.push("property");
      return "prop-1";
    });
    vi.mocked(pidInsertFactAssertion).mockImplementation(async () => {
      callOrder.push("fact");
      return "fact-1";
    });
    vi.mocked(pidInsertEvent).mockImplementation(async () => {
      callOrder.push("event");
      return "ev-1";
    });

    await recordFetchResult(
      "bhunaksha",
      { lat: 20.27, lon: 85.7 },
      {
        status: "ok",
        sourceId: "bhunaksha",
        input: { lat: 20.27, lon: 85.7 },
        data: { district: "Khordha", tahasil: "Bhubaneswar", village: "Mendhasala", plotNo: 309 },
        fetchedAt: "2026-06-25T10:00:00.000Z",
        rawArtifactHash: "a".repeat(64),
        rawArtifactPath: "raw/bhunaksha/mendhasala-309.html",
      }
    );

    expect(callOrder.indexOf("property")).toBeLessThan(callOrder.indexOf("fact"));
    expect(callOrder.indexOf("property")).toBeLessThan(callOrder.indexOf("event"));
  });

  it("returns the assembled ids on success", async () => {
    vi.mocked(pidUpsertProperty).mockResolvedValue("prop-1");
    vi.mocked(pidUpsertArtifact).mockResolvedValue("art-1");
    vi.mocked(pidInsertFactAssertion).mockResolvedValue("fact-1");
    vi.mocked(pidInsertEvent).mockResolvedValue("ev-1");

    const out = await recordFetchResult(
      "bhulekh",
      { village: "X" },
      {
        status: "ok",
        sourceId: "bhulekh",
        input: { village: "X" },
        data: { tenants: [{ name: "Ram" }] },
        fetchedAt: "2026-06-25T10:00:00.000Z",
        rawArtifactHash: "a".repeat(64),
        rawArtifactPath: "raw/bhulekh/x.html",
      }
    );

    expect(out).toEqual({
      artifactId: "art-1",
      factIds: ["fact-1"],
      eventId: "ev-1",
      propertyId: undefined,
    });
  });

  it("does not throw when pidUpsertProperty fails (non-blocking)", async () => {
    vi.mocked(pidUpsertProperty).mockResolvedValue(null);
    vi.mocked(pidUpsertArtifact).mockResolvedValue("art-1");
    vi.mocked(pidInsertFactAssertion).mockResolvedValue("fact-1");
    vi.mocked(pidInsertEvent).mockResolvedValue("ev-1");

    const out = await recordFetchResult(
      "bhulekh",
      { village: "X" },
      {
        status: "ok",
        sourceId: "bhulekh",
        input: { village: "X" },
        data: { tenants: [] },
        fetchedAt: "2026-06-25T10:00:00.000Z",
        rawArtifactHash: "a".repeat(64),
        rawArtifactPath: "raw/bhulekh/x.html",
      }
    );
    expect(out?.artifactId).toBe("art-1");
    expect(out?.propertyId).toBeUndefined();
  });

  it("bridges sourceId from the first arg into the mapper (whole-branch review regression)", async () => {
    vi.mocked(pidUpsertProperty).mockResolvedValue("prop-1");
    vi.mocked(pidUpsertArtifact).mockResolvedValue("art-1");
    vi.mocked(pidInsertFactAssertion).mockResolvedValue("fact-1");
    vi.mocked(pidInsertEvent).mockResolvedValue("ev-1");

    // The real SourceResult from the pipeline has `.source`, not `.sourceId`,
    // so the MapperInput's sourceId field is undefined at runtime. The
    // recordFetchResult fix must override that with the explicit sourceId
    // arg from the call site. We pass `sourceId: "WRONG"` on the mapper input
    // to verify the arg wins (not the mapper input field).
    await recordFetchResult(
      "bhulekh",
      { village: "X" },
      {
        status: "ok",
        // @ts-expect-error — intentionally wrong; the fix must override
        sourceId: "WRONG",
        input: { village: "X" },
        data: { tenants: [{ name: "Ram" }] },
        fetchedAt: "2026-06-25T10:00:00.000Z",
        rawArtifactHash: "a".repeat(64),
        rawArtifactPath: "raw/bhulekh/x.html",
      }
    );

    // pidInsertFactAssertion receives a fact whose sourceId came from the
    // mapper. The mapper must have been called with sourceId="bhulekh",
    // not "WRONG" and not undefined.
    const factCall = vi.mocked(pidInsertFactAssertion).mock.calls[0]?.[0];
    expect(factCall?.sourceId).toBe("bhulekh");
  });
});
