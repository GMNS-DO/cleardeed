import { describe, it, expect } from "vitest";
import {
  SourceArtifactSchema,
  FactAssertionInputSchema,
  EventInputSchema,
  PropertyInputSchema,
  PatternCandidateInputSchema,
  PATTERN_EVENT_TYPE,
  PATTERN_FACT_PREDICATE_PREFIX,
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

describe("PATTERN_EVENT_TYPE + PATTERN_FACT_PREDICATE_PREFIX constants", () => {
  it("uses literal values that the read paths can rely on", () => {
    expect(PATTERN_EVENT_TYPE).toBe("pattern_detected");
    expect(PATTERN_FACT_PREDICATE_PREFIX).toBe("pattern_fired:");
  });
});

describe("PatternCandidateInputSchema (Sub-plan B)", () => {
  const validInput = {
    candidateKey: "ROR-INS-180:abcdef0123456789",
    patternFamily: "lease_resumption",
    ruleVersion: "v1.5",
  };

  it("accepts a minimal valid candidate", () => {
    const ok = PatternCandidateInputSchema.safeParse(validInput);
    expect(ok.success).toBe(true);
    if (ok.success) {
      expect(ok.data.status).toBe("RAW_SIGNAL");
      expect(ok.data.evidenceCount).toBe(1);
      expect(ok.data.reviewedExampleCount).toBe(0);
      expect(ok.data.supportingEventIds).toEqual([]);
      expect(ok.data.supportingArtifactIds).toEqual([]);
      expect(ok.data.metadata).toEqual({});
    }
  });

  it("accepts an optional full candidate", () => {
    const ok = PatternCandidateInputSchema.safeParse({
      ...validInput,
      candidateName: "Patia industrial-lease to freehold",
      logicDescription: "Lease deed on Raiyati/Sthitiban khata",
      status: "CANDIDATE",
      evidenceCount: 5,
      reviewedExampleCount: 2,
      supportingEventIds: ["11111111-1111-1111-1111-111111111111"],
      supportingArtifactIds: ["22222222-2222-2222-2222-222222222222"],
      falsePositiveNotes: "Confirm IGR cross-check",
      metadata: { ruleId: "ROR-INS-180" },
    });
    expect(ok.success).toBe(true);
  });

  it("rejects empty candidateKey", () => {
    const bad = PatternCandidateInputSchema.safeParse({
      ...validInput,
      candidateKey: "",
    });
    expect(bad.success).toBe(false);
  });

  it("rejects missing candidateKey", () => {
    const { candidateKey, ...rest } = validInput;
    void candidateKey;
    const bad = PatternCandidateInputSchema.safeParse(rest);
    expect(bad.success).toBe(false);
  });

  it("rejects negative evidenceCount", () => {
    const bad = PatternCandidateInputSchema.safeParse({
      ...validInput,
      evidenceCount: -1,
    });
    expect(bad.success).toBe(false);
  });

  it("rejects unknown status enum", () => {
    const bad = PatternCandidateInputSchema.safeParse({
      ...validInput,
      status: "PROMOTED",
    });
    expect(bad.success).toBe(false);
  });

  it("rejects non-uuid in supportingEventIds", () => {
    const bad = PatternCandidateInputSchema.safeParse({
      ...validInput,
      supportingEventIds: ["not-a-uuid"],
    });
    expect(bad.success).toBe(false);
  });
});
