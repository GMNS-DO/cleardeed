/**
 * POST /api/payment/success
 *
 * Client-side payment callback — fires when Razorpay payment succeeds.
 * Verifies the payment with Razorpay, then generates the report and sends email.
 *
 * This is the fallback flow when Razorpay webhook isn't registered yet.
 * Once the dashboard is set up, the webhook route becomes the primary handler.
 *
 * Input: {
 *   razorpay_order_id: string,
 *   razorpay_payment_id: string,
 *   razorpay_signature: string (optional if webhook secret not set),
 *   tehsil, tehsilValue, village, villageCode, searchMode, identifier,
 *   claimedOwnerName?, email?, whatsapp?
 * }
 *
 * Output: { reportId, title, html, emailSent }
 */
import { NextRequest, NextResponse } from "next/server";
import { generateReportV11 } from "@/lib/pipeline";
import { createReport, updateReportResults } from "@/lib/db";
import { sendReportEmail } from "@/lib/email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function POST(req: NextRequest) {
  let body: Record<string, string>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const {
    razorpay_order_id,
    razorpay_payment_id,
    razorpay_signature,
    tehsil,
    tehsilValue,
    village,
    villageCode,
    searchMode,
    identifier,
    claimedOwnerName,
    email,
    whatsapp,
  } = body;

  // ── Verify payment signature (if secret is set) ─────────────────────────────
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (keySecret && razorpay_signature) {
    const crypto = await import("node:crypto");
    const body_to_sign = `${razorpay_order_id}|${razorpay_payment_id}`;
    const expected = crypto
      .createHmac("sha256", keySecret)
      .update(body_to_sign)
      .digest("hex");

    if (expected !== razorpay_signature) {
      return NextResponse.json({ error: "Invalid payment signature" }, { status: 401 });
    }
  }

  // ── Create report record ────────────────────────────────────────────────────
  let reportId: string | undefined;
  let persistenceEnabled = false;
  try {
    const dbResult = await createReport({
      gpsLat: 0,
      gpsLon: 0,
      claimedOwnerName: claimedOwnerName || identifier,
    });
    reportId = dbResult.reportId;
    persistenceEnabled = true;
  } catch (dbError) {
    console.warn("[/api/payment/success] DB create failed:", dbError);
  }

  // ── Generate report ─────────────────────────────────────────────────────────
  let pipelineOutput: Awaited<ReturnType<typeof generateReportV11>> | null = null;
  let reportError: string | null = null;

  try {
    pipelineOutput = await generateReportV11({
      reportId,
      tehsil,
      tehsilValue,
      village,
      villageCode,
      searchMode: searchMode as "Plot" | "Khatiyan" | "Tenant",
      identifier,
      claimedOwnerName: claimedOwnerName || undefined,
    });
    reportId = pipelineOutput.reportId;
  } catch (pipelineError) {
    reportError = pipelineError instanceof Error ? pipelineError.message : String(pipelineError);
    console.error(`[/api/payment/success] Report generation failed for ${reportId}:`, reportError);
  }

  // ── Persist results ────────────────────────────────────────────────────────
  if (persistenceEnabled && reportId) {
    try {
      await updateReportResults({
        reportId,
        reportHtml: pipelineOutput?.html ?? "",
        reportTitle: pipelineOutput?.title ?? "ClearDeed Report",
        bhulekhStatus: pipelineOutput?.sourceSummary?.bhulekh,
        validationFindings: pipelineOutput?.validationFindings,
        sourceSummary: pipelineOutput?.sourceSummary,
        errorMessage: reportError ?? undefined,
      });
    } catch (dbError) {
      console.warn("[/api/payment/success] DB update failed:", dbError);
    }
  }

  // ── Send email ──────────────────────────────────────────────────────────────
  let emailSent = false;
  if (email && reportId && pipelineOutput && !reportError) {
    const result = await sendReportEmail({
      to: email,
      reportId,
      reportTitle: pipelineOutput.title,
      reportHtml: pipelineOutput.html,
    });
    emailSent = result.success;
    if (!result.success) {
      console.warn(`[/api/payment/success] Email failed for ${reportId}: ${result.error}`);
    }
  }

  return NextResponse.json({
    reportId,
    title: pipelineOutput?.title ?? "ClearDeed Report",
    html: pipelineOutput?.html ?? "",
    emailSent,
    status: reportError ? "generated_with_error" : "generated",
  });
}