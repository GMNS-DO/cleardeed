import { describe, it, expect } from "vitest";
import { mapSourceResultToPid } from "./mapper";

describe("mapSourceResultToPid", () => {
  it("returns empty payload for no_data status", () => {
    const result = mapSourceResultToPid({
      status: "no_data",
      sourceId: "bhulekh",
      input: { village: "Mendhasala", plot: 309 },
      data: {},
      fetchedAt: "2026-06-25T10:00:00.000Z",
    });
    expect(result.artifact).toBeUndefined();
    expect(result.facts).toEqual([]);
    expect(result.events).toEqual([]);
  });

  it("returns empty payload for source_down status", () => {
    const result = mapSourceResultToPid({
      status: "source_down",
      sourceId: "bhulekh",
      input: { village: "Mendhasala" },
      data: {},
      fetchedAt: "2026-06-25T10:00:00.000Z",
    });
    expect(result.facts).toEqual([]);
  });

  it("builds artifact from rawArtifactHash + rawArtifactPath", () => {
    const result = mapSourceResultToPid({
      status: "ok",
      sourceId: "bhulekh",
      input: { village: "Mendhasala", plot: 309 },
      data: { tenants: [] },
      fetchedAt: "2026-06-25T10:00:00.000Z",
      rawArtifactHash: "a".repeat(64),
      rawArtifactPath: "raw/bhulekh/mendhasala-309.html",
      rawContentType: "text/html",
      rawByteSize: 4096,
    });
    expect(result.artifact?.sha256).toBe("a".repeat(64));
    expect(result.artifact?.storagePath).toBe("raw/bhulekh/mendhasala-309.html");
    expect(result.artifact?.artifactType).toBe("html");
  });

  it("emits no artifact when rawArtifactHash is missing (in-memory only)", () => {
    const result = mapSourceResultToPid({
      status: "ok",
      sourceId: "bhulekh",
      input: { village: "Mendhasala" },
      data: { tenants: [] },
      fetchedAt: "2026-06-25T10:00:00.000Z",
    });
    expect(result.artifact).toBeUndefined();
  });

  it("emits property fact when data has district/tahasil/village", () => {
    const result = mapSourceResultToPid({
      status: "ok",
      sourceId: "bhunaksha",
      input: { lat: 20.27, lon: 85.70 },
      data: {
        village: "Mendhasala",
        tahasil: "Bhubaneswar",
        district: "Khordha",
        plotNo: 309,
      },
      fetchedAt: "2026-06-25T10:00:00.000Z",
    });
    expect(result.property?.district).toBe("Khordha");
    expect(result.property?.village).toBe("Mendhasala");
  });

  it("emits owner_name fact from bhulekh data.tenants[0].name", () => {
    const result = mapSourceResultToPid({
      status: "ok",
      sourceId: "bhulekh",
      input: { village: "Mendhasala", plot: 309 },
      data: {
        tenants: [{ name: "Ram Kumar" }, { name: "Sita Devi" }],
      },
      fetchedAt: "2026-06-25T10:00:00.000Z",
    });
    const ownerFacts = result.facts.filter((f) => f.predicate === "owner_name");
    expect(ownerFacts).toHaveLength(2);
    expect(ownerFacts[0]?.rawValue).toBe("Ram Kumar");
  });

  it("emits a fetch event for every successful fetch", () => {
    const result = mapSourceResultToPid({
      status: "ok",
      sourceId: "nominatim",
      input: { lat: 20.27, lon: 85.70 },
      data: { displayName: "Mendhasala, Bhubaneswar" },
      fetchedAt: "2026-06-25T10:00:00.000Z",
    });
    expect(result.events).toHaveLength(1);
    expect(result.events[0]?.eventType).toBe("fetch_completed");
    expect(result.events[0]?.sourceId).toBe("nominatim");
  });
});