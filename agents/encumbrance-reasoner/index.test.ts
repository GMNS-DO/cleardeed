import { describe, expect, it } from "vitest";
import { reasonEncumbrance } from "./index";
import { computeEcFeeRs, feeLine, FEE_TABLE } from "./fee-schedule";

describe("EncumbranceReasoner", () => {
  it("does not invent district or SRO instructions when they are not verified", () => {
    const result = reasonEncumbrance({
      plotIdentifier: {
        district: "Not verified",
        tahasil: "Not verified",
        village: "Mendhasala",
        plotNo: "127",
      },
    });

    expect(result.status).toBe("manual_required");
    expect(result.instructions).toContain("Confirm the correct district and SRO");
    expect(result.instructions).not.toContain("Select District: Not verified");
    expect(result.instructions).not.toContain("SRO: Not verified");
  });

  it("does not treat tahasil as an SRO even when district and tahasil are known", () => {
    const result = reasonEncumbrance({
      plotIdentifier: {
        district: "Khordha",
        tahasil: "Bhubaneswar",
        village: "Mendhasala",
        plotNo: "127",
      },
    });

    expect(result.instructions).toContain("Confirm the correct district and SRO");
    expect(result.instructions).not.toContain("SRO: Bhubaneswar");
  });

  it("uses source-backed SRO values only when an SRO field is explicitly supplied", () => {
    const result = reasonEncumbrance({
      plotIdentifier: {
        district: "Khordha",
        tahasil: "Bhubaneswar",
        sro: "Bhubaneswar",
        village: "Mendhasala",
        plotNo: "127",
      },
    });

    expect(result.instructions).toContain("Select District: Khordha, SRO: Bhubaneswar");
  });
});

describe("FeeSchedule (DPR-ENC-003)", () => {
  it("EC instructions reference the typed fee schedule, not a hardcoded string", () => {
    const result = reasonEncumbrance({
      plotIdentifier: {
        district: "Khordha",
        tahasil: "Bhubaneswar",
        sro: "Bhubaneswar",
        village: "Mendhasala",
        plotNo: "127",
      },
    });
    // No hardcoded "₹100 - ₹500" string left over from V1
    expect(result.instructions).not.toContain("₹100 - ₹500");
    // Typed fee values are present
    expect(result.instructions).toContain("Rs. 30");
    expect(result.instructions).toContain("Rs. 5 per additional year");
  });

  it("EC fee for 30-year search = Rs.30 + (30-13) * Rs.5 = Rs.115", () => {
    expect(computeEcFeeRs(13)).toBe(30);
    expect(computeEcFeeRs(14)).toBe(35);
    expect(computeEcFeeRs(30)).toBe(115);
  });

  it("feeLine returns human-readable form", () => {
    expect(feeLine("IGRSL_EC_FEE_PER_13Y")).toBe("Rs. 30");
    expect(feeLine("IGRSL_EC_FEE_PER_EXTRA_YEAR")).toBe("Rs. 5 per additional year");
    expect(feeLine("IGR_STAMP_DUTY_RESIDENTIAL_MALE")).toBe("5%");
    expect(feeLine("IGR_STAMP_DUTY_RESIDENTIAL_FEMALE")).toBe("4%");
    expect(feeLine("IGR_REGISTRATION_FEE_PERCENT")).toBe("1%");
  });

  it("FEE_TABLE entries all have a lastVerified date", () => {
    for (const [key, entry] of Object.entries(FEE_TABLE)) {
      expect(entry.lastVerified, key).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(entry.source.length, key).toBeGreaterThan(0);
    }
  });
});
