import { describe, it, expect } from "vitest";
import {
  SourceArtifactSchema,
  FactAssertionInputSchema,
  EventInputSchema,
  PropertyInputSchema,
} from "./types";

describe("SourceArtifactSchema", () => {
  it("accepts a valid bhulekh artifact", () => {
    const ok = SourceArtifactSchema.safeParse({
      artifactKey: "a".repeat(64),
      sourceId: "bhulekh",
      artifactType: "html",
      storagePath: "pid-artifacts/bhulekh/aabb.html",
      sha256: "b".repeat(64),
      contentType: "text/html",
      byteSize: 12345,
      httpStatus: 200,
      query: { village: "Mendhasala", plot: 309 },
    });
    expect(ok.success).toBe(true);
  });

  it("rejects artifactKey that is not 64 hex chars", () => {
    const bad = SourceArtifactSchema.safeParse({
      artifactKey: "short",
      sourceId: "bhulekh",
      artifactType: "html",
      storagePath: "x",
      sha256: "b".repeat(64),
    });
    expect(bad.success).toBe(false);
  });

  it("rejects unknown sourceId", () => {
    const bad = SourceArtifactSchema.safeParse({
      artifactKey: "a".repeat(64),
      sourceId: "made-up-source",
      artifactType: "html",
      storagePath: "x",
      sha256: "b".repeat(64),
    });
    expect(bad.success).toBe(false);
  });
});

describe("FactAssertionInputSchema", () => {
  it("requires subject_type, predicate, source_id", () => {
    const ok = FactAssertionInputSchema.safeParse({
      subjectType: "property",
      subjectId: "11111111-1111-1111-1111-111111111111",
      predicate: "owner_name",
      rawValue: "Ram Kumar",
      sourceId: "bhulekh",
    });
    expect(ok.success).toBe(true);
  });

  it("rejects when subject_id is not a uuid", () => {
    const bad = FactAssertionInputSchema.safeParse({
      subjectType: "property",
      subjectId: "not-a-uuid",
      predicate: "owner_name",
      sourceId: "bhulekh",
    });
    expect(bad.success).toBe(false);
  });
});

describe("EventInputSchema", () => {
  it("accepts event without propertyId (lead-only signal)", () => {
    const ok = EventInputSchema.safeParse({
      eventType: "lead_signal",
      sourceId: "bhulekh",
      eventSummary: "raw text signal in OCR chunk",
    });
    expect(ok.success).toBe(true);
  });
});

describe("PropertyInputSchema", () => {
  it("accepts a minimal property", () => {
    const ok = PropertyInputSchema.safeParse({
      district: "Khordha",
      tahasil: "Bhubaneswar",
      village: "Mendhasala",
    });
    expect(ok.success).toBe(true);
  });
});
