/**
 * POST /api/order
 *
 * Creates a Razorpay order for the chosen tier (Standard ₹699, Verified
 * ₹1,999, Guaranteed ₹4,999). The amount is sourced server-side from
 * pricing.ts — never trust a client-supplied amount.
 *
 * Input: { tier: "standard" | "verified" | "guaranteed", email?: string, plotDescription?: string }
 * Output: { orderId, amount, currency, receipt, tier }
 */
import { NextRequest, NextResponse } from "next/server";
import { assertRazorpaySafe, getRazorpayKeys } from "@/lib/razorpay-config";
import { parseTier, TIERS } from "@/lib/pricing";

export async function POST(req: NextRequest) {
  // Safety guard: refuse to call Razorpay with a live key in non-production
  // environments, or with no key at all. The guard throws a descriptive
  // Error; we translate that to HTTP 503.
  let mode: "test" | "live";
  try {
    mode = assertRazorpaySafe();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 503 });
  }

  const keys = getRazorpayKeys();

  console.log(`[/api/order] Razorpay mode: ${mode} (NODE_ENV=${process.env.NODE_ENV})`);
  if (!keys) {
    return NextResponse.json(
      { error: "Razorpay keys disappeared mid-request (env race condition)" },
      { status: 503 },
    );
  }
  const { keyId, keySecret } = keys;

  let body: { tier?: unknown; email?: string; plotDescription?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // T-014: validate tier server-side. Refuse "free_preview" (that's a
  // direct /api/report/create call, not a checkout flow) and any bogus
  // value. The amount comes from pricing.ts, not from the request.
  const tier = parseTier(body.tier);
  if (!tier || tier === "free_preview") {
    return NextResponse.json(
      {
        error: "Invalid tier. Must be one of: standard, verified, guaranteed.",
        allowed: ["standard", "verified", "guaranteed"],
      },
      { status: 400 }
    );
  }
  const tierInfo = TIERS[tier];

  const receipt = `cd_${tier}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  const auth = Buffer.from(`${keyId}:${keySecret}`).toString("base64");

  try {
    const response = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${auth}`,
      },
      body: JSON.stringify({
        amount: tierInfo.amountPaise,
        currency: "INR",
        receipt,
        notes: {
          tier,
          email: body.email ?? "",
          plot: body.plotDescription ?? "",
        },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("[/api/order] Razorpay error:", errText);
      return NextResponse.json(
        { error: `Razorpay order creation failed: ${errText}` },
        { status: 502 }
      );
    }

    const order = await response.json() as {
      id: string;
      amount: number;
      currency: string;
      receipt: string;
      status: string;
    };

    return NextResponse.json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      receipt: order.receipt,
      tier,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[/api/order]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
