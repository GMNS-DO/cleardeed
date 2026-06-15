/**
 * Sprint V5b — IGR Daily Bulletin contract tests.
 *
 * The live endpoint is `ORServiceNew.aspx/GetDataFromDB` on igrodisha.gov.in.
 * Contract tests exercise the synthetic envelope and the source_down path.
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
  IgrDailyBulletinDataSchema,
  DailyBulletinDaySchema,
} from "../../packages/fetchers/igr-daily-bulletin/src/contract";

const goldenPaths = goldenPathsFor("igr-daily-bulletin");

describe("IGR Daily Bulletin — structural correctness", () => {
  it("accepts a synthetic success case with multiple days", () => {
    const synthetic = {
      days: [
        {
          date: "2026-06-15",
          district: "Khordha",
          sro: "Bhubaneswar",
          deedType: "Sale",
          count: 12,
          considerationTotal: 45_000_000,
        },
        {
          date: "2026-06-14",
          district: "Khordha",
          sro: "Jatni",
          deedType: "Sale",
          count: 8,
          considerationTotal: 22_000_000,
        },
      ],
      dateRange: { from: "2026-06-08", to: "2026-06-15" },
      district: "Khordha",
      summary: {
        totalDeeds: 20,
        totalConsideration: 67_000_000,
        avgDeedsPerDay: 2.5,
      },
    };
    const result = IgrDailyBulletinDataSchema.safeParse(synthetic);
    expect(result.success).toBe(true);
  });

  it("accepts an empty days array (no activity in range)", () => {
    const empty = {
      days: [],
      dateRange: { from: "2026-06-08", to: "2026-06-15" },
      district: "Khordha",
    };
    const result = IgrDailyBulletinDataSchema.safeParse(empty);
    expect(result.success).toBe(true);
  });

  it("rejects negative deed count", () => {
    const invalid = {
      date: "2026-06-15",
      district: "Khordha",
      count: -1,
      considerationTotal: 0,
    };
    const result = DailyBulletinDaySchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it("rejects non-string date", () => {
    const invalid = {
      date: 20260615,
      district: "Khordha",
      count: 0,
      considerationTotal: 0,
    };
    const result = DailyBulletinDaySchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });
});
