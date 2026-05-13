import { describe, it, expect, vi, afterEach } from "vitest";
import { buildResult, nominatimFetch } from "./index";
import fixture from "../fixtures/20.272688_85.701271.json";

const originalFetch = globalThis.fetch;

afterEach(() => {
  vi.restoreAllMocks();
  globalThis.fetch = originalFetch;
});

describe("nominatim fetcher", () => {
  it("buildResult parses fixture correctly", () => {
    const result = buildResult(fixture as { display_name: string; address: Record<string, string> }, "success");
    expect(result.source).toBe("nominatim");
    expect(result.status).toBe("success");
    expect(result.data.village).toBe("Chandaka");
    expect(result.data.district).toBe("Khordha");
    expect(result.data.state).toBe("Odisha");
    expect(result.data.postcode).toBe("752054");
  });

  it("verification is 'verified' when village is present", () => {
    const result = buildResult(fixture as { display_name: string; address: Record<string, string> }, "success");
    expect(result.verification).toBe("verified");
  });

  it("populates basic provenance metadata", () => {
    const result = buildResult(
      fixture as { display_name: string; address: Record<string, string> },
      "success",
      {
        attempts: 1,
        inputsTried: [{ label: "reverse_geocode", input: { gps: { lat: 20.272688, lon: 85.701271 } } }],
      }
    );

    expect(result.statusReason).toBe("address_resolved");
    expect(result.attempts).toBe(1);
    expect(result.inputsTried).toHaveLength(1);
    expect(result.parserVersion).toBe("nominatim-parser-v1");
    expect(result.rawArtifactHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("verification is 'manual_required' when village is absent", () => {
    const result = buildResult(
      { display_name: "Unknown", address: {} },
      "success"
    );
    expect(result.verification).toBe("manual_required");
    expect(result.statusReason).toBe("address_incomplete");
  });

  it("downgrades verification when village exists but district/state validation is missing", () => {
    const result = buildResult(
      { display_name: "Village only", address: { village: "Mendhasala" } },
      "success"
    );

    expect(result.verification).toBe("manual_required");
    expect(result.statusReason).toBe("address_resolved_with_warnings");
    expect(result.validators).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "district_is_khordha", status: "warning" }),
        expect.objectContaining({ name: "state_is_odisha", status: "warning" }),
      ])
    );
  });

  it("retries transient failures and records attempt metadata", async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error("fetch failed: transient network"))
      .mockResolvedValueOnce({
        ok: true,
        json: async () => fixture,
      });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const result = await nominatimFetch({
      gps: { lat: 20.272689, lon: 85.701272 },
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.attempts).toBe(2);
    expect(result.validators).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "retry_attempts_recorded",
          status: "passed",
        }),
      ])
    );
  });

  it("preserves original source fetch timestamp when serving from cache", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => fixture,
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const gps = { lat: 20.272691, lon: 85.701274 };
    const first = await nominatimFetch({ gps });
    const second = await nominatimFetch({ gps });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(second.statusReason).toBe("cache_hit");
    expect(second.fetchedAt).toBe(first.fetchedAt);
    expect(second.data.sourceFetchedAt).toBe(first.fetchedAt);
    expect(second.data.cacheServedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});
