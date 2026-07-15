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
import {
  bumpReportExpiry,
  createReport,
  getReportBhulekhStatus,
  getReportErrorMessage,
  getReportHtml,
  getReportSourceSummary,
  getReportTitle,
  markReportPaid,
  supabaseAdmin,
  updateReportResults,
  type ReportLike,
} from "@/lib/db";
import { sendReportEmail } from "@/lib/email";
import { addReportAccessTokensToHtml, buildReportUrl } from "@/lib/report-access";
import { trackEvent } from "@/lib/track";
import { tierFromAmountPaise } from "@/lib/pricing";
import { setPipelineStatus } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface CheckoutSession {
  tehsil?: string;
  tehsilValue?: string;
  village?: string;
  villageCode?: string;
  searchMode?: string;
  identifier?: string;
  claimedOwnerName?: string;
  email?: string;
  whatsapp?: string;
  /** T-013: auth.uid() captured at checkout time. */
  auth_uid?: string | null;
  preGeneratedReportId?: string | null;
  preGeneratedHtml?: string | null;
  preGeneratedTitle?: string | null;
  /** "refresh" for pay-to-refresh; absent (or anything else) for first purchase. */
  kind?: string;
  /** Set when kind === "refresh" — the report whose expires_at should be bumped. */
  reportId?: string;
  /** PI-3 T2: buyer-side guarantee consent captured at checkout. */
  guarantee_accepted?: boolean;
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

/**
 * PI-3 T2: when a Guaranteed-tier payment succeeds and the buyer accepted
 * the terms at checkout, stamp NOW() onto reports.guarantee_accepted_at.
 * The report footer reads this column to render the guarantee block.
 *
 * No-ops when:
 *   - reportId is missing (slow-path failures)
 *   - guaranteeAccepted is false (buyer did not opt in, or paid another tier)
 */
async function stampGuaranteeAccepted(reportId: string, guaranteeAccepted: boolean | undefined): Promise<void> {
  if (!reportId || !guaranteeAccepted) return;
  try {
    await supabaseAdmin()
      .from("reports")
      .update({ guarantee_accepted_at: new Date().toISOString() })
      .eq("id", reportId);
  } catch (err) {
    console.warn(`[/api/webhook/razorpay] stampGuaranteeAccepted failed for ${reportId}:`, err);
  }
}

function isUsableBhulekhReport(report: ReportLike): boolean {
  const html = getReportHtml(report) ?? "";
  const bhulekhStatus = getReportBhulekhStatus(report) ?? "";
  const sourceSummary = getReportSourceSummary(report);
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

  // ── Pay-to-refresh fast path: bump expires_at, skip pipeline + email ──────
  if (session.kind === "refresh" && session.reportId) {
    const { expiresAt } = await bumpReportExpiry(session.reportId);
    try {
      await supabaseAdmin().from("audit_log").insert({
        report_id: session.reportId,
        event_type: "report_refreshed",
        event_data: { orderId, expiresAt },
      });
    } catch (auditErr) {
      console.warn("[/api/webhook/razorpay] audit_log insert failed (refresh):", auditErr);
    }
    console.info(`[/api/webhook/razorpay] Refresh: bumped expires_at to ${expiresAt ?? "unknown"} for report ${session.reportId}`);
    return NextResponse.json({
      handled: true,
      kind: "refresh",
      reportId: session.reportId,
      reportUrl: buildReportUrl(session.reportId, process.env.CLEARDEED_BASE_URL ?? req.nextUrl.origin),
      status: "refreshed",
      expiresAt,
    });
  }

  // ── Fast path: report was pre-generated during checkout ─────────────────
  if (session.preGeneratedReportId) {
    console.info(`[/api/webhook/razorpay] Looking for pre-generated report: ${session.preGeneratedReportId}`);
    const { getReport } = await import("@/lib/db");
    try {
      const result = await getReport(session.preGeneratedReportId);
      const report = result?.report;
      const existingHtml = getReportHtml(report);
      const existingTitle = getReportTitle(report) ?? "ClearDeed Report";
      if (existingHtml && isUsableBhulekhReport(report)) {
        const reportHtml = addReportAccessTokensToHtml(existingHtml, session.preGeneratedReportId);
        if (session.email) {
          const { sendReportEmail } = await import("@/lib/email");
          await sendReportEmail({
            to: session.email,
            reportId: session.preGeneratedReportId,
            reportTitle: existingTitle,
            reportHtml,
          });
        }
        // Funnel: webhook confirmed payment
        await trackEvent({
          eventName: "payment_success",
          reportId: session.preGeneratedReportId,
          metadata: { orderId, fastPath: true, amount: event.payload?.order?.entity?.amount ?? 0 },
        });
        // T-014: mark report paid so the metering gate on /api/report/create
        // sees the count move from N → N+1 after this user buys a paid tier.
        // Idempotent — RPC refuses to downgrade or change price.
        const orderAmount = event.payload?.order?.entity?.amount ?? 0;
        const paidTier = tierFromAmountPaise(orderAmount);
        if (paidTier && paidTier !== "free_preview") {
          try {
            await markReportPaid({
              reportId: session.preGeneratedReportId,
              paidTier,
              pricePaidPaise: orderAmount,
              paidAt: new Date().toISOString(),
              paidOrderId: orderId,
            });
          } catch (markErr) {
            console.warn("[/api/webhook/razorpay] markReportPaid failed (fast path):", markErr);
          }
          // PI-3 T2: stamp guarantee_accepted_at when buyer consented at checkout.
          await stampGuaranteeAccepted(session.preGeneratedReportId, session.guarantee_accepted);
        }
        // Funnel: report delivered to buyer (webhook path)
        await trackEvent({
          eventName: "report_delivered",
          reportId: session.preGeneratedReportId,
          metadata: { source: "webhook", emailSent: Boolean(session.email), orderId },
        });
        return NextResponse.json({
          handled: true,
          reportId: session.preGeneratedReportId,
          reportUrl: buildReportUrl(session.preGeneratedReportId, process.env.CLEARDEED_BASE_URL ?? req.nextUrl.origin),
          status: getReportErrorMessage(report) ? "generated_with_error" : "generated",
          emailSent: Boolean(session.email),
        });
      } else if (existingHtml) {
        console.warn(`[/api/webhook/razorpay] Pre-generated report ${session.preGeneratedReportId} has unusable Bhulekh data; refusing to deliver hollow report.`);
      }
    } catch (err) {
      console.warn(`[/api/webhook/razorpay] Could not retrieve pre-generated report:`, err);
    }
  }

  if (!session.tehsil || !session.village || !session.villageCode || !session.searchMode || !session.identifier) {
    console.error(`[/api/webhook/razorpay] Payment captured for ${orderId}, but checkout session is missing report inputs`, {
      hasTehsil: Boolean(session.tehsil),
      hasVillage: Boolean(session.village),
      hasVillageCode: Boolean(session.villageCode),
      hasSearchMode: Boolean(session.searchMode),
      hasIdentifier: Boolean(session.identifier),
    });
    return NextResponse.json({
      handled: true,
      status: "failed",
      emailSent: false,
      error: "Payment captured, but checkout session was missing report inputs.",
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
      userId: session.auth_uid ?? null,
    });
    reportId = dbResult.reportId;
    persistenceEnabled = true;
  } catch (dbError) {
    console.warn("[/api/webhook/razorpay] DB create failed:", dbError);
  }

  // ── Generate report ───────────────────────────────────────────────────────
  const pipelineStartedAt = Date.now();
  let pipelineOutput: Awaited<ReturnType<typeof generateReportV11>> | null = null;
  let reportError: string | null = null;
  const PIPELINE_SLA_MS = 24_000; // Bhulekh SLA (22s) + headroom

  try {
    pipelineOutput = await generateReportV11({
      reportId,
      tehsil: session.tehsil,
      tehsilValue: session.tehsilValue ?? session.tehsil,
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

  // PI-4 T4: SLA gate. If Bhulekh took longer than the per-source SLA +
  // headroom (22s + 2s = 24s), surface `generated_with_error` rather than
  // claiming a successful report. This prevents a buyer from paying for
  // a report that's built from stale or timeout-truncated data.
  const pipelineDurationMs = Date.now() - pipelineStartedAt;
  const slaLimited = pipelineDurationMs > PIPELINE_SLA_MS;
  if (slaLimited) {
    reportError = `Pipeline SLA exceeded: ${pipelineDurationMs}ms > ${PIPELINE_SLA_MS}ms. Government data source was slow; report may be incomplete. Refund or re-run is available — reply to your confirmation email.`;
    // Null the HTML so the buyer doesn't see a half-built report.
    pipelineOutput = null;
  }

  // ── Persist pipeline outcome ───────────────────────────────────────────────
  if (persistenceEnabled && reportId) {
    const finalStatus = (reportError && !pipelineOutput) ? "failed" : (slaLimited ? "generated_with_error" : "success");
    try {
      await setPipelineStatus({ reportId, pipelineStatus: finalStatus, pipelineError: reportError });
    } catch (statusErr) {
      console.warn("[/api/webhook/razorpay] setPipelineStatus failed (non-fatal):", statusErr);
    }
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

    // T-014: slow path — mark this report as paid so the metering gate
    // on /api/report/create sees the user has used their free preview.
    // Same idempotency guarantee as the fast path.
    const orderAmountSlow = event.payload?.order?.entity?.amount ?? 0;
    const paidTierSlow = tierFromAmountPaise(orderAmountSlow);
    if (paidTierSlow && paidTierSlow !== "free_preview") {
      try {
        await markReportPaid({
          reportId,
          paidTier: paidTierSlow,
          pricePaidPaise: orderAmountSlow,
          paidAt: new Date().toISOString(),
          paidOrderId: orderId,
        });
      } catch (markErr) {
        console.warn("[/api/webhook/razorpay] markReportPaid failed (slow path):", markErr);
      }
      // PI-3 T2: slow path guarantee stamp — same semantics as fast path.
      await stampGuaranteeAccepted(reportId, session.guarantee_accepted);
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

  // Funnel: webhook confirmed payment and report generated
  if (reportId) {
    await trackEvent({
      eventName: "payment_success",
      reportId,
      metadata: { orderId, amount: event.payload?.order?.entity?.amount ?? 0, hasError: Boolean(reportError) },
    });
    // Funnel: report delivered to buyer (webhook slow path)
    await trackEvent({
      eventName: "report_delivered",
      reportId,
      metadata: { source: "webhook", orderId, hasError: Boolean(reportError) },
    });
  }

  return NextResponse.json({
    handled: true,
    reportId,
    reportUrl: reportId ? buildReportUrl(reportId, process.env.CLEARDEED_BASE_URL ?? req.nextUrl.origin) : null,
    status: reportError ? "generated_with_error" : "generated",
    emailSent: Boolean(session.email && pipelineOutput),
  });
}
