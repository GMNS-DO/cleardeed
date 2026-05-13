import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fetch } from "./index";

describe("reraFetch", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns failed when no search input is provided", async () => {
    const result = await fetch({});
    expect(result.status).toBe("failed");
    expect(result.verification).toBe("error");
    expect(result.statusReason).toContain("No search input");
  });

  it("returns manual_required when searching by project name", async () => {
    const result = await fetch({ projectName: "Sunshine Enclave" });
    expect(result.status).toBe("partial");
    expect(result.verification).toBe("manual_required");
    expect(result.statusReason).toContain("project name");
    expect(result.statusReason).toContain("rera.odisha.gov.in");
  });

  it("returns manual_required when searching by registration number", async () => {
    const result = await fetch({ registrationNumber: "ORERA/2024/12345" });
    expect(result.status).toBe("partial");
    expect(result.verification).toBe("manual_required");
    expect(result.statusReason).toContain("registration number");
  });

  it("returns manual_required when searching by promoter name", async () => {
    const result = await fetch({ promoterName: "ABC Builders" });
    expect(result.status).toBe("partial");
    expect(result.verification).toBe("manual_required");
    expect(result.statusReason).toContain("promoter name");
  });

  it("includes search metadata with search type and query", async () => {
    const result = await fetch({ projectName: "Green Valley" });
    expect(result.data).toBeDefined();
    expect(result.data!.searchMetadata.searchType).toBe("project_name");
    expect(result.data!.searchMetadata.query).toBe("Green Valley");
  });

  it("includes attempt metadata with outcome and status reason", async () => {
    const result = await fetch({ promoterName: "XYZ Developers" });
    expect(result.attempts.length).toBeGreaterThan(0);
    expect(result.attempts[0].searchType).toBe("promoter_name");
    expect(result.attempts[0].query).toBe("XYZ Developers");
  });

  it("includes parser version in result", async () => {
    const result = await fetch({ projectName: "Test Project" });
    expect(result.parserVersion).toBe("rera-project-parser-v1");
  });

  it("includes raw artifact ref", async () => {
    const result = await fetch({ registrationNumber: "ORERA/2025/99999" });
    expect(result.rawArtifactRef).toBeDefined();
    expect(result.rawArtifactRef).toMatch(/^rera-manual-required-/);
  });

  it("healthCheck returns not-ok with reason", async () => {
    const { healthCheck } = await import("./index");
    const result = await healthCheck();
    expect(result.ok).toBe(false);
    expect(result.reason).toContain("not live-implemented");
  });
});