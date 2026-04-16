import { describe, it, expect } from "vitest";
import { buildResult } from "./index";
import fixture from "../fixtures/20.272688_85.701271.json";

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

  it("verification is 'manual_required' when village is absent", () => {
    const result = buildResult(
      { display_name: "Unknown", address: {} },
      "success"
    );
    expect(result.verification).toBe("manual_required");
  });
});