#!/usr/bin/env node
/**
 * qa/razorpay_smoke.mjs — Razorpay integration smoke test.
 *
 * Goal: prove the order-creation code path runs end-to-end without
 * requiring a browser, the Razorpay modal, or a real charge.
 *
 * What this script does:
 *  1. Reads the configured RAZORPAY_KEY_ID and classifies it (test / live /
 *     unconfigured). Refuses to proceed if a live key is set in a
 *     non-production NODE_ENV.
 *  2. POSTs to /api/order on the local dev server.
 *  3. Asserts the response is HTTP 200 with a non-empty orderId.
 *  4. Prints a small report so you can see what the order looks like.
 *
 * What this script does NOT do:
 *  - Open the Razorpay checkout modal (that's a browser-side concern)
 *  - Trigger a webhook (that requires a successful payment)
 *  - Touch .env.local or write any secrets to disk
 *
 * Usage:
 *   node qa/razorpay_smoke.mjs                    # default: localhost:3000
 *   node qa/razorpay_smoke.mjs --api http://localhost:3000
 *   node qa/razorpay_smoke.mjs --api https://v0-cleardeed.vercel.app
 *
 * The script reads keys from the dev server's environment (via /api/order),
 * not from this process's env. So you can run it without exporting anything.
 */

import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const args = process.argv.slice(2);
const apiUrl = (() => {
  const i = args.indexOf("--api");
  return i >= 0 && args[i + 1] ? args[i + 1] : "http://localhost:3000";
})();

// ── Read .env.local (without echoing values) ─────────────────────────────────
// We don't print the secret value. We only print a redacted prefix so you
// can confirm the right key is configured.
function readEnvLocalKey(name) {
  const envPath = join(process.cwd(), "apps/web/.env.local");
  if (!existsSync(envPath)) return null;
  const text = readFileSync(envPath, "utf-8");
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const [k, ...rest] = trimmed.split("=");
    if (k === name) return rest.join("=").trim();
  }
  return null;
}

function classify(key) {
  if (!key) return "unconfigured";
  if (key.startsWith("rzp_test_")) return "test";
  if (key.startsWith("rzp_live_")) return "live";
  return "live"; // unknown prefix → conservative
}

function redact(key) {
  if (!key) return "(unset)";
  if (key.length < 12) return `${key.slice(0, 4)}***`;
  return `${key.slice(0, 8)}...${key.slice(-4)}`;
}

// ── Step 1: classify configured key ───────────────────────────────────────────
const configuredKeyId = readEnvLocalKey("RAZORPAY_KEY_ID") ?? readEnvLocalKey("NEXT_PUBLIC_RAZORPAY_KEY_ID");
const mode = classify(configuredKeyId);

console.log("─── Razorpay smoke test ────────────────────────────────────");
console.log(`API URL:                ${apiUrl}`);
console.log(`NODE_ENV:               ${process.env.NODE_ENV ?? "(unset)"}`);
console.log(`Configured keyId:       ${redact(configuredKeyId)}`);
console.log(`Classified mode:        ${mode}`);
console.log("────────────────────────────────────────────────────────────");

if (mode === "unconfigured") {
  console.error("\n[smoke] FAIL: No Razorpay key configured.");
  console.error("[smoke] Set RAZORPAY_KEY_ID in apps/web/.env.local.");
  console.error("[smoke] Get a test key from https://dashboard.razorpay.com/app/keys");
  process.exit(2);
}

if (mode === "live" && process.env.NODE_ENV !== "production") {
  console.error(`\n[smoke] FAIL: Refusing to use a LIVE key with NODE_ENV=${process.env.NODE_ENV ?? "(unset)"}.`);
  console.error("[smoke] Use a test key (rzp_test_*) for local development.");
  process.exit(2);
}

// ── Step 2: reachability check ───────────────────────────────────────────────
console.log(`\n[smoke] checking API at ${apiUrl} ...`);
try {
  const reachRes = await fetch(`${apiUrl}/`, { method: "GET" });
  console.log(`[smoke] API reachable (HTTP ${reachRes.status})`);
} catch (err) {
  console.error(`\n[smoke] FAIL: API not reachable: ${err?.message ?? err}`);
  console.error(`[smoke] Start the dev server first: pnpm dev (in another terminal)`);
  process.exit(2);
}

// ── Step 3: POST /api/order ──────────────────────────────────────────────────
console.log(`\n[smoke] POST /api/order ...`);
const orderReq = await fetch(`${apiUrl}/api/order`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    email: "smoke-test@cleardeed.in",
    plotDescription: "QA smoke test — Mendhasala/415 (not a real buyer)",
  }),
});

const orderText = await orderReq.text();
let orderJson = null;
try { orderJson = JSON.parse(orderText); } catch { /* not JSON */ }

if (!orderReq.ok) {
  console.error(`\n[smoke] FAIL: HTTP ${orderReq.status}`);
  console.error(`[smoke] body: ${orderText.slice(0, 500)}`);
  if (orderReq.status === 503 && orderJson?.error?.includes("LIVE")) {
    console.error(`[smoke] → The server is configured with a live key in development mode.`);
    console.error(`[smoke]   Replace it with a test key (rzp_test_*) and retry.`);
  } else if (orderReq.status === 500 && orderJson?.error?.includes("not configured")) {
    console.error(`[smoke] → The server has no Razorpay keys in its environment.`);
    console.error(`[smoke]   Set them in apps/web/.env.local and restart the dev server.`);
  } else if (orderReq.status === 502) {
    console.error(`[smoke] → Razorpay rejected the request. The key is configured but invalid.`);
  }
  process.exit(1);
}

const orderId = orderJson?.orderId;
const amount = orderJson?.amount;
const currency = orderJson?.currency;
const receipt = orderJson?.receipt;

console.log(`[smoke] HTTP 200 — order created`);
console.log(`[smoke] orderId:  ${orderId}`);
console.log(`[smoke] amount:   ${amount} (${currency})`);
console.log(`[smoke] receipt:  ${receipt}`);

// ── Step 4: assertions ───────────────────────────────────────────────────────
let failed = false;

if (typeof orderId !== "string" || !orderId.startsWith("order_")) {
  console.error(`[smoke] FAIL: orderId does not start with 'order_': ${orderId}`);
  failed = true;
}
if (amount !== 100) {
  console.error(`[smoke] FAIL: expected amount=100 paise (₹1), got ${amount}`);
  failed = true;
}
if (currency !== "INR") {
  console.error(`[smoke] FAIL: expected currency=INR, got ${currency}`);
  failed = true;
}
if (typeof receipt !== "string" || !receipt.startsWith("cd_")) {
  console.error(`[smoke] FAIL: receipt does not start with 'cd_': ${receipt}`);
  failed = true;
}

if (failed) {
  console.error(`\n[smoke] FAIL: order response shape does not match the expected contract.`);
  process.exit(1);
}

console.log(`\n[smoke] PASS — order created, all assertions held.`);
console.log(``);
console.log(`What was tested:`);
console.log(`  - The configured Razorpay key is ${mode} mode (${redact(configuredKeyId)})`);
console.log(`  - The order route did not refuse the call (safety guard passed)`);
console.log(`  - Razorpay accepted the request and returned a valid order`);
console.log(`  - The order shape matches what /api/checkout and the modal expect`);
console.log(``);
console.log(`What was NOT tested (out of scope for a smoke test):`);
console.log(`  - The Razorpay checkout modal (browser-only)`);
console.log(`  - The /api/webhook/razorpay signature verification (needs a real payment)`);
console.log(`  - The full buyer flow end-to-end (use the UI for that)`);
console.log(``);
console.log(`Next steps to manually complete the test:`);
console.log(`  1. Open http://localhost:3000 in a browser`);
console.log(`  2. Fill in the form with Mendhasala/415`);
console.log(`  3. When the Razorpay modal opens, use test card 4111 1111 1111 1111`);
console.log(`     with any future expiry and any CVV. See:`);
console.log(`     https://razorpay.com/docs/payments/payments/test-card-details/`);
console.log(`  4. After the test payment, check that:`);
console.log(`     - /api/webhook/razorpay receives a payment.captured event`);
console.log(`     - The report is generated and emailed`);
console.log(`     - The success page renders the report link`);
console.log(``);
process.exit(0);
