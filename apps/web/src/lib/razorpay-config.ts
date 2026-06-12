/**
 * Razorpay config + safety guards.
 *
 * Three concerns live here:
 *
 *  1. **Read keys** with a single, well-named entry point. Other modules
 *     call `getRazorpayKeys()` rather than reading process.env directly.
 *
 *  2. **Refuse live keys in non-production environments.** A live key has
 *     the prefix `rzp_live_`. If the server is running in development or
 *     test mode and a live key is configured, the order route refuses to
 *     run. This is a safety net against a developer accidentally pasting
 *     a production key into `.env.local` and burning real money.
 *
 *  3. **Document the test-mode contract.** Test keys are `rzp_test_*`. The
 *     full set of variables the integration reads is documented in one
 *     place. The `.env.example` mirrors this list.
 *
 * The guard fires at order creation time (the first place we'd hit the
 * Razorpay API). It's deliberately not in the order route itself — the
 * guard is a shared concern for the refresh route, the webhook route, and
 * any future Razorpay-touching code.
 */

export type RazorpayMode = "test" | "live" | "unconfigured";

/**
 * Classify the configured Razorpay key by prefix. Returns "unconfigured"
 * if no key is set. Razorpay documents this prefix convention:
 *   - `rzp_test_*`  → test mode (no real money)
 *   - `rzp_live_*`  → live mode (real money)
 * Source: https://razorpay.com/docs/api/authentication/
 */
export function classifyRazorpayKey(keyId: string | undefined | null): RazorpayMode {
  if (!keyId) return "unconfigured";
  if (keyId.startsWith("rzp_live_")) return "live";
  if (keyId.startsWith("rzp_test_")) return "test";
  // Unknown prefix. Treat conservatively as live so we don't burn money on
  // a key we can't recognize.
  return "live";
}

/**
 * Read the configured Razorpay key pair. Returns null if either key is
 * missing. Does NOT call classifyRazorpayKey — callers should do that
 * explicitly to make the safety check visible at the call site.
 */
export function getRazorpayKeys(): { keyId: string; keySecret: string } | null {
  const keyId = process.env.RAZORPAY_KEY_ID ?? process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) return null;
  return { keyId, keySecret };
}

/**
 * The production environment. In Vercel this is "production". In local
 * dev with `pnpm dev` it's "development". Anything that has a Razorpay
 * call attached should be in production before live keys are accepted.
 */
function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}

/**
 * Guard for the order creation route. Throws a descriptive Error if a
 * live key is configured in a non-production environment. The route
 * catches this and returns HTTP 503 with the same message.
 *
 * Returns the classified mode on success. Use it like:
 *
 *   const mode = assertRazorpaySafe();
 *   // mode is "test" or "live" — log it, then proceed.
 */
export function assertRazorpaySafe(): RazorpayMode {
  const keys = getRazorpayKeys();
  if (!keys) {
    throw new Error(
      "Razorpay not configured. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in .env.local (test keys: rzp_test_*).",
    );
  }
  const mode = classifyRazorpayKey(keys.keyId);
  if (mode === "unconfigured") {
    // Defensive: getRazorpayKeys returned something, but classify said
    // unconfigured. That means keyId was an empty string. Should not
    // happen, but guard anyway.
    throw new Error("Razorpay keyId is empty after configuration check.");
  }
  if (mode === "live" && !isProduction()) {
    throw new Error(
      `Refusing to use a LIVE Razorpay key (rzp_live_*) in NODE_ENV=${process.env.NODE_ENV}. ` +
        `Use a test key (rzp_test_*) for development. Live keys are only accepted when NODE_ENV=production.`,
    );
  }
  return mode;
}
