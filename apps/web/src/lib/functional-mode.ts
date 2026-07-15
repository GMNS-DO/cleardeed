/**
 * Functional mode — payment/auth bypass for end-to-end report verification.
 *
 * When NEXT_PUBLIC_FUNCTIONAL_MODE === "true", the buyer form generates and
 * views a REAL report WITHOUT phone-OTP login (MSG91) and WITHOUT payment
 * (Razorpay). It posts the V1.1 inputs directly to the already-unauthenticated
 * /api/report/create endpoint.
 *
 * When the flag is anything other than the exact string "true", the paid flow
 * (pregenerate → order → checkout → Razorpay → payment/success) runs unchanged.
 *
 * This is read as a NEXT_PUBLIC_* var so it is inlined at build time and safe
 * to reference in a client component.
 */
export const FUNCTIONAL_MODE =
  process.env.NEXT_PUBLIC_FUNCTIONAL_MODE === "true";

export function isFunctionalMode(): boolean {
  return FUNCTIONAL_MODE;
}
