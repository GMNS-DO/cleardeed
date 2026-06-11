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

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { orderId, tehsil, tehsilValue, village, villageCode, searchMode, identifier, claimedOwnerName, email, whatsapp } = body as {
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
  };

  if (!orderId || !tehsil || !village || !villageCode || !searchMode || !identifier) {
    return NextResponse.json(
      { error: "Missing required fields: orderId, tehsil, village, villageCode, searchMode, identifier" },
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
    preGeneratedReportId: (body as { preGeneratedReportId?: string }).preGeneratedReportId ?? null,
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
    return NextResponse.json({ stored: true });
  } catch (err) {
    // Supabase not configured — this is acceptable for demo/dev environments
    console.warn("[/api/checkout] Supabase not configured, skipping session storage:", err);
    return NextResponse.json({ stored: true, note: "persistence not configured" });
  }
}