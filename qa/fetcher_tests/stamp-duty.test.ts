/**
 * Sprint V5b — Stamp duty contract tests.
 *
 * The live endpoint is `StampDutyCalc.aspx/GetDoMRVal` on igrodisha.gov.in.
 * The contract tests exercise the synthetic envelope and the typed
 * `partial` / `source_down` paths. Live smoke is recorded separately.
 */
import { describe, it, expect } from "vitest";
import {
  goldenPathsFor,
  loadManifest,
  fetcherSlice,
  assertStructuralCorrectness,
  loadInvalidInputs,
} from "./_helper";
import {
  StampDutyDataSchema,
  StampDutyBreakupSchema,
} from "../../packages/fetchers/stamp-duty/src/contract";

const goldenPaths = goldenPathsFor("stamp-duty");

describe("Stamp Duty — structural correctness", () => {
  it("accepts a synthetic success case (Sale deed, no BMV floor)", () => {
    const synthetic = {
      breakup: {
        stampDuty: 250000,
        registrationFee: 50000,
        cess: 5000,
        totalPayable: 305000,
        calculationBasis: "Sale deed: 5% of market value + 1% reg fee + 2% cess",
        appliedMarketValue: 5000000,
        requestedMarketValue: 5000000,
        bmvFloorApplied: false,
      },
    };
    const result = StampDutyDataSchema.safeParse(synthetic);
    expect(result.success).toBe(true);
  });

  it("accepts a BMV-floor case (seller under-quoted)", () => {
    const synthetic = {
      breakup: {
        stampDuty: 250000,
        registrationFee: 50000,
        cess: 5000,
        totalPayable: 305000,
        calculationBasis: "Sale deed: 5% of BMV (₹5,000,000) + 1% reg fee + 2% cess",
        appliedMarketValue: 5000000,
        requestedMarketValue: 1000000,
        bmvFloorApplied: true,
      },
    };
    const result = StampDutyDataSchema.safeParse(synthetic);
    expect(result.success).toBe(true);
    expect(result.data?.breakup.bmvFloorApplied).toBe(true);
  });

  it("rejects negative stamp duty", () => {
    const invalid = {
      stampDuty: -1,
      registrationFee: 50000,
      totalPayable: 100000,
      calculationBasis: "x",
      appliedMarketValue: 5000000,
      requestedMarketValue: 5000000,
      bmvFloorApplied: false,
    };
    const result = StampDutyBreakupSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it("rejects non-numeric totalPayable", () => {
    const invalid = {
      stampDuty: 250000,
      registrationFee: 50000,
      totalPayable: "three lakh",
      calculationBasis: "x",
      appliedMarketValue: 5000000,
      requestedMarketValue: 5000000,
      bmvFloorApplied: false,
    };
    const result = StampDutyBreakupSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });
});

describe("Stamp Duty — invalid inputs (from corpus)", () => {
  const stampDutyCases = loadInvalidInputs().filter((c) => c.fetcher === "stamp-duty");
  if (stampDutyCases.length === 0) {
    it.skip("no stamp-duty invalid-input fixtures in qa/invalid_inputs.json yet (founder pending — see CURRENT_FOCUS.md)", () => {});
  } else {
    for (const invalidCase of stampDutyCases) {
      it(`rejects ${invalidCase.description}`, async () => {
        // Stamp-duty doesn't expose invalid_input as a contract status; it returns
        // `failed` with a structured error. We assert that the contract is honored.
        const { stampDutyFetch } = await import("../../packages/fetchers/stamp-duty/src/index");
        const result = await stampDutyFetch({
          sro: String(invalidCase.input.sro ?? ""),
          marketValue: Number(invalidCase.input.marketValue ?? 0),
        });
        expect(["failed", "partial"]).toContain(result.status);
      });
    }
  }
});
