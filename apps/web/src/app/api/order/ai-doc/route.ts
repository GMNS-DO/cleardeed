/**
 * POST /api/order/ai-doc
 *
 * Creates a Razorpay order for the AI document summary upsell (₹499).
 *
 * The plan (§3.1) gates the IGR EC AI summary behind this paid flow.
 * The V1 cost-tracker is bypass-free: a paid orderId is required before
 * the SSE route accepts the AI call, so an unpaid user cannot burn
 * tokens. The webhook handler (apps/web/src/app/api/webhook/razorpay)
 * flips `orgs.has_ai_doc = true` on payment success.
 *
 * Input:  { reportId: string, docType: "igr_ec" | "bhulekh_back" }
 * Output: { orderId, amount, currency, receipt }
 */
import { NextRequest, NextResponse } from "next/server";
import { assertRazorpaySafe, getRazorpayKeys } from "@/lib/razorpay-config";
import { supabaseAdmin } from "@/lib/db";

const AI_DOC_AMOUNT_PAISE = 49900; // ₹499

export async function POST(req: NextRequest) {
  let mode: ReturnType<typeof assertRazorpaySafe>;
  try {
    mode = assertRazorpaySafe();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 503 });
  }

  const keys = getRazorpayKeys();
  if (!keys) {
    return NextResponse.json(
      { error: "Razorpay keys disappeared mid-request (env race condition)" },
      { status: 503 }
    );
  }
  const { keyId, keySecret } = keys;

  let body: { reportId?: string; docType?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // Minimal validation. The webhook re-validates against the DB.
  if (!body.reportId || typeof body.reportId !== "string") {
    return NextResponse.json(
      { error: "reportId is required" },
      { status: 400 }
    );
  }
  if (body.docType !== "igr_ec" && body.docType !== "bhulekh_back") {
    return NextResponse.json(
      { error: "docType must be 'igr_ec' or 'bhulekh_back'" },
      { status: 400 }
    );
  }

  const receipt = `aidoc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  const auth = Buffer.from(`${keyId}:${keySecret}`).toString("base64");

  try {
    const response = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${auth}`,
      },
      body: JSON.stringify({
        amount: AI_DOC_AMOUNT_PAISE,
        currency: "INR",
        receipt,
        notes: {
          reportId: body.reportId,
          docType: body.docType,
          product: "ai_doc_summary",
        },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("[/api/order/ai-doc] Razorpay error:", errText);
      return NextResponse.json(
        { error: `Razorpay order creation failed: ${errText}` },
        { status: 502 }
      );
    }

    const order = (await response.json()) as {
      id: string;
      amount: number;
      currency: string;
      receipt: string;
      status: string;
    };

    // Persist a checkout_sessions row so the webhook can find the
    // (reportId, docType) when payment.captured fires. Same pattern
    // as /api/reports/[id]/refresh — webhook dispatches on
    // session_data.kind.
    try {
      const { error: sessionError } = await supabaseAdmin()
        .from("checkout_sessions")
        .upsert(
          {
            order_id: order.id,
            session_data: {
              kind: "ai_doc",
              reportId: body.reportId,
              docType: body.docType,
              amount: order.amount,
            },
            expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
          },
          { onConflict: "order_id" }
        );

      if (sessionError) {
        console.error("[/api/order/ai-doc] Failed to store ai_doc session:", sessionError);
        // We still return the order — the user can attempt payment; the
        // webhook will be a no-op if the session is missing, and the user
        // can retry from the upsell gate.
      }
    } catch (err) {
      console.warn("[/api/order/ai-doc] Supabase not configured:", err);
    }

    return NextResponse.json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      receipt: order.receipt,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[/api/order/ai-doc]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
