/**
 * POST /api/webhook/razorpay
 *
 * Razorpay payment webhook — fires on successful payment.
 *
 * Flow:
 * 1. Verify the webhook signature (x-razorpay-signature header)
 * 2. Retrieve checkout session from Supabase (order_id keyed)
 * 3. Generate report
 * 4. Send email to buyer
 *
 * Webhook endpoint to register in Razorpay Dashboard:
 *   https://cleardeed.in/api/webhook/razorpay
 */
import { NextRequest, NextResponse } from "next/server";
import { generateReportV11 } from "@/lib/pipeline";
import { createReport, updateReportResults, supabaseAdmin } from "@/lib/db";
import { sendReportEmail } from "@/lib/email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface CheckoutSession {
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

async function getCheckoutSession(orderId: string): Promise<CheckoutSession | null> {
  try {
    const { data, error } = await supabaseAdmin()
      .from("checkout_sessions")
      .select("session_data")
      .eq("order_id", orderId)
      .single();

    if (error || !data) return null;

    // Clean up session after retrieval
    await supabaseAdmin()
      .from("checkout_sessions")
      .delete()
      .eq("order_id", orderId);

    return data.session_data as CheckoutSession;
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  // ── Read raw body for signature verification ──────────────────────────────
  let rawBody: string;
  try {
    rawBody = await req.text();
  } catch {
    return NextResponse.json({ error: "Could not read request body" }, { status: 400 });
  }

  // ── Signature verification ──────────────────────────────────────────────
  const signature = req.headers.get("x-razorpay-signature");
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;

  if (webhookSecret && signature) {
    const crypto = await import("node:crypto");
    const expectedSig = crypto
      .createHmac("sha256", webhookSecret)
      .update(rawBody)
      .digest("hex");

    if (signature !== expectedSig) {
      console.warn("[/api/webhook/razorpay] Invalid webhook signature");
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }
  } else if (!webhookSecret) {
    console.warn("[/api/webhook/razorpay] RAZORPAY_WEBHOOK_SECRET not set — skipping signature verification");
  }

  // ── Parse event ──────────────────────────────────────────────────────────
  let event: {
    event: string;
    payload: {
      order: {
        entity: {
          id: string;
          receipt: string;
          notes: Record<string, string>;
          amount: number;
          currency: string;
        };
      };
    };
  };

  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  if (event.event !== "payment.captured") {
    return NextResponse.json({ handled: false, reason: `Event "${event.event}" not handled` });
  }

  const orderId = event.payload?.order?.entity?.id;
  if (!orderId) {
    return NextResponse.json({ error: "Missing order_id in webhook payload" }, { status: 400 });
  }

  console.info(`[/api/webhook/razorpay] Payment captured for order ${orderId} — amount ₹${(event.payload?.order?.entity?.amount ?? 0) / 100}`);

  // ── Retrieve checkout session ─────────────────────────────────────────────
  const session = await getCheckoutSession(orderId);
  if (!session) {
    console.error(`[/api/webhook/razorpay] No checkout session for order ${orderId}`);
    return NextResponse.json({
      handled: false,
      reason: "Checkout session not found. Check if checkout/session endpoint was called before Razorpay modal opened.",
    });
  }

  // ── Create report record in DB ──────────────────────────────────────────────
  let reportId: string | undefined;
  let persistenceEnabled = false;
  try {
    const dbResult = await createReport({
      gpsLat: 0,
      gpsLon: 0,
      claimedOwnerName: session.claimedOwnerName ?? session.identifier,
    });
    reportId = dbResult.reportId;
    persistenceEnabled = true;
  } catch (dbError) {
    console.warn("[/api/webhook/razorpay] DB create failed:", dbError);
  }

  // ── Generate report ───────────────────────────────────────────────────────
  let pipelineOutput: Awaited<ReturnType<typeof generateReportV11>> | null = null;
  let reportError: string | null = null;

  try {
    pipelineOutput = await generateReportV11({
      reportId,
      tehsil: session.tehsil,
      tehsilValue: session.tehsilValue,
      village: session.village,
      villageCode: session.villageCode,
      searchMode: session.searchMode as "Plot" | "Khatiyan" | "Tenant",
      identifier: session.identifier,
      claimedOwnerName: session.claimedOwnerName,
    });
    reportId = pipelineOutput.reportId;
  } catch (pipelineError) {
    reportError = pipelineError instanceof Error ? pipelineError.message : String(pipelineError);
    console.error(`[/api/webhook/razorpay] Report generation failed for ${reportId}:`, reportError);
  }

  // ── Persist results ─────────────────────────────────────────────────────────
  if (persistenceEnabled && reportId) {
    try {
      await updateReportResults({
        reportId,
        reportHtml: pipelineOutput?.html ?? "",
        reportTitle: pipelineOutput?.title ?? "Report",
        bhulekhStatus: pipelineOutput?.sourceSummary?.bhulekh,
        validationFindings: pipelineOutput?.validationFindings,
        sourceSummary: pipelineOutput?.sourceSummary,
        errorMessage: reportError ?? undefined,
      });
    } catch (dbError) {
      console.warn("[/api/webhook/razorpay] DB update failed:", dbError);
    }
  }

  // ── Send email ──────────────────────────────────────────────────────────────
  if (session.email && reportId && pipelineOutput) {
    const emailResult = await sendReportEmail({
      to: session.email,
      reportId,
      reportTitle: pipelineOutput.title,
      reportHtml: pipelineOutput.html,
    });

    if (emailResult.success) {
      console.info(`[/api/webhook/razorpay] Report email sent to ${session.email} (${emailResult.messageId})`);
    } else {
      console.warn(`[/api/webhook/razorpay] Email failed for ${reportId}: ${emailResult.error}`);
    }
  }

  return NextResponse.json({
    handled: true,
    reportId,
    status: reportError ? "generated_with_error" : "generated",
    emailSent: Boolean(session.email && pipelineOutput),
  });
}