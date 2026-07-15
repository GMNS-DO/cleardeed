import { describe, it, expect } from "vitest";
import { SourceLinkResolver, resolveSourceAction } from "../SourceLinkResolver";

describe("SourceLinkResolver", () => {
  it("bhulekh success → bhulekh.ori.nic.in URL", () => {
    const result = SourceLinkResolver("bhulekh", "success");
    expect(result).not.toBeNull();
    expect(result!.url).toBe("https://bhulekh.ori.nic.in/");
    expect(result!.label).toBe("Bhulekh RoR");
  });

  it("bhunaksha partial → mapserver URL (partial still returns URL)", () => {
    const result = SourceLinkResolver("bhunaksha", "partial");
    expect(result).not.toBeNull();
    expect(result!.url).toBe("https://mapserver.odisha4kgeo.in/");
    expect(result!.label).toBe("Bhunaksha plot map");
  });

  it("ecourts no_go → still returns URL (no automated fetch → URL is the fallback)", () => {
    const result = SourceLinkResolver("ecourts", "no_go");
    expect(result).not.toBeNull();
    expect(result!.url).toBe("https://services.ecourts.gov.in/");
  });

  it("rccms not_run → null (use resolveSourceAction for manual copy)", () => {
    const result = SourceLinkResolver("rccms", "not_run");
    expect(result).toBeNull();
    expect(resolveSourceAction("rccms")).toContain("ccms.nic.in");
    expect(resolveSourceAction("rccms")).toContain("Hal Khata No.");
  });

  it("unknown key → generic fallback with null url", () => {
    const result = SourceLinkResolver("unknown-source", "success");
    expect(result).not.toBeNull();
    expect(result!.url).toBe("");
    expect(result!.fallbackAction).toBe("Ask your lawyer to verify manually");
  });

  it("igr-ec always returns URL regardless of status", () => {
    for (const status of ["success", "partial", "failed", "manual_required", "no_go"] as const) {
      const result = SourceLinkResolver("igr-ec", status);
      expect(result).not.toBeNull();
      expect(result!.url).toBe("https://igrodisha.gov.in/");
      expect(result!.label).toBe("IGR EC portal");
    }
  });
});

describe("resolveSourceAction", () => {
  it("rccms → manual query copy", () => {
    expect(resolveSourceAction("rccms")).toContain("ccms.nic.in");
    expect(resolveSourceAction("rccms")).toContain("Hal Khata No.");
  });

  it("unknown → generic fallback", () => {
    expect(resolveSourceAction("unknown-source")).toBe(
      "Ask your lawyer to verify manually",
    );
  });

  it("ecourts → captcha-aware copy", () => {
    const copy = resolveSourceAction("ecourts");
    expect(copy.length).toBeGreaterThan(0);
    expect(copy.toLowerCase()).toContain("manual");
  });
});
