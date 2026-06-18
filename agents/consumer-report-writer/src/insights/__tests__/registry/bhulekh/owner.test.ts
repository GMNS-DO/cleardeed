// agents/consumer-report-writer/src/insights/__tests__/registry/bhulekh/owner.test.ts
import { describe, it, expect } from "vitest";
import { bhulekhOwnerRules } from "../../../registry/bhulekh/owner";
import { runInsights } from "../../../engine";

const verifiedRor = {
  status: "verified",
  page1: {
    khatiyanNumber: "830",
    owner: "Rama Mohanty",
    landTypeOdia: "ଦଣ୍ଡା",
  },
};

describe("bhulekh owner rules", () => {
  it("exports 6 rules", () => {
    expect(bhulekhOwnerRules.length).toBe(6);
  });

  it("fires redFlag for government khatiyan (owner is empty)", () => {
    const out = runInsights(bhulekhOwnerRules, {
      ror: { status: "verified", page1: { owner: "" } },
    });
    expect(out.find((i) => i.severity === "redFlag" && i.body.includes("government"))).toBeDefined();
  });

  it("fires redFlag for multiple co-owners — body contains '3 owners'", () => {
    const out = runInsights(bhulekhOwnerRules, {
      ror: {
        status: "verified",
        page1: {
          owner: "Rama Mohanty",
          coOwners: ["Sita Mohanty", "Hari Mohanty"],
        },
      },
    });
    expect(out.find((i) => i.body.includes("3 owners"))).toBeDefined();
  });

  it("fires redFlag when seller name does not match — body contains 'does not match'", () => {
    const out = runInsights(bhulekhOwnerRules, {
      ror: { status: "verified", page1: { owner: "Rama Mohanty" } },
      sellerName: "Shyam Patnaik",
    });
    expect(out.find((i) => i.severity === "redFlag" && i.body.includes("does not match"))).toBeDefined();
  });

  it("emits nothing when ror is missing", () => {
    expect(runInsights(bhulekhOwnerRules, {}).length).toBe(0);
  });
});