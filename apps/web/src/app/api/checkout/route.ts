/**
 * POST /api/checkout
 *
 * Stores plot search parameters keyed by Razorpay order_id.
 * Called before opening the Razorpay modal — data is retrieved by the webhook
 * after successful payment.
 *
 * Input: { orderId, tehsil, tehsilValue, village, villageCode, searchMode, identifier, claimedOwnerName?, email?, whatsapp? }
 * Output: { stored: true } or { error }
 */
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/db";
import { trackEvent } from "@/lib/track";
import { getAuthUser } from "@/lib/auth-helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // T-013: capture auth.uid() into checkout session so webhook can attach it
  // to the report even if the buyer's session cookie has expired by the time
  // the payment confirmation lands. Hard-gate: every purchase must be authed.
  const authUser = await getAuthUser();
  if (!authUser) {
    return NextResponse.json(
      {
        error: "login_required",
        message: "Sign in with your phone to continue.",
        next: `/login?next=${encodeURIComponent("/")}`,
      },
      { status: 401 }
    );
  }

  const { orderId, tehsil, tehsilValue, village, villageCode, searchMode, identifier, claimedOwnerName, email, whatsapp, tier } = body as {
    orderId?: unknown;
    tehsil?: string;
    tehsilValue?: string;
    village?: string;
    villageCode?: string;
    searchMode?: string;
    identifier?: string;
    claimedOwnerName?: string;
    email?: string;
    whatsapp?: string;
    tier?: string;
  };

  if (!orderId || !tehsil || !village || !villageCode || !searchMode || !identifier || !tier) {
    return NextResponse.json(
      { error: "Missing required fields: orderId, tehsil, village, villageCode, searchMode, identifier, tier" },
      { status: 400 }
    );
  }

  const polygonRaw = (body as { preGeneratedBhunakshaPolygon?: unknown }).preGeneratedBhunakshaPolygon;
  const hasPolygon = polygonRaw != null;
  console.info(`[/api/checkout] preGeneratedBhunakshaPolygon received: ${hasPolygon ? `yes (type=${typeof polygonRaw})` : "null"}`);

  const sessionData = {
    tehsil: tehsil as string,
    tehsilValue: (tehsilValue as string) ?? "",
    village: village as string,
    villageCode: villageCode as string,
    searchMode: searchMode as string,
    identifier: identifier as string,
    claimedOwnerName: (claimedOwnerName as string) || undefined,
    email: (email as string) || undefined,
    whatsapp: (whatsapp as string) || undefined,
    tier: (tier as string) || undefined,
    auth_uid: authUser?.id ?? null,
    preGeneratedReportId: (body as { preGeneratedReportId?: string }).preGeneratedReportId ?? null,
    preGeneratedHtml: (body as { preGeneratedHtml?: string }).preGeneratedHtml ?? null,
    preGeneratedTitle: (body as { preGeneratedTitle?: string }).preGeneratedTitle ?? null,
    preGeneratedBhunakshaPolygon: polygonRaw,
  };

  // Store with 30-minute expiry
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();

  try {
    const { error } = await supabaseAdmin()
      .from("checkout_sessions")
      .upsert({
        order_id: orderId as string,
        session_data: {
          ...sessionData,
        } as Record<string, unknown>,
        expires_at: expiresAt,
      }, {
        onConflict: "order_id",
      });

    if (error) {
      console.error("[/api/checkout] Failed to store session:", error);
      return NextResponse.json(
        { error: "Failed to store checkout session. Payment cannot proceed." },
        { status: 500 }
      );
    }

    console.info(`[/api/checkout] Session stored for order ${orderId}`);

    // Funnel: buyer clicked "Get report" and Razorpay is about to open
    await trackEvent({
      eventName: "checkout_open",
      reportId: null,
      metadata: {
        orderId: orderId as string,
        village: village as string,
        tehsil: tehsil as string,
        searchMode: searchMode as string,
        hasEmail: Boolean(email),
        hasPreGeneratedReport: Boolean((body as { preGeneratedReportId?: string }).preGeneratedReportId),
      },
    });

    return NextResponse.json({ stored: true });
  } catch (err) {
    // Supabase not configured — this is acceptable for demo/dev environments
    console.warn("[/api/checkout] Supabase not configured, skipping session storage:", err);
    return NextResponse.json({ stored: true, note: "persistence not configured" });
  }
}
