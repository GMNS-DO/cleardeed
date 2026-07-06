// apps/web/src/lib/pipeline/cross-source-validators.test.ts
import { describe, it, expect } from "vitest";
import {
  runCrossSourceValidators,
  type CrossSourceValidatorInput,
} from "./cross-source-validators";

describe("runCrossSourceValidators (V1.2 B11)", () => {
  it("exports three rules / findings categories", () => {
    const out = runCrossSourceValidators({});
    expect(out).toEqual([]);
  });

  it("deed_mismatch — fires watchout when Bhulekh mutationYear ≠ IGR latest deed year", () => {
    const input: CrossSourceValidatorInput = {
      bhulekhData: { mutationYear: 2018 },
      igrEcResult: { data: { deeds: [{ year: 2022 }] } },
    };
    const out = runCrossSourceValidators(input);
    const r = out.find((f) => f.code === "deed_mismatch");
    expect(r).toBeDefined();
    expect(r?.severity).toBe("watchout");
  });

  it("deed_mismatch — does NOT fire when years match", () => {
    const input: CrossSourceValidatorInput = {
      bhulekhData: { mutationYear: 2020 },
      igrEcResult: { data: { deeds: [{ year: 2020 }] } },
    };
    const out = runCrossSourceValidators(input);
    expect(out.find((f) => f.code === "deed_mismatch")).toBeUndefined();
  });

  it("benchmark_deviation — fires when BMV floor > circle rate by >20%", () => {
    const input: CrossSourceValidatorInput = {
      igrBmvResult: { data: { bmvApplied: true, bmvFloorPerSqft: 1500 } },
      circleRateResult: { data: { circleRatePerSqft: 1000 } },
      bhunakshaResult: { data: { area: 0.01, areaUnit: "sq_km" } },
    };
    const out = runCrossSourceValidators(input);
    const r = out.find((f) => f.code === "benchmark_deviation");
    expect(r).toBeDefined();
    expect(r?.title).toContain("50%");
  });

  it("benchmark_deviation — does NOT fire when deviation < 20%", () => {
    const input: CrossSourceValidatorInput = {
      igrBmvResult: { data: { bmvApplied: true, bmvFloorPerSqft: 1100 } },
      circleRateResult: { data: { circleRatePerSqft: 1000 } },
      bhunakshaResult: { data: { area: 0.01, areaUnit: "sq_km" } },
    };
    const out = runCrossSourceValidators(input);
    expect(out.find((f) => f.code === "benchmark_deviation")).toBeUndefined();
  });

  it("revenue_dues_pending — fires redFlag when mutationReferences have pending marker", () => {
    const input: CrossSourceValidatorInput = {
      bhulekhData: {
        mutationReferences: [
          { reference: "MUT-2021-123", pending: true },
          { reference: "MUT-2022-456", pending: false },
        ],
      },
    };
    const out = runCrossSourceValidators(input);
    const r = out.find((f) => f.code === "revenue_dues_pending");
    expect(r).toBeDefined();
    expect(r?.severity).toBe("redFlag");
    expect(r?.title).toContain("1");
  });

  it("revenue_dues_pending — does NOT fire when no pending markers", () => {
    const input: CrossSourceValidatorInput = {
      bhulekhData: {
        mutationReferences: [
          { reference: "MUT-2021-123", pending: false },
        ],
      },
    };
    const out = runCrossSourceValidators(input);
    expect(out.find((f) => f.code === "revenue_dues_pending")).toBeUndefined();
  });

  it("emits nothing when all sources are empty", () => {
    expect(runCrossSourceValidators({}).length).toBe(0);
  });
});
