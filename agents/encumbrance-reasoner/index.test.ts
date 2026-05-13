import { describe, expect, it } from "vitest";
import { reasonEncumbrance } from "./index";

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
