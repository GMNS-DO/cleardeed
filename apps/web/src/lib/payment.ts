/**
 * Payment utilities — Razorpay integration.
 *
 * Flow:
 * 1. Client calls createRazorpayOrder() → gets orderId
 * 2. Client calls storeCheckoutSession() with plot params
 * 3. Client opens Razorpay modal with orderId
 * 4. On success: Razorpay sends webhook to /api/webhook/razorpay
 * 5. Webhook retrieves session, generates report, sends email
 *
 * Credentials (set in Vercel env vars):
 *   RAZORPAY_KEY_ID
 *   RAZORPAY_KEY_SECRET
 *   RAZORPAY_WEBHOOK_SECRET  (optional — enables signature verification)
 */

export const RAZORPAY_AMOUNT_PAISE = 100; // ₹1
export const RAZORPAY_CURRENCY = "INR";

export interface CheckoutData {
  tehsil: string;
  tehsilValue: string;
  village: string;
  villageCode: string;
  searchMode: string;
  identifier: string;
  claimedOwnerName?: string;
  email?: string;
  whatsapp?: string;
}

/** Create a Razorpay order for ₹1 */
export async function createRazorpayOrder(params: {
  email?: string;
  plotDescription?: string;
}): Promise<{ orderId: string; amount: number; currency: string; receipt: string }> {
  const res = await fetch("/api/order", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error ?? "Order creation failed");
  }

  return res.json() as Promise<{ orderId: string; amount: number; currency: string; receipt: string }>;
}

/** Store plot parameters in Supabase keyed by orderId, before opening Razorpay modal */
/** @deprecated — no longer needed for the client-side callback flow. */
export async function storeCheckoutSession(orderId: string, data: CheckoutData): Promise<void> {
  console.warn("[payment] storeCheckoutSession is deprecated — see /api/payment/success for the current flow");
}

/** Verify client-side payment signature (for manual payment callback, not webhook) */
export async function verifyPaymentSignature(params: {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}): Promise<boolean> {
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keySecret) return true; // Skip verification if not configured

  const crypto = await import("node:crypto");
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = params;
  const body = `${razorpay_order_id}|${razorpay_payment_id}`;
  const expected = crypto
    .createHmac("sha256", keySecret)
    .update(body)
    .digest("hex");

  return expected === razorpay_signature;
}