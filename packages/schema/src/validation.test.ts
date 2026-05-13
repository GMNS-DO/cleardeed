import { describe, expect, it } from "vitest";
import { matchOwnerName } from "./validation";

describe("shared owner name validation", () => {
  it("does not treat surname-only Odia matches as high-confidence identity matches", () => {
    const result = matchOwnerName("Mohapatra", "ବିକାଶ ଚନ୍ଦ୍ର ମୋହାପାତ୍ର");

    expect(result.matches).toBe(true);
    expect(result.confidence).toBe("medium");
    expect(result.score).toBeLessThanOrEqual(0.55);
    expect(result.method).toContain("single_token_ambiguous");
  });

  it("keeps full-name Odia surname evidence high confidence", () => {
    const result = matchOwnerName("Bikash Chandra Mohapatra", "ବିକାଶ ଚନ୍ଦ୍ର ମୋହାପାତ୍ର");

    expect(result.matches).toBe(true);
    expect(result.confidence).toBe("high");
    expect(result.method).toBe("odia_surname_map");
  });
});
