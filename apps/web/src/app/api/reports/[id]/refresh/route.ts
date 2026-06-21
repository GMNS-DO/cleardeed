/**
 * POST /api/reports/:id/refresh
 *
 * Pay-to-refresh flow for a paid report whose 60-day window has expired.
 * Mirrors the existing /api/order + /api/checkout pattern for the initial
 * ₹1 purchase, but:
 *   - charges ₹299 (29900 paise)
 *   - tags the checkout session as `kind: "refresh"`
 *   - on webhook payment.captured, bumps the report's expires_at by 60 days
 *     and returns success — the fetcher pipeline is NOT re-run.
 *
 * Returns { orderId, amount, currency, receipt } for the client to open
 * Razorpay. The client then redirects to /report/{id} on success.
 */
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin, getReport, isReportExpired, type DbReport } from "@/lib/db";
import { getAuthUser } from "@/lib/auth-helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const REFRESH_AMOUNT_PAISE = 29900; // ₹299

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: reportId } = await params;

  if (!reportId) {
    return NextResponse.json({ error: "Missing report id" }, { status: 400 });
  }

  // T-013: capture auth.uid() for ownership verification. Hard-gate: a
  // report can only be refreshed by its authenticated owner.
  const authUser = await getAuthUser();
  if (!authUser) {
    return NextResponse.json(
      {
        error: "login_required",
        message: "Sign in to refresh your report.",
        next: `/login?next=${encodeURIComponent(`/report/${reportId}`)}`,
      },
      { status: 401 }
    );
  }

  const keyId = process.env.RAZORPAY_KEY_ID ?? process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;

  if (!keyId || !keySecret) {
    return NextResponse.json(
      { error: "RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET not configured" },
      { status: 500 }
    );
  }

  // ── Sanity-check the report exists, is actually expired, and belongs to the
  //    calling user. T-013: a paid report can only be refreshed by its owner.
  try {
    const { report } = await getReport(reportId) as {
      report: (DbReport & { userId?: string | null; expiresAt?: string | null; revokedAt?: string | null }) | null;
    };
    if (!report) {
      return NextResponse.json({ error: "Report not found" }, { status: 404 });
    }
    if (!isReportExpired(report)) {
      return NextResponse.json(
        { error: "Report is still valid — no refresh needed." },
        { status: 409 }
      );
    }
    const ownerId = report.userId ?? report.user_id ?? null;
    if (ownerId && authUser?.id !== ownerId) {
      return NextResponse.json(
        { error: "You can only refresh your own reports." },
        { status: 403 }
      );
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Could not load report: ${msg}` }, { status: 500 });
  }

  const receipt = `cdr_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const auth = Buffer.from(`${keyId}:${keySecret}`).toString("base64");

  // ── Create Razorpay order ──────────────────────────────────────────────────
  let orderId: string;
  try {
    const response = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${auth}`,
      },
      body: JSON.stringify({
        amount: REFRESH_AMOUNT_PAISE,
        currency: "INR",
        receipt,
        notes: {
          kind: "refresh",
          reportId,
        },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("[/api/reports/:id/refresh] Razorpay order error:", errText);
      return NextResponse.json(
        { error: `Razorpay order creation failed: ${errText}` },
        { status: 502 }
      );
    }

    const order = await response.json() as { id: string };
    orderId = order.id;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[/api/reports/:id/refresh] Razorpay call failed:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  // ── Store refresh session in checkout_sessions (same table as initial flow) ─
  // The webhook reads this by orderId; if it sees kind:"refresh" + reportId it
  // bumps expiry instead of running the pipeline.
  try {
    const { error } = await supabaseAdmin()
      .from("checkout_sessions")
      .upsert(
        {
          order_id: orderId,
          session_data: {
            kind: "refresh",
            reportId,
            auth_uid: authUser?.id ?? null,
          },
          expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
        },
        { onConflict: "order_id" }
      );

    if (error) {
      console.error("[/api/reports/:id/refresh] Failed to store refresh session:", error);
      // We still return the order so the user can attempt payment; the webhook
      // will be a no-op if the session is missing.
    }
  } catch (err) {
    console.warn("[/api/reports/:id/refresh] Supabase not configured:", err);
  }

  return NextResponse.json({
    orderId,
    amount: REFRESH_AMOUNT_PAISE,
    currency: "INR",
    receipt,
    reportId,
  });
}
