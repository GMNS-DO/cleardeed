import { describe, it, expect } from "vitest";
import { SourceLinkResolver, resolveSourceAction } from "../SourceLinkResolver";

describe("T4 End-state: provenance links reach real sources", () => {
  const portalCoverage: Array<[string, string]> = [
    ["bhulekh", "success"],
    ["bhunaksha", "partial"],
    ["nominatim", "success"],
    ["ecourts", "success"],
    ["high-court", "manual_required"],
    ["drt", "failed"],
    ["igr-ec", "manual_required"],
    ["circle-rate", "success"],
    ["bda-zoning", "partial"],
    ["bhuvan-flood", "success"],
  ];

  for (const [key, status] of portalCoverage) {
    it(`${key}@${status} → non-empty url + human-readable label`, () => {
      const result = SourceLinkResolver(key, status as any);
      expect(result).not.toBeNull();
      expect(typeof result!.url).toBe("string");
      expect(result!.url.length).toBeGreaterThan(0);
      expect(result!.label.length).toBeGreaterThan(0);
    });
  }

  it("rccms no_go / not_run / failed → null (manual verification)", () => {
    for (const s of ["no_go", "not_run", "failed"]) {
      expect(SourceLinkResolver("rccms", s as any)).toBeNull();
    }
  });

  it("unknown source → empty url + generic fallback", () => {
    const result = SourceLinkResolver("totally-fake", "success");
    expect(result).not.toBeNull();
    expect(result!.url).toBe("");
    expect(result!.fallbackAction).toBeTruthy();
  });

  it("bhulekh success URL is https://bhulekh.ori.nic.in/", () => {
    const result = SourceLinkResolver("bhulekh", "success");
    expect(result!.url).toBe("https://bhulekh.ori.nic.in/");
    expect(result!.label).toBe("Bhulekh RoR");
  });

  it("ecourts no_go still returns portal URL (no automated fetch → portal URL is fallback)", () => {
    const result = SourceLinkResolver("ecourts", "no_go");
    expect(result).not.toBeNull();
    expect(result!.url).toBe("https://services.ecourts.gov.in/");
    expect(result!.label).toBe("eCourts case search");
  });

  it("resolveSourceAction returns useful manual copy for rccms", () => {
    const action = resolveSourceAction("rccms");
    expect(action).toContain("ccms.nic.in");
    expect(action).toContain("Hal Khata No.");
  });

  it("resolveSourceAction returns generic fallback for unknown source", () => {
    const action = resolveSourceAction("totally-fake");
    expect(action).toBeTruthy();
  });
});
