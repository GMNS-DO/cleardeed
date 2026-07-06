/**
 * ClearDeed pricing tiers.
 *
 * Three paid tiers and a free preview, per PRODUCT.md Section 10 and
 * CLEARDEED_FINAL_CEILING.md Section 11:
 *
 *   - Free preview (₹0): plot found + owner name + kisam + 1-line summary.
 *     Every authenticated user gets exactly ONE free preview. After that,
 *     the metering gate on /api/report/create blocks subsequent reports
 *     unless the user has a paid checkout session.
 *
 *   - Standard (₹699): full ROR insights + EC concierge instructions + BDA
 *     zoning + Bhuvan flood + Six Buyer Questions.
 *
 *   - Verified (₹1,999): Standard + RCCMS + eCourts + CERSAI + IGR benchmark
 *     + Propstack comps + Cost-of-Risk calculator + EC retrieved by concierge.
 *
 *   - Guaranteed (₹4,999): Verified + advocate co-sign + 18-month correctness
 *     guarantee + 365-day buyer support.
 *
 * Enterprise (₹399/report at volume) is B2B API — out of scope here.
 *
 * The free preview is the funnel. Most buyers start there and upgrade when
 * an insight fires or they want the cost-of-risk calculator on a specific
 * plot. The Guaranteed tier is the moat — at ₹4,999 on a ₹50 lakh purchase,
 * the cost is 0.1% of the transaction.
 */

export type Tier = "free_preview" | "standard" | "verified" | "guaranteed";

export const TIERS: Record<Tier, { amountPaise: number; amountRupees: number; label: string; includes: string }> = {
  free_preview: {
    amountPaise: 0,
    amountRupees: 0,
    label: "Free preview",
    includes: "Plot found + owner name + kisam + 1-line summary",
  },
  standard: {
    amountPaise: 69_900,
    amountRupees: 699,
    label: "Standard",
    includes: "Full RoR insights + 6 buyer questions + BDA + Bhuvan flood",
  },
  verified: {
    amountPaise: 199_900,
    amountRupees: 1_999,
    label: "Verified",
    includes: "Standard + eCourts + CERSAI + IGR benchmark + cost-of-risk",
  },
  guaranteed: {
    amountPaise: 499_900,
    amountRupees: 4_999,
    label: "Guaranteed",
    includes: "Verified + advocate co-sign + 18-month correctness guarantee",
  },
};

/**
 * Validate that an incoming `tier` string is a known tier. Used by both the
 * order and checkout routes to refuse bogus values like `"free"` (missing
 * the `_preview` suffix) or `"Premium"`.
 */
export function parseTier(value: unknown): Tier | null {
  if (typeof value !== "string") return null;
  if (value === "free_preview" || value === "standard" || value === "verified" || value === "guaranteed") {
    return value;
  }
  return null;
}

/**
 * Resolve a tier from an order amount in paise. The webhook uses this to
 * validate that Razorpay's captured amount matches our pricing contract —
 * a payment for ₹100 (₹1) must not silently upgrade to a "guaranteed" tier.
 *
 * Returns null if the amount doesn't match any tier exactly. Refund /
 * audit-log calls should treat null as "amount didn't match any tier —
 * investigate".
 */
export function tierFromAmountPaise(amountPaise: number): Tier | null {
  for (const [tier, info] of Object.entries(TIERS)) {
    if (info.amountPaise === amountPaise) return tier as Tier;
  }
  return null;
}

/**
 * The one-per-user free preview policy. New users get one free preview
 * before they're asked to pay.
 */
export const FREE_PREVIEW_LIMIT_PER_USER = 1;

/**
 * Type-guard: is this tier a *paid* tier? Used by routes that need to
 * confirm a request came in with a non-free tier before they accept
 * payment / create paid content.
 */
export function isPaidTier(tier: unknown): tier is Exclude<Tier, "free_preview"> {
  return tier === "standard" || tier === "verified" || tier === "guaranteed";
}

/**
 * T-014: Metering gate decision.
 *
 * Two free previews are intentionally NOT given. Every authenticated user
 * gets ONE free preview, then must pay. The gate has three states:
 *
 *   1. `allow` — proceed, the report will be created as a free preview.
 *   2. `require_payment` — block with a 402 + the order endpoint URL.
 *
 * The gate reads `paidReportsCount` (i.e. reports with paid_at IS NOT NULL).
 * Free previews have paid_at = NULL by design (they're the basis of the
 * gate's "remaining previews" count).
 */
export type GateDecision =
  | { kind: "allow"; reason: "anonymous" | "free_preview"; remainingPreviews: number }
  | { kind: "require_payment"; reason: "free_preview_used"; remainingPreviews: 0; orderEndpoint: string };

/**
 * Decide whether a report creation request is allowed to proceed.
 *
 * Inputs:
 *   - userId: the auth.uid() of the requesting user, or null for anonymous.
 *   - paidReportsCount: how many of THIS user's reports have paid_at set.
 *   - orderEndpoint: the URL the route should advertise for /api/order.
 *
 * Behaviour:
 *   - null userId → allow (anonymous buyers run on the concierge flow;
 *     the /api/checkout route gates on auth anyway).
 *   - paidReportsCount < FREE_PREVIEW_LIMIT_PER_USER → allow (free preview).
 *   - paidReportsCount >= FREE_PREVIEW_LIMIT_PER_USER → require_payment.
 *
 * Negative counts are clamped to 0 — if the DB returns a corrupt count,
 * the gate stays conservative (deny). This avoids accidentally granting
 * a free preview when the count was supposed to be positive.
 *
 * The function is intentionally pure: it takes the auth_user_id and the
 * count of paid reports, and returns the decision. The route passes the
 * count from `countUserPaidReports()` so the function stays easy to test.
 */
export function decideMetering(input: {
  userId: string | null;
  paidReportsCount: number;
  orderEndpoint?: string;
}): GateDecision {
  const orderEndpoint = input.orderEndpoint ?? "/api/order";

  if (!input.userId) {
    return { kind: "allow", reason: "anonymous", remainingPreviews: FREE_PREVIEW_LIMIT_PER_USER };
  }

  // Clamp negative → 0, then compare. We want to deny if the count is
  // anything other than strictly less than the free preview limit.
  const safeCount = Math.max(0, input.paidReportsCount);

  if (safeCount < FREE_PREVIEW_LIMIT_PER_USER) {
    return { kind: "allow", reason: "free_preview", remainingPreviews: FREE_PREVIEW_LIMIT_PER_USER - safeCount };
  }

  return {
    kind: "require_payment",
    reason: "free_preview_used",
    remainingPreviews: 0,
    orderEndpoint,
  };
}