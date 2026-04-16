import { describe, it, expect } from "vitest";
import { KHRDHA_VILLAGES, findVillageByEnglish, getVillagesByTahasil } from "./villages";

describe("bhulekh villages", () => {
  it("has Khordha district villages", () => {
    expect(KHRDHA_VILLAGES.length).toBeGreaterThan(0);
  });

  it("finds Chandaka", () => {
    const v = findVillageByEnglish("Chandaka");
    expect(v).toBeDefined();
    expect(v?.tahasil).toBe("Bhubaneswar");
    expect(v?.riCircle).toBe("Chandaka");
  });

  it("filters villages by tahasil", () => {
    const bhubaneswarVillages = getVillagesByTahasil("Bhubaneswar");
    expect(bhubaneswarVillages.length).toBeGreaterThan(0);
    expect(bhubaneswarVillages.every((v) => v.tahasil === "Bhubaneswar")).toBe(true);
  });

  it("case insensitive lookup", () => {
    const v = findVillageByEnglish("chandaka");
    expect(v?.english).toBe("Chandaka");
  });
});