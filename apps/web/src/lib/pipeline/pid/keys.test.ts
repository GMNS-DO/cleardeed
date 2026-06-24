import { describe, it, expect } from "vitest";
import { computeArtifactKey } from "./keys";

describe("computeArtifactKey", () => {
  it("returns 64-char hex SHA-256", () => {
    const key = computeArtifactKey("bhulekh", { village: "Mendhasala", plot: 309 });
    expect(key).toMatch(/^[0-9a-f]{64}$/);
  });

  it("is deterministic for the same input", () => {
    const a = computeArtifactKey("bhulekh", { village: "Mendhasala", plot: 309 });
    const b = computeArtifactKey("bhulekh", { village: "Mendhasala", plot: 309 });
    expect(a).toBe(b);
  });

  it("produces different keys for different sourceIds", () => {
    const a = computeArtifactKey("bhulekh", { village: "Mendhasala", plot: 309 });
    const b = computeArtifactKey("bhunaksha", { village: "Mendhasala", plot: 309 });
    expect(a).not.toBe(b);
  });

  it("produces different keys for different inputs", () => {
    const a = computeArtifactKey("bhulekh", { village: "Mendhasala", plot: 309 });
    const b = computeArtifactKey("bhulekh", { village: "Mendhasala", plot: 415 });
    expect(a).not.toBe(b);
  });

  it("normalizes key order so {a:1,b:2} === {b:2,a:1}", () => {
    const a = computeArtifactKey("bhulekh", { a: 1, b: 2 });
    const b = computeArtifactKey("bhulekh", { b: 2, a: 1 });
    expect(a).toBe(b);
  });

  it("throws on empty sourceId", () => {
    expect(() => computeArtifactKey("", { x: 1 })).toThrow(/sourceId/);
  });
});
