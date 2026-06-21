import { describe, expect, it } from "vitest";
import { searchVillages, type Village } from "./villages";

const FIXTURE: Village[] = [
  { bhulekhVillageCode: "105", english: "Mendhasala", odia: "ମେଣ୍ଢାଶାଳ", tahasil: "Bhubaneswar", bhulekhTahasilCode: "2" },
  { bhulekhVillageCode: "106", english: "Mendri",     odia: "ମେଣ୍ଡରୀ",     tahasil: "Bhubaneswar", bhulekhTahasilCode: "2" },
  { bhulekhVillageCode: "200", english: "Chandaka",   odia: "ଚଣ୍ଡକ",         tahasil: "Bhubaneswar", bhulekhTahasilCode: "2" },
  { bhulekhVillageCode: "201", english: "",           odia: "ଅଗାଡ଼ିଆପଲୀ",        tahasil: "Bhubaneswar", bhulekhTahasilCode: "2" },
];

describe("searchVillages", () => {
  it("empty query returns the first N villages", () => {
    const out = searchVillages("", FIXTURE, 3);
    expect(out).toHaveLength(3);
    expect(out[0].bhulekhVillageCode).toBe("105");
  });

  it("exact-prefix on English ranks first", () => {
    const out = searchVillages("Men", FIXTURE, 10);
    expect(out.length).toBeGreaterThan(0);
    expect(out[0].english).toBe("Mendhasala");
    expect(out[0].bhulekhVillageCode).toBe("105");
  });

  it("substring match across English works", () => {
    const out = searchVillages("aka", FIXTURE, 10);
    expect(out.some((v) => v.english === "Chandaka")).toBe(true);
  });

  it("substring match across Odia works", () => {
    const out = searchVillages("ମେଣ", FIXTURE, 10);
    expect(out.length).toBe(2);
    expect(out.map((v) => v.bhulekhVillageCode).sort()).toEqual(["105", "106"]);
  });

  it("case-insensitive", () => {
    const out = searchVillages("mend", FIXTURE, 10);
    expect(out[0].english).toBe("Mendhasala");
  });

  it("token-split: 'Mend Sal' matches 'Mendhasala'", () => {
    const out = searchVillages("Mend Sal", FIXTURE, 10);
    expect(out.some((v) => v.english === "Mendhasala")).toBe(true);
  });

  it("token that doesn't match returns nothing", () => {
    const out = searchVillages("Mendxyz Sal", FIXTURE, 10);
    expect(out).toHaveLength(0);
  });

  it("matches Odia-only entries via Odia substring", () => {
    const out = searchVillages("ଅଗ", FIXTURE, 10);
    expect(out.some((v) => v.english === "")).toBe(true);
  });

  it("prefers English-name matches over Odia-only matches", () => {
    // Add an Odia-only entry that substring-matches "Mend"
    const extra: Village[] = [
      ...FIXTURE,
      { bhulekhVillageCode: "999", english: "", odia: "ମେଣ୍ଢ", tahasil: "Bhubaneswar", bhulekhTahasilCode: "2" },
    ];
    const out = searchVillages("Mend", extra, 10);
    expect(out[0].english).toBe("Mendhasala");
  });

  it("limit caps the result", () => {
    const out = searchVillages("M", FIXTURE, 1);
    expect(out).toHaveLength(1);
  });

  it("returns empty when input is empty", () => {
    expect(searchVillages("anything", [], 10)).toEqual([]);
  });
});