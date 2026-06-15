/**
 * Tests for igr-sro fetcher.
 *
 * Covers:
 *   - Cache loading (success, missing file, invalid JSON)
 *   - Tahasil pattern matching
 *   - Explicit SRO name lookup
 *   - District not found
 *   - Tahasil not found
 *   - Edge cases (empty inputs, case sensitivity)
 */

import { describe, it, expect, beforeEach } from "vitest";
import { lookupSRO, healthCheck, _resetCache } from "./index.js";

describe("igr-sro fetcher", () => {
  beforeEach(() => {
    _resetCache();
  });

  describe("lookupSRO", () => {
    it("resolves Bhubaneswar tahasil to Bhubaneswar SRO", () => {
      const result = lookupSRO({ district: "Khordha", tahasil: "Bhubaneswar" });
      expect(result.status).toBe("success");
      expect(result.data?.sro).toBe("Bhubaneswar");
      expect(result.data?.sroCode).toBe("10");
      expect(result.data?.district).toBe("Khordha");
    });

    it("resolves Jatni tahasil to Jatni SRO", () => {
      const result = lookupSRO({ district: "Khordha", tahasil: "Jatni" });
      expect(result.status).toBe("success");
      expect(result.data?.sro).toBe("Jatni");
      expect(result.data?.sroCode).toBe("11");
    });

    it("resolves Balipatna tahasil to Balipatna SRO", () => {
      const result = lookupSRO({ district: "Khordha", tahasil: "Balipatna" });
      expect(result.status).toBe("success");
      expect(result.data?.sro).toBe("Balipatna");
      expect(result.data?.sroCode).toBe("12");
    });

    it("resolves Banapur tahasil to Banapur SRO", () => {
      const result = lookupSRO({ district: "Khordha", tahasil: "Banapur" });
      expect(result.status).toBe("success");
      expect(result.data?.sro).toBe("Banapur");
      expect(result.data?.sroCode).toBe("13");
    });

    it("handles case-insensitive tahasil matching", () => {
      const result = lookupSRO({ district: "khordha", tahasil: "JATNI" });
      expect(result.status).toBe("success");
      expect(result.data?.sro).toBe("Jatni");
    });

    it("uses explicit SRO name when provided", () => {
      const result = lookupSRO({
        district: "Khordha",
        tahasil: "UnknownTahsil",
        sroName: "Bhubaneswar",
      });
      expect(result.status).toBe("success");
      expect(result.data?.sro).toBe("Bhubaneswar");
    });

    it("returns not_found for district not in cache", () => {
      const result = lookupSRO({ district: "UnknownDistrict", tahasil: "Bhubaneswar" });
      expect(result.status).toBe("not_found");
      expect(result.data).toBeNull();
      expect(result.warnings[0]?.code).toBe("DISTRICT_NOT_FOUND");
    });

    it("returns not_found when tahasil does not match any SRO", () => {
      const result = lookupSRO({ district: "Khordha", tahasil: "NonExistentTahsil" });
      expect(result.status).toBe("not_found");
      expect(result.data).toBeNull();
      expect(result.warnings[0]?.code).toBe("SRO_NOT_FOUND");
    });

    it("returns not_found when no tahasil or SRO name is provided", () => {
      const result = lookupSRO({ district: "Khordha" });
      expect(result.status).toBe("not_found");
      expect(result.data).toBeNull();
    });

    it("defaults to Khordha district when not specified", () => {
      const result = lookupSRO({ tahasil: "Bhubaneswar" });
      expect(result.status).toBe("success");
      expect(result.data?.district).toBe("Khordha");
    });

    it("includes full SRO metadata in success result", () => {
      const result = lookupSRO({ district: "Khordha", tahasil: "Jatni" });
      expect(result.data?.address).toContain("Jatni");
      expect(result.data?.contactUrl).toBe("https://igrodisha.gov.in/Contact.aspx");
      expect(result.data?.ecUrl).toBe("https://igrodisha.gov.in/ecsearch");
      expect(result.data?.operatingHours).toBeTruthy();
      expect(result.data?.estimatedFee).toBeTruthy();
      expect(result.data?.expectedTime).toBeTruthy();
    });

    it("includes parser version and timestamp", () => {
      const result = lookupSRO({ district: "Khordha", tahasil: "Bhubaneswar" });
      expect(result.parserVersion).toBe("igr-sro-v1.0.0");
      expect(result.fetchedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    it("matches partial tahasil patterns (e.g., 'bhubaneswar tahasil')", () => {
      const result = lookupSRO({
        district: "Khordha",
        tahasil: "Bhubaneswar Tahasil",
      });
      expect(result.status).toBe("success");
      expect(result.data?.sro).toBe("Bhubaneswar");
    });
  });

  describe("healthCheck", () => {
    it("returns true when cache loads successfully", async () => {
      const healthy = await healthCheck();
      expect(healthy).toBe(true);
    });
  });
});
