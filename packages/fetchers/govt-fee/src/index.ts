/**
 * IGR Odisha Government Fee Schedule fetcher for ClearDeed.
 *
 * Sprint V5c — the GovtFeeDtls.aspx page is server-rendered with no JSON
 * API. We ship a permanent typed cache of the schedule as a JSON seed
 * (data/odisha_govt_fee_schedule.json). The fetcher:
 *   1. Loads the seed at module init, validates against Zod schema.
 *   2. On fetch(input), returns the full schedule + the matched deed fee
 *      for the requested category.
 *   3. No network call. Re-validate the seed when `lastUpdated` is older
 *      than 2 years.
 *
 * The renderer (Section 6 "Official fees" sub-card) uses this to show
 * the buyer exactly what fees the SRO will charge — for the matched
 * category — so the buyer can verify the SRO's quote.
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  GovtFeeScheduleSchema,
  type GovtFeeResult,
  type GovtFeeSchedule,
  type DeedFee,
} from "./contract.js";

const PARSER_VERSION = "govt-fee-v1";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
// Walk up from src/index.ts to package root, then to data/seed.
const SEED_PATH = join(__dirname, "..", "data", "odisha_govt_fee_schedule.json");

let cachedSchedule: GovtFeeSchedule | null = null;

function loadSchedule(): GovtFeeSchedule {
  if (cachedSchedule) return cachedSchedule;
  const raw = readFileSync(SEED_PATH, "utf-8");
  const json = JSON.parse(raw) as unknown;
  const parsed = GovtFeeScheduleSchema.safeParse(json);
  if (!parsed.success) {
    throw new Error(
      `govt-fee seed failed Zod validation: ${parsed.error.message}`
    );
  }
  cachedSchedule = parsed.data;
  return cachedSchedule;
}

export interface GovtFeeInput {
  /** Deed category — e.g. "Sale", "Gift Immovable Property", "Mortgage with Possession". */
  deedCategory?: string;
  /** Skip the seed load (used for tests). */
  skipLive?: boolean;
}

function matchDeedFee(
  schedule: GovtFeeSchedule,
  category: string | undefined
): DeedFee | null {
  if (!category) return null;
  const needle = category.toLowerCase().trim();
  return (
    schedule.deedFees.find(
      (d) => d.category.toLowerCase() === needle
    ) ?? null
  );
}

export async function govtFeeFetch(
  input: GovtFeeInput
): Promise<GovtFeeResult> {
  const fetchedAt = new Date().toISOString();

  if (input.skipLive) {
    return {
      source: "govt-fee",
      status: "not_covered",
      statusReason: "skipLive_set_in_test",
      verification: "not_applicable",
      fetchedAt,
      parserVersion: PARSER_VERSION,
      warnings: [
        {
          code: "GOVT_FEE_SKIPPED",
          message: "skipLive=true: seed not loaded in test mode",
        },
      ],
    };
  }

  let schedule: GovtFeeSchedule;
  try {
    schedule = loadSchedule();
  } catch (e) {
    return {
      source: "govt-fee",
      status: "failed",
      statusReason: "seed_load_failed",
      verification: "manual_required",
      fetchedAt,
      parserVersion: PARSER_VERSION,
      error: e instanceof Error ? e.message : String(e),
      warnings: [
        {
          code: "GOVT_FEE_SEED_INVALID",
          message: "Permanent seed failed to load. Check data/odisha_govt_fee_schedule.json.",
        },
      ],
    };
  }

  const matched = matchDeedFee(schedule, input.deedCategory);

  // Stale-check: warn if seed is older than 2 years
  const lastUpdated = new Date(schedule.lastUpdated);
  const ageMs = Date.now() - lastUpdated.getTime();
  const twoYearsMs = 2 * 365 * 24 * 60 * 60 * 1000;
  const warnings: { code: string; message: string }[] = [
    {
      code: "GOVT_FEE_CACHE_OK",
      message: `Permanent cache last updated ${schedule.lastUpdated}. Source: ${schedule.source}`,
    },
  ];
  if (ageMs > twoYearsMs) {
    warnings.push({
      code: "GOVT_FEE_STALE",
      message: `Seed is older than 2 years. Re-validate against GovtFeeDtls.aspx before launch.`,
    });
  }
  if (!matched && input.deedCategory) {
    warnings.push({
      code: "DEED_CATEGORY_NOT_FOUND",
      message: `No exact match for "${input.deedCategory}". Buyer should verify the SRO's fee for this deed type.`,
    });
  }

  return {
    source: "govt-fee",
    status: "success",
    statusReason: "permanent_cache",
    verification: "verified",
    fetchedAt,
    attempts: 0,
    inputsTried: [
      { label: "govt_fee_seed_load", input: { ...input } },
    ],
    parserVersion: PARSER_VERSION,
    data: {
      schedule,
      matchedDeedFee: matched,
    },
    warnings,
  };
}

export async function healthCheck(): Promise<boolean> {
  try {
    loadSchedule();
    return true;
  } catch {
    return false;
  }
}
