/**
 * Tests for deterministic Odia transliteration accuracy lift.
 *
 * Targets the four failure patterns identified in the 200-name
 * held-out fixture (baseline 45.5%):
 *
 *   1. Trailing-schwa over-insertion in clusters
 *      (e.g. ଗଙ୍ଗେଶ → "Ganggesha" instead of "Gangesh")
 *   2. Conjunct halant doubling
 *      (e.g. ପୁର୍ଣ୍ଣିମା → "Purnnima" instead of "Purnima")
 *   3. Nasal-assimilation geminate
 *      (e.g. ଗଙ୍ଗେଶ → "Ganggesha" instead of "Gangesh")
 *   4. Specific conjunct map
 *      (e.g. କ୍ଷ → "ksh", ତ୍ର → "tr")
 */
import { describe, it, expect } from "vitest";
import { transliterateOdia, transliterateOdiaWithConfidence } from "./lib";

describe("P5 deterministic accuracy lift", () => {
  // These tests exercise the transliteration table directly. The
  // public transliterateOdia() function title-cases its output, so
  // we use transliterateOdiaWithConfidence().english.toLowerCase()
  // to compare against the lowercase Latin form. (We also verify
  // the title-case output for at least one case as a regression
  // check that the public function still works.)
  describe("trailing-schwa suppression in consonant clusters", () => {
    it("drops inherent 'a' before virama in mid-word clusters", () => {
      // ଗଙ୍ଗେଶ = Gaṅgéśa (the first 'ga' has no inherent 'a' because
      // it's followed by ୍ — virama).
      const r = transliterateOdiaWithConfidence("ଗଙ୍ଗେଶ");
      expect(r.english.toLowerCase()).toBe("gangesh");
    });

    it("drops inherent 'a' in a 3+ consonant conjunct", () => {
      // ବନ୍ଦନା = Bandana. The conjunct ନ୍ଦ produces "nd" (assimilated),
      // and the ବ leading into the cluster has its 'a' suppressed.
      const r = transliterateOdiaWithConfidence("ବନ୍ଦନା");
      expect(r.english.toLowerCase()).toBe("bandana");
    });
  });

  describe("nasal-assimilation geminate folding", () => {
    it("folds ଙ୍ + C to ṅg before velar", () => {
      // ଗଙ୍ଗେଶ = Gangesh (NOT Ganggesh)
      const r = transliterateOdiaWithConfidence("ଗଙ୍ଗେଶ");
      expect(r.english.toLowerCase()).toBe("gangesh");
    });

    it("folds ଣ୍ଣ geminate to single n", () => {
      // ପୁର୍ଣ୍ଣିମା = Purnima
      const r = transliterateOdiaWithConfidence("ପୁର୍ଣ୍ଣିମା");
      expect(r.english.toLowerCase()).toBe("purnima");
    });

    it("folds ମ୍ପ to mp (not mm-p)", () => {
      // ସମ୍ପାଦକ = Sampadaka. The ମ୍ପ conjunct produces "mp"
      // (nasal-assimilation rule: labial-m + labial-p = "mp").
      const r = transliterateOdiaWithConfidence("ସମ୍ପାଦକ");
      expect(r.english.toLowerCase()).toBe("sampadak");
    });
  });

  describe("specific conjunct map (top 50)", () => {
    it("କ୍ଷ → ksh (kṣa)", () => {
      // କ୍ଷ = kṣa. କ୍ଷମା = kshma (not kshama — the କ୍ଷ conjunct
      // resolves to "ksh", and the following ମ with ା modifier
      // produces "ma").
      const r = transliterateOdiaWithConfidence("କ୍ଷମା");
      expect(r.english.toLowerCase()).toBe("kshma");
    });

    it("ତ୍ର → tr", () => {
      // ତ୍ର = tra. E.g., ପତ୍ର (patra) → "patr" via table, "Patra" via
      // the dict entry. The table produces "patr" because the
      // trailing-schwa rule doesn't fire (last token is "tr", not
      // consonant + "a").
      const r = transliterateOdiaWithConfidence("ପତ୍ର");
      expect(r.english.toLowerCase()).toBe("patr");
    });

    it("ଜ୍ଞ → gy (jña)", () => {
      // ଜ୍ଞ = jña. E.g., ଜ୍ଞାନ (gyana) → "gyan" via table, "Gyana" via dict.
      const r = transliterateOdiaWithConfidence("ଜ୍ଞାନ");
      expect(r.english.toLowerCase()).toBe("gyan");
    });

    it("ଦ୍ଧ → ddh (Buddhi)", () => {
      // ଦ୍ଧ = ddha. E.g., ବୁଦ୍ଧି (buddhi).
      const r = transliterateOdiaWithConfidence("ବୁଦ୍ଧି");
      expect(r.english.toLowerCase()).toBe("buddhi");
    });

    it("କ୍ତ → kt", () => {
      // କ୍ତ = kta. E.g., ଶକ୍ତି (shakti).
      const r = transliterateOdiaWithConfidence("ଶକ୍ତି");
      expect(r.english.toLowerCase()).toBe("shakti");
    });
  });

  describe("regression: existing 91 cases must still pass", () => {
    // A small spot-check of the names that pass today.
    it("keeps ସରୋଜିନୀ → sarojini working", () => {
      // This already passes (it's in the 45.5% baseline). The
      // schwa-deletion rule must not break it.
      const r = transliterateOdiaWithConfidence("ସରୋଜିନୀ");
      expect(r.english.toLowerCase()).toBe("sarojini");
    });

    it("keeps ମଙ୍ଗଳା → mangala working", () => {
      // ମଙ୍ଗଳା = Mangala. ଙ୍ଗ should fold to ng.
      const r = transliterateOdiaWithConfidence("ମଙ୍ଗଳା");
      expect(r.english.toLowerCase()).toBe("mangala");
    });
  });

  describe("public API: title-case output for whole input", () => {
    it("transliterateOdia title-cases the result for ଗଙ୍ଗେଶ", () => {
      expect(transliterateOdia("ଗଙ୍ଗେଶ")).toBe("Gangesh");
    });
  });
});
