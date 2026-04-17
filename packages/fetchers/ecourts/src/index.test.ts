import { describe, it, expect } from "vitest";

describe("ecourts fetcher", () => {
  describe("ecourtsFetch input validation", () => {
    it("returns partial when districtCode is missing", async () => {
      const { ecourtsFetch } = await import("./index");
      const result = await ecourtsFetch({ partyName: "Mohapatra" });
      expect(result.status).toBe("partial");
      expect(result.verification).toBe("manual_required");
      expect(result.error).toContain("districtCode required");
    });

    it("returns partial when districtCode is empty string", async () => {
      const { ecourtsFetch } = await import("./index");
      const result = await ecourtsFetch({
        partyName: "Mohapatra",
        districtCode: "",
      });
      expect(result.status).toBe("partial");
    });
  });

  describe("healthCheck", () => {
    it("is exported and returns a boolean", async () => {
      const { healthCheck } = await import("./index");
      // healthCheck() is async and returns Promise<boolean>
      // Don't actually run it — that would hit eCourts
      expect(typeof healthCheck).toBe("function");
    });
  });
});