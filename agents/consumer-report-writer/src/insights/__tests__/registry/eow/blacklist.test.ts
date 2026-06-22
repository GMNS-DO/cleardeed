// agents/consumer-report-writer/src/insights/__tests__/registry/eow/blacklist.test.ts
//
// Tests for ROR-INS-210 (plot match) and ROR-INS-211 (owner match)
// against the curated Khordha EOW blacklist at
// packages/fetchers/eow/data/khordha_eow_blacklist.json.
//
// The insight rules read from `input.eowBlacklist` (a payload the
// orchestrator builds by calling `matchBlacklist()` from the eow
// fetcher package). Tests build that payload by calling
// `matchBlacklist()` directly — same code path the orchestrator will
// use in production — and pass it on the input. This keeps the
// insight rules package-agnostic while still exercising the real
// matcher against the real curated JSON.

import { describe, it, expect } from "vitest";
import { eowRules } from "../../../registry/eow/blacklist";
import { runInsights } from "../../../engine";
import { matchBlacklist, type EOWQuery } from "@cleardeed/fetcher-eow";

type EowBlacklistPayload = NonNullable<ReturnType<typeof matchBlacklist>["data"]>;

/**
 * Run a single EOW cross-reference and return the data payload shaped
 * the way the A10 mapper will place it on `input.eowBlacklist.data`.
 */
function eowInput(query: EOWQuery) {
  const result = matchBlacklist(query);
  return { data: result.data as EowBlacklistPayload | null | undefined };
}

describe("eow rules", () => {
  it("exports exactly 2 rules (ROR-INS-210, ROR-INS-211)", () => {
    expect(eowRules.length).toBe(2);
    expect(eowRules.map((r) => r.id)).toEqual(["ROR-INS-210", "ROR-INS-211"]);
  });

  it("emits nothing when no owner name is supplied", () => {
    // Without an owner name there is nothing to cross-reference.
    // ROR-INS-210 needs a plotNo; ROR-INS-211 needs an ownerName. We
    // do still pass the orchestrator-built eowBlacklist payload, but
    // the rules gate on the input fields.
    const out = runInsights(eowRules, {
      ror: { page1: { khatiyanNumber: "830", village: "Mendhasala" } },
      geoFetch: { plotNo: "415", tahasil: "Bhubaneswar" },
      eowBlacklist: eowInput({
        plotNo: "415",
        khataNo: "830",
        village: "Mendhasala",
        ownerName: "",
      }),
    });
    expect(out.length).toBe(0);
  });

  it("ROR-INS-210 fires redFlag when the queried plot matches the Surya Nirman attachment", () => {
    const out = runInsights(eowRules, {
      ror: {
        page1: { khatiyanNumber: "830", village: "Mendhasala" },
        plotTable: { targetRow: { plotNo: "415", khataNo: "830", village: "Mendhasala" } },
      },
      geoFetch: { plotNo: "415", village: "Mendhasala", tahasil: "Bhubaneswar" },
      claimedOwnerName: "Surya Nirman Constructions",
      sellerName: "Surya Nirman Constructions",
      eowBlacklist: eowInput({
        plotNo: "415",
        khataNo: "830",
        village: "Mendhasala",
        ownerName: "Surya Nirman Constructions",
      }),
    });
    const r210 = out.find((i) => i.ruleId === "ROR-INS-210");
    expect(r210).toBeDefined();
    expect(r210!.severity).toBe("redFlag");
    expect(r210!.panel).toBe("ownershipChain");
    expect(r210!.issueLens).toBe("title_chain");
    expect(r210!.body).toContain("415");
    // Action item should reference the EOW case and instruct the buyer
    // not to pay any advance.
    expect(r210!.actionItem).toMatch(/EOW/i);
    expect(r210!.actionItem).toMatch(/do not pay|advance|attachment/i);
    // Disclosure copy must call out the limit (curated list may be
    // incomplete for older cases).
    expect(r210!.disclosure?.limitsOfThisCheck).toBeTruthy();
  });

  it("ROR-INS-210 fires for plot 415 even when village is omitted", () => {
    // The resolver should still hit the Surya Nirman record when only
    // the plotNo is supplied.
    const out = runInsights(eowRules, {
      geoFetch: { plotNo: "415" },
      claimedOwnerName: "Test Buyer",
      eowBlacklist: eowInput({
        plotNo: "415",
        ownerName: "Test Buyer",
      }),
    });
    const r210 = out.find((i) => i.ruleId === "ROR-INS-210");
    expect(r210).toBeDefined();
    expect(r210!.severity).toBe("redFlag");
  });

  it("ROR-INS-210 stays quiet for a plot not on the blacklist", () => {
    const out = runInsights(eowRules, {
      geoFetch: { plotNo: "9999", village: "Mendhasala", tahasil: "Bhubaneswar" },
      claimedOwnerName: "Some Random Person",
      eowBlacklist: eowInput({
        plotNo: "9999",
        village: "Mendhasala",
        ownerName: "Some Random Person",
      }),
    });
    expect(out.find((i) => i.ruleId === "ROR-INS-210")).toBeUndefined();
  });

  it("ROR-INS-210 stays quiet when no plotNo is supplied (cannot cross-reference)", () => {
    const out = runInsights(eowRules, {
      ror: { page1: { khatiyanNumber: "830", village: "Mendhasala" } },
      claimedOwnerName: "Anyone",
      eowBlacklist: eowInput({
        plotNo: "",
        village: "Mendhasala",
        ownerName: "Anyone",
      }),
    });
    expect(out.find((i) => i.ruleId === "ROR-INS-210")).toBeUndefined();
  });

  it("ROR-INS-211 fires redFlag when owner name is on the EOW arrest list", () => {
    const out = runInsights(eowRules, {
      geoFetch: { plotNo: "9999", village: "Mendhasala" },
      claimedOwnerName: "Ramesh Mohanty",
      eowBlacklist: eowInput({
        plotNo: "9999",
        village: "Mendhasala",
        ownerName: "Ramesh Mohanty",
      }),
    });
    const r211 = out.find((i) => i.ruleId === "ROR-INS-211");
    expect(r211).toBeDefined();
    expect(r211!.severity).toBe("redFlag");
    expect(r211!.panel).toBe("ownershipChain");
    expect(r211!.body).toContain("Ramesh Mohanty");
    expect(r211!.actionItem).toMatch(/video KYC|advocate|EOW/i);
  });

  it("ROR-INS-211 falls back to first RoR tenant name when seller name is empty", () => {
    // When the buyer doesn't supply a claimed owner, we use the first
    // tenant on the RoR. Here we plant a tenant whose name is on the
    // arrest list and the orchestrator-built payload reflects the
    // tenant-name match.
    const out = runInsights(eowRules, {
      ror: {
        tenants: [{ tenantName: "Ramesh Mohanty" }],
        page1: { khatiyanNumber: "999", village: "Mendhasala" },
      },
      geoFetch: { plotNo: "1234", village: "Mendhasala" },
      eowBlacklist: eowInput({
        plotNo: "1234",
        village: "Mendhasala",
        ownerName: "Ramesh Mohanty",
      }),
    });
    const r211 = out.find((i) => i.ruleId === "ROR-INS-211");
    expect(r211).toBeDefined();
    expect(r211!.severity).toBe("redFlag");
  });

  it("ROR-INS-211 stays quiet when owner name is clean", () => {
    const out = runInsights(eowRules, {
      geoFetch: { plotNo: "415", village: "Mendhasala" },
      claimedOwnerName: "An Honest Buyer",
      eowBlacklist: eowInput({
        plotNo: "415",
        village: "Mendhasala",
        ownerName: "An Honest Buyer",
      }),
    });
    expect(out.find((i) => i.ruleId === "ROR-INS-211")).toBeUndefined();
  });

  it("ROR-INS-211 is suppressed when ROR-INS-210 already fires (single source of truth)", () => {
    // When the plot itself is on the attachment list, the buyer already
    // gets the load-bearing finding from ROR-INS-210. We do not also
    // fire ROR-INS-211 for the same case — that would be noise.
    const out = runInsights(eowRules, {
      geoFetch: { plotNo: "415", village: "Mendhasala" },
      claimedOwnerName: "Ramesh Mohanty", // also on the arrest list
      eowBlacklist: eowInput({
        plotNo: "415",
        village: "Mendhasala",
        ownerName: "Ramesh Mohanty",
      }),
    });
    expect(out.find((i) => i.ruleId === "ROR-INS-210")).toBeDefined();
    expect(out.find((i) => i.ruleId === "ROR-INS-211")).toBeUndefined();
  });

  it("both rules avoid prohibited language (safe-to-buy / clear-title / no-encumbrance)", () => {
    // Unified insight engine language gate: never emit the prohibited
    // phrasings, even when the EOW match is positive.
    const out = runInsights(eowRules, {
      geoFetch: { plotNo: "415", village: "Mendhasala" },
      claimedOwnerName: "Surya Nirman Constructions",
      eowBlacklist: eowInput({
        plotNo: "415",
        village: "Mendhasala",
        ownerName: "Surya Nirman Constructions",
      }),
    });
    const allText = out
      .flatMap((i) => [
        i.headline,
        i.body,
        i.actionItem,
        i.disclosure?.whatWeChecked ?? "",
        i.disclosure?.howToVerify ?? "",
        i.disclosure?.limitsOfThisCheck ?? "",
      ])
      .join("\n")
      .toLowerCase();
    expect(allText).not.toMatch(/safe to buy/);
    expect(allText).not.toMatch(/clear title/);
    expect(allText).not.toMatch(/no encumbrance/);
    expect(allText).not.toMatch(/recommended to buy/);
  });
});
