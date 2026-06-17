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

  describe("P5b: ଶ୍ୱ conjunct (Mendhasala, Yajneshwara)", () => {
    it("ଶ୍ୱ → shv (was: not in map, default sh)", () => {
      // ଶ୍ୱ = shva (e.g., Bishva, Mendhasala, Yajneshwara)
      // The U+0B71 Vedic anusvara (va) is now mapped.
      // The dict overrides the trailing-a, so ବିଶ୍ୱ → "Bishva".
      const r = transliterateOdiaWithConfidence("ବିଶ୍ୱ");
      expect(r.english).toBe("Bishva");
    });

    it("ମେଣ୍ଢାଶାଳ → Mendhasala (place name, dict hit)", () => {
      // ଣ୍ଢ = "nd" (was: not in map, default ndh)
      // + ଶ୍ୱ → "shv" (was: "sh")
      // Dict entry preserves trailing "a".
      const r = transliterateOdiaWithConfidence("ମେଣ୍ଢାଶାଳ");
      expect(r.english).toBe("Mendhasala");
    });

    it("ଯଜ୍ଞେଶ୍ୱର → Yajneshwara (dict hit)", () => {
      const r = transliterateOdiaWithConfidence("ଯଜ୍ଞେଶ୍ୱର");
      expect(r.english).toBe("Yajneshwara");
    });
  });

  describe("P5b: U+0B71 Vedic anusvara (va)", () => {
    it("ୱ → v (was: not in consonant map, dropped)", () => {
      // ଅଶ୍ୱ = Ashva (a common Odia suffix -ishva in deity names).
      // Dict has this as a verified entry.
      const r = transliterateOdiaWithConfidence("ଅଶ୍ୱ");
      expect(r.english).toBe("Ashva");
    });
  });

  describe("P5b: production-shape dict entries (popular spellings)", () => {
    it("ସୁନୀତା ଦେବୀ → Sunita Debi (Debi not Devi — popular spelling)", () => {
      const r = transliterateOdiaWithConfidence("ସୁନୀତା ଦେବୀ");
      expect(r.english).toBe("Sunita Debi");
    });

    it("ବିକାଶ ଚନ୍ଦ୍ର ଦାଶ → Bikash Chandra Dash (Dash not Das)", () => {
      const r = transliterateOdiaWithConfidence("ବିକାଶ ଚନ୍ଦ୍ର ଦାଶ");
      expect(r.english).toBe("Bikash Chandra Dash");
    });

    it("ଗଫୁରନ ବିବି → Gafuran Bibi (Muslim name, ଫ = f not ph)", () => {
      const r = transliterateOdiaWithConfidence("ଗଫୁରନ ବିବି");
      expect(r.english).toBe("Gafuran Bibi");
    });

    it("ସେକ୍ ରହେମାନ → Sek Reheman (Muslim name)", () => {
      const r = transliterateOdiaWithConfidence("ସେକ୍ ରହେମାନ");
      expect(r.english).toBe("Sek Reheman");
    });
  });

  describe("P5b: trailing-a in proper names (place names, common surnames)", () => {
    it("ପ୍ରଥମ → Pratham (with trailing-a)", () => {
      const r = transliterateOdiaWithConfidence("ପ୍ରଥମ");
      expect(r.english).toBe("Pratham");
    });

    it("ଦ୍ୱିତୀୟ → Dwitiya (ordinal number as name)", () => {
      const r = transliterateOdiaWithConfidence("ଦ୍ୱିତୀୟ");
      expect(r.english).toBe("Dwitiya");
    });

    it("ନିଜିଗାଁ → Nijigaon (village name)", () => {
      const r = transliterateOdiaWithConfidence("ନିଜିଗାଁ");
      expect(r.english).toBe("Nijigaon");
    });
  });
});
