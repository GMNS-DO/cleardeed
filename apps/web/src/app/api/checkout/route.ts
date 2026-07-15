/**
 * POST /api/checkout
 *
 * Stores plot search parameters keyed by Razorpay order_id.
 * Called before opening the Razorpay modal — data is retrieved by the webhook
 * after successful payment.
 *
 * Input: { orderId, tehsil, tehsilValue, village, villageCode, searchMode, identifier, claimedOwnerName?, email?, whatsapp?, tier, guaranteeAccepted?, lawyerId? }
 * Output: { stored: true } or { error }
 */
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/db";
import { trackEvent } from "@/lib/track";
import { getAuthUser } from "@/lib/auth-helpers";
import { parseTier } from "@/lib/pricing";

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

  const { orderId, tehsil, tehsilValue, village, villageCode, searchMode, identifier, claimedOwnerName, email, whatsapp, tier, guaranteeAccepted, lawyerId, pdpdAccepted } = body as {
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
    /**
     * PI-3 T2 — buyer-side consent to the 18-month correctness guarantee.
     * Required ONLY when tier === "guaranteed"; free / standard / verified
     * do not need it.
     */
    guaranteeAccepted?: boolean;
    /**
     * T3 — optional lawyer selection for the advocate co-sign half of the
     * Guaranteed tier. Persisted as a hint; webhook reads it from
     * session_data and writes reports.lawyer_id.
     */
    lawyerId?: string | null;
    /**
     * PDPD Act consent — required for ALL tiers. The buyer affirms that
     * their plot and contact details may be used solely to produce this
     * report. Refusal is a hard gate; the report cannot be generated.
     */
    pdpdAccepted?: boolean;
  };

  if (!orderId || !tehsil || !village || !villageCode || !searchMode || !identifier || !tier) {
    return NextResponse.json(
      { error: "Missing required fields: orderId, tehsil, village, villageCode, searchMode, identifier, tier" },
      { status: 400 }
    );
  }

  const parsedTier = parseTier(tier);
  if (!parsedTier) {
    return NextResponse.json(
      { error: "invalid_tier", message: `Unknown tier "${tier}".` },
      { status: 400 }
    );
  }

  // PDPD consent: required for all tiers. Without it we cannot legally
  // store the buyer's contact details against the report.
  if (pdpdAccepted !== true) {
    return NextResponse.json(
      {
        error: "consent_required",
        message: "Please accept the privacy policy before purchasing.",
      },
      { status: 400 }
    );
  }

  // PI-3 T2: the 18-month guarantee is the headline reason to pay ₹4,999.
  // Buyers must affirmatively accept the terms before Razorpay opens. The
  // webhook reads `guaranteeAccepted` from session_data and stamps
  // reports.guarantee_accepted_at.
  if (parsedTier === "guaranteed" && guaranteeAccepted !== true) {
    return NextResponse.json(
      {
        error: "guarantee_consent_required",
        message: "You must accept the 18-month guarantee terms to purchase the Guaranteed tier.",
      },
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
    // PI-3 T2: persist the consent flag. Only meaningful when the buyer opted
    // in (guaranteed tier); false/absent for every other tier. The webhook
    // uses this to set reports.guarantee_accepted_at on successful payment.
    guaranteeAccepted: parsedTier === "guaranteed" ? guaranteeAccepted === true : false,
    // T3: optional lawyer selection. Accept whatever the client passes;
    // never require it. Webhook reads it and writes reports.lawyer_id.
    lawyerId: lawyerId ?? null,
    // PDPD consent — persisted for audit trail.
    pdpdAccepted: pdpdAccepted === true,
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
