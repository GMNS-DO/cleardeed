/**
 * POST /api/order
 *
 * Creates a Razorpay order for ₹1 (100 paise).
 *
 * Input: { email?: string, plotDescription?: string }
 * Output: { orderId, amount, currency, receipt }
 */
import { NextRequest, NextResponse } from "next/server";

const RAZORPAY_AMOUNT_PAISE = 100; // ₹1

export async function POST(req: NextRequest) {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;

  if (!keyId || !keySecret) {
    return NextResponse.json(
      { error: "RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET not configured" },
      { status: 500 }
    );
  }

  let body: { email?: string; plotDescription?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const receipt = `cd_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  const auth = Buffer.from(`${keyId}:${keySecret}`).toString("base64");

  try {
    const response = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${auth}`,
      },
      body: JSON.stringify({
        amount: RAZORPAY_AMOUNT_PAISE,
        currency: "INR",
        receipt,
        notes: {
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
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[/api/order]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}