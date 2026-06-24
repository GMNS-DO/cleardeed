/**
 * Encumbrance fee schedule — typed table replacing hardcoded fee strings.
 *
 * DPR-ENC-003: every ₹ reference in the consumer report must trace back to
 * a typed value here so that we can update once when IGR changes its fee
 * rather than grep across the codebase.
 *
 * Source of truth (as of 2026-06-25):
 *   - IGR Odisha EC fee: Rs. 30 for 13 years; Rs. 5 for every additional
 *     year (per IGRSL-EC portal). Confirmed in
 *     `apps/web/src/lib/pipeline/index.ts:300` constant.
 *   - Stamp duty: state-rate slab; varies by gender, property use,
 *     transaction type. Stored as a function lookup, not a constant.
 *
 * Adding a new fee: append to FEE_TABLE, reference by key. No inline strings.
 */

export type FeeKey =
  | "IGRSL_EC_FEE_PER_13Y"
  | "IGRSL_EC_FEE_PER_EXTRA_YEAR"
  | "IGR_STAMP_DUTY_RESIDENTIAL_MALE"
  | "IGR_STAMP_DUTY_RESIDENTIAL_FEMALE"
  | "IGR_REGISTRATION_FEE_PERCENT";

interface FeeEntry {
  readonly amount: number;
  readonly unit: "Rs" | "%" | "Rs/page" | "Rs/year";
  readonly source: string;
  readonly lastVerified: string;
}

export const FEE_TABLE: Readonly<Record<FeeKey, FeeEntry>> = {
  IGRSL_EC_FEE_PER_13Y: {
    amount: 30,
    unit: "Rs",
    source: "IGR Odisha IGRSL-EC portal",
    lastVerified: "2026-06-25",
  },
  IGRSL_EC_FEE_PER_EXTRA_YEAR: {
    amount: 5,
    unit: "Rs/year",
    source: "IGR Odisha IGRSL-EC portal",
    lastVerified: "2026-06-25",
  },
  IGR_STAMP_DUTY_RESIDENTIAL_MALE: {
    amount: 5,
    unit: "%",
    source: "Odisha Stamp Act + IGR circular 2024",
    lastVerified: "2026-06-25",
  },
  IGR_STAMP_DUTY_RESIDENTIAL_FEMALE: {
    amount: 4,
    unit: "%",
    source: "Odisha Stamp Act — 1% rebate for female buyers",
    lastVerified: "2026-06-25",
  },
  IGR_REGISTRATION_FEE_PERCENT: {
    amount: 1,
    unit: "%",
    source: "Registration Act 1908 S.17",
    lastVerified: "2026-06-25",
  },
} as const;

export function feeLine(key: FeeKey): string {
  const entry = FEE_TABLE[key];
  const { amount, unit, source } = entry;
  if (unit === "Rs") return `Rs. ${amount}`;
  if (unit === "%") return `${amount}%`;
  if (unit === "Rs/page") return `Rs. ${amount} per page`;
  if (unit === "Rs/year") return `Rs. ${amount} per additional year`;
  return `${amount} ${unit}`;
}

/**
 * Compute the typed EC fee for a given search period (in years).
 *
 * Formula (per IGR Odisha): Rs.30 for first 13 years, Rs.5 per year beyond.
 */
export function computeEcFeeRs(searchYears: number): number {
  const base = FEE_TABLE.IGRSL_EC_FEE_PER_13Y.amount;
  const perYear = FEE_TABLE.IGRSL_EC_FEE_PER_EXTRA_YEAR.amount;
  if (searchYears <= 13) return base;
  return base + (searchYears - 13) * perYear;
}