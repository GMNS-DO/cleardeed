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
import { addReportAccessTokensToHtml, buildReportUrl } from "@/lib/report-access";

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
  preGeneratedReportId?: string | null;
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

function isUsableBhulekhReport(report: Record<string, unknown> | null | undefined): boolean {
  const html = String(report?.html ?? report?.report_html ?? "");
  const bhulekhStatus = String(report?.bhulekhStatus ?? report?.bhulekh_status ?? "");
  const sourceSummary = report?.sourceSummary ?? report?.source_summary;
  const sourceSummaryText = typeof sourceSummary === "string" ? sourceSummary : JSON.stringify(sourceSummary ?? {});

  if (!html.trim()) return false;
  if (/RoR owner details are unavailable|Bhulekh land-record data was not usable/i.test(html)) return false;
  if (/^(failed|error|not_covered|unknown)$/i.test(bhulekhStatus.trim())) return false;
  if (/"bhulekh"\s*:\s*"(failed|error|not_covered|unknown)"/i.test(sourceSummaryText)) return false;
  return /tenant\(s\)|Khatiyan|Bhulekh RoR|Land-record source: Bhulekh/i.test(html);
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

  // ── Fast path: report was pre-generated during checkout ─────────────────
  if (session.preGeneratedReportId) {
    console.info(`[/api/webhook/razorpay] Looking for pre-generated report: ${session.preGeneratedReportId}`);
    const { getReport } = await import("@/lib/db");
    try {
      const result = await getReport(session.preGeneratedReportId);
      const report = result?.report;
      if (report?.html && isUsableBhulekhReport(report as Record<string, unknown>)) {
        const reportHtml = addReportAccessTokensToHtml(report.html, session.preGeneratedReportId);
        if (session.email) {
          const { sendReportEmail } = await import("@/lib/email");
          await sendReportEmail({
            to: session.email,
            reportId: session.preGeneratedReportId,
            reportTitle: report.title ?? "ClearDeed Report",
            reportHtml,
          });
        }
        return NextResponse.json({
          handled: true,
          reportId: session.preGeneratedReportId,
          reportUrl: buildReportUrl(session.preGeneratedReportId, process.env.CLEARDEED_BASE_URL ?? req.nextUrl.origin),
          status: report.errorMessage ? "generated_with_error" : "generated",
          emailSent: Boolean(session.email),
        });
      } else if (report?.html) {
        console.warn(`[/api/webhook/razorpay] Pre-generated report ${session.preGeneratedReportId} has unusable Bhulekh data; refusing to deliver hollow report.`);
      }
    } catch (err) {
      console.warn(`[/api/webhook/razorpay] Could not retrieve pre-generated report:`, err);
    }
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
  const reportHtml = pipelineOutput && reportId
    ? addReportAccessTokensToHtml(pipelineOutput.html, reportId)
    : "";

  if (persistenceEnabled && reportId) {
    try {
      await updateReportResults({
        reportId,
        reportHtml,
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

  if (reportError || !reportHtml.trim()) {
    console.warn(
      `[/api/webhook/razorpay] Payment captured but no usable Bhulekh-backed report was generated for ${reportId}:`,
      reportError ?? "empty report HTML"
    );
    return NextResponse.json({
      handled: true,
      reportId,
      reportUrl: reportId ? buildReportUrl(reportId, process.env.CLEARDEED_BASE_URL ?? req.nextUrl.origin) : null,
      status: "failed",
      emailSent: false,
      error: reportError ?? "Report generation did not produce HTML",
    });
  }

  // ── Send email ──────────────────────────────────────────────────────────────
  if (session.email && reportId && pipelineOutput) {
    const emailResult = await sendReportEmail({
      to: session.email,
      reportId,
      reportTitle: pipelineOutput.title,
      reportHtml,
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
    reportUrl: reportId ? buildReportUrl(reportId, process.env.CLEARDEED_BASE_URL ?? req.nextUrl.origin) : null,
    status: reportError ? "generated_with_error" : "generated",
    emailSent: Boolean(session.email && pipelineOutput),
  });
}
