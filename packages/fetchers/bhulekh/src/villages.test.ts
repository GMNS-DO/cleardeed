import { describe, it, expect } from "vitest";
import {
  KHRDHA_VILLAGES,
  KHRDHA_TAHASIL_CODES,
  findVillageByEnglish,
  findVillageByEnglishWithTahasil,
  findVillageByOdia,
  findVillageByCode,
  getVillagesByTahasil,
  getDirectoryStats,
} from "./villages";

describe("bhulekh villages", () => {
  it("has Khordha district villages", () => {
    expect(KHRDHA_VILLAGES.length > 0).toBe(true);
  });

  it("finds Chandaka", () => {
    const v = findVillageByEnglish("Chandaka");
    expect(v).toBeDefined();
    expect(v?.tahasil).toBe("Bhubaneswar");
    expect(v?.riCircle).toBe("Chandaka");
  });

  it("filters villages by tahasil", () => {
    const bhubaneswarVillages = getVillagesByTahasil("Bhubaneswar");
    expect(bhubaneswarVillages.length > 100).toBe(true);
    expect(bhubaneswarVillages.every((v) => v.tahasil === "Bhubaneswar")).toBe(true);
  });

  it("case insensitive lookup", () => {
    const v = findVillageByEnglish("chandaka");
    expect(v?.english).toBe("Chandaka");
  });

  it("covers all 10 Khordha tahasils", () => {
    expect(Object.keys(KHRDHA_TAHASIL_CODES)).toHaveLength(10);
    for (const code of Object.keys(KHRDHA_TAHASIL_CODES)) {
      const t = KHRDHA_TAHASIL_CODES[code];
      const villages = getVillagesByTahasil(t);
      expect(villages.length > 0).toBe(true);
    }
  });

  it("finds Mendhasala by Odia", () => {
    const v = findVillageByOdia("ମେଣ୍ଢାଶାଳ");
    expect(v).toBeDefined();
    expect(v?.english).toBe("Mendhasala");
    expect(v?.bhulekhVillageCode).toBe("105");
  });

  it("finds Mendhasala by Bhulekh code", () => {
    const v = findVillageByCode("2", "105");
    expect(v?.english).toBe("Mendhasala");
  });

  it("disambiguates by tahasil", () => {
    const bal = findVillageByEnglishWithTahasil("Ranapur", "Balianta");
    expect(bal?.bhulekhTahasilCode).toBe("8");
  });

  it("marks not-digitized villages", () => {
    const sangram = findVillageByEnglish("Sangram");
    expect(sangram?.notDigitized).toBe(true);
  });

  it("exposes directory stats with probed-at timestamp", () => {
    const stats = getDirectoryStats();
    expect(stats.authoritative > 1000).toBe(true);
    expect(stats.total > 1000).toBe(true);
    expect(stats.authoritativeProbedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("Bhulekh dropdown is predominantly Odia-script (matches live site)", () => {
    const stats = getDirectoryStats();
    expect(stats.odiaOnly / stats.total).toBeGreaterThan(0.8);
  });
});
