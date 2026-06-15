/**
 * Sprint V5a — IGR Odisha SRO (Sub-Registrar Office) contract tests.
 *
 * The SRO fetcher is a pure data lookup (no network call). The contract
 * validates that the lookup result has the right shape and that all 4 Khordha
 * SROs (Bhubaneswar, Jatni, Balipatna, Banapur) can be resolved from their
 * respective tahasils.
 */
import { describe, it, expect } from "vitest";
import { lookupSRO, healthCheck } from "../../packages/fetchers/igr-sro/src/index";
import { IgrSroContract, IgrSroDataSchema } from "../../apps/web/src/lib/pipeline/contracts/igr-sro";

describe("IGR SRO — structural correctness", () => {
  it("accepts a synthetic success case", () => {
    const synthetic = {
      source: "igr-sro",
      status: "ok" as const,
      data: {
        district: "Khordha",
        sro: "Bhubaneswar",
        sroCode: "10",
        address: "Sub-Registrar Office, Bhubaneswar, Khordha District, Odisha",
        contactUrl: "https://igrodisha.gov.in/Contact.aspx",
        ecUrl: "https://igrodisha.gov.in/ecsearch",
        operatingHours: "10:00 AM - 5:00 PM (Mon-Fri)",
        estimatedFee: "₹30 (certified copy) + ₹10 (search)",
        expectedTime: "2-5 working days for EC issuance",
        matchedTahasilPattern: "bhubaneswar",
      },
      fetchedAt: "2026-06-15T10:00:00.000Z",
      sourceUrl: "https://igrodisha.gov.in/",
      latencyMs: 5,
    };

    const result = IgrSroContract.safeParse(synthetic);
    expect(result.success).toBe(true);
  });

  it("accepts a synthetic no_data case (district not found)", () => {
    const synthetic = {
      source: "igr-sro",
      status: "no_data" as const,
      error: {
        code: "DISTRICT_NOT_FOUND",
        message: "District \"UnknownDistrict\" is not in the SRO cache.",
      },
      fetchedAt: "2026-06-15T10:00:00.000Z",
      sourceUrl: "https://igrodisha.gov.in/",
      latencyMs: 1,
    };

    const result = IgrSroContract.safeParse(synthetic);
    expect(result.success).toBe(true);
  });

  it("validates IgrSroDataSchema structure", () => {
    const valid = IgrSroDataSchema.safeParse({
      district: "Khordha",
      sro: "Jatni",
      sroCode: "11",
      address: "Sub-Registrar Office, Jatni, Khordha District, Odisha",
      contactUrl: "https://igrodisha.gov.in/Contact.aspx",
      ecUrl: "https://igrodisha.gov.in/ecsearch",
      operatingHours: "10:00 AM - 5:00 PM (Mon-Fri)",
      estimatedFee: "₹30 (certified copy) + ₹10 (search)",
      expectedTime: "2-5 working days for EC issuance",
    });
    expect(valid.success).toBe(true);
  });

  it("rejects malformed data (missing required fields)", () => {
    const invalid = IgrSroDataSchema.safeParse({
      district: "Khordha",
      sro: "Bhubaneswar",
      // Missing sroCode, address, etc.
    });
    expect(invalid.success).toBe(false);
  });
});

describe("IGR SRO — live fetcher behavior", () => {
  it("resolves all 4 Khordha SROs from their tahasils", () => {
    const expected: Array<{ tahasil: string; sro: string; sroCode: string }> = [
      { tahasil: "Bhubaneswar", sro: "Bhubaneswar", sroCode: "10" },
      { tahasil: "Jatni", sro: "Jatni", sroCode: "11" },
      { tahasil: "Balipatna", sro: "Balipatna", sroCode: "12" },
      { tahasil: "Banapur", sro: "Banapur", sroCode: "13" },
    ];

    for (const { tahasil, sro, sroCode } of expected) {
      const result = lookupSRO({ district: "Khordha", tahasil });
      expect(result.status).toBe("success");
      expect(result.data?.sro).toBe(sro);
      expect(result.data?.sroCode).toBe(sroCode);
    }
  });

  it("includes IGR Odisha portal URL in EC link", () => {
    const result = lookupSRO({ district: "Khordha", tahasil: "Bhubaneswar" });
    expect(result.data?.ecUrl).toBe("https://igrodisha.gov.in/ecsearch");
    expect(result.data?.contactUrl).toBe("https://igrodisha.gov.in/Contact.aspx");
  });

  it("includes operating hours and fee information", () => {
    const result = lookupSRO({ district: "Khordha", tahasil: "Jatni" });
    expect(result.data?.operatingHours).toBeTruthy();
    expect(result.data?.estimatedFee).toBeTruthy();
    expect(result.data?.expectedTime).toBeTruthy();
  });

  it("returns not_found for unknown tahasil", () => {
    const result = lookupSRO({ district: "Khordha", tahasil: "NonExistentTahsil" });
    expect(result.status).toBe("not_found");
    expect(result.data).toBeNull();
  });

  it("returns not_found for unsupported district", () => {
    const result = lookupSRO({ district: "UnknownDistrict", tahasil: "Bhubaneswar" });
    expect(result.status).toBe("not_found");
    expect(result.data).toBeNull();
  });

  it("healthCheck returns true when cache loads", async () => {
    const healthy = await healthCheck();
    expect(healthy).toBe(true);
  });
});
