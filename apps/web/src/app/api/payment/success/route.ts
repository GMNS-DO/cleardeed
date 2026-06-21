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
 *   claimedOwnerName?, email?, whatsapp?,
 *   preGeneratedReportId?: string  // if pre-generation was used
 * }
 *
 * Output: { reportId, title, html, emailSent }
 */
import { NextRequest, NextResponse } from "next/server";
import { generateReportV11 } from "@/lib/pipeline";
import { createReport, updateReportResults, getReport, supabaseAdmin } from "@/lib/db";
import { sendReportEmail } from "@/lib/email";
import { addReportAccessTokensToHtml, buildReportUrl } from "@/lib/report-access";
import { trackEvent } from "@/lib/track";
import { getAuthUser } from "@/lib/auth-helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

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
  /** Pre-generated HTML stored directly in session as backup */
  preGeneratedHtml?: string | null;
  preGeneratedTitle?: string | null;
  preGeneratedBhulekhStatus?: string | null;
  preGeneratedError?: string | null;
  /** Bhunaksha polygon GeoJSON from pre-generation */
  preGeneratedBhunakshaPolygon?: unknown | null;
}

async function getCheckoutSession(orderId?: string): Promise<CheckoutSession | null> {
  if (!orderId) return null;
  try {
    const { data, error } = await supabaseAdmin()
      .from("checkout_sessions")
      .select("session_data")
      .eq("order_id", orderId)
      .maybeSingle();

    if (error || !data) return null;
    return data.session_data as CheckoutSession;
  } catch (err) {
    console.warn(`[/api/payment/success] Could not read checkout session for ${orderId}:`, err);
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
    preGeneratedReportId,
  } = body;

  // ── Verify payment signature (if secret is set) ─────────────────────────────
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (keySecret && !razorpay_signature) {
    return NextResponse.json({ error: "Missing payment signature" }, { status: 401 });
  }

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

  const checkoutSession = await getCheckoutSession(razorpay_order_id);
  const resolvedTehsil = tehsil || checkoutSession?.tehsil || "";
  const resolvedTehsilValue = tehsilValue || checkoutSession?.tehsilValue || "";
  const resolvedVillage = village || checkoutSession?.village || "";
  const resolvedVillageCode = villageCode || checkoutSession?.villageCode || "";
  const resolvedSearchMode = (searchMode || checkoutSession?.searchMode || "Plot") as "Plot" | "Khatiyan" | "Tenant";
  const resolvedIdentifier = identifier || checkoutSession?.identifier || "";
  const resolvedClaimedOwnerName = claimedOwnerName || checkoutSession?.claimedOwnerName || undefined;
  const resolvedEmail = email || checkoutSession?.email || undefined;
  const resolvedPreGeneratedReportId = preGeneratedReportId || checkoutSession?.preGeneratedReportId || undefined;
  const resolvedPreGeneratedHtml = checkoutSession?.preGeneratedHtml || undefined;

  const polygonFromSession = checkoutSession?.preGeneratedBhunakshaPolygon;
  console.info(`[/api/payment/success] bhunakshaPolygon from session: ${polygonFromSession != null ? "found" : "NULL"}`);

  // T-013: resolve auth.uid() from session cookie, fall back to checkout-session auth_uid.
  // Both are nullable — anonymous purchases still work, they just produce a row with user_id=NULL.
  const authUser = await getAuthUser();
  const resolvedUserId = authUser?.id ?? checkoutSession?.auth_uid ?? null;

  // ── Fast path: report was pre-generated during checkout ────────────────────
  if (resolvedPreGeneratedReportId || resolvedPreGeneratedHtml) {
    // Priority 0: pregen ran but failed — return its error, don't re-run pipeline.
    // Avoids the 60-90s slow path when the upstream portal is the actual bottleneck.
    if (resolvedPreGeneratedReportId) {
      try {
        const preResult = await getReport(resolvedPreGeneratedReportId);
        const preReport = preResult?.report;
        if (preReport && !isUsableBhulekhReport(preReport as Record<string, unknown>)) {
          const errorMessage = (preReport as { errorMessage?: string | null }).errorMessage
            ?? "Bhulekh RoR fetch did not return usable data. Please retry in a few minutes.";
          console.warn(`[/api/payment/success] Reusing failed pregen ${resolvedPreGeneratedReportId}: ${errorMessage}`);
          await trackEvent({
            eventName: "payment_success",
            reportId: resolvedPreGeneratedReportId,
            metadata: { orderId: razorpay_order_id, reusedFailedPregen: true },
          });
          return NextResponse.json(
            {
              error: `Payment succeeded, but ${errorMessage}`,
              reportId: resolvedPreGeneratedReportId,
              reportUrl: buildReportUrl(resolvedPreGeneratedReportId, process.env.CLEARDEED_BASE_URL ?? req.nextUrl.origin),
              status: "failed",
            },
            { status: 502 }
          );
        }
      } catch (err) {
        console.warn(`[/api/payment/success] DB lookup for failed-pregen ${resolvedPreGeneratedReportId} failed:`, err);
      }
    }

    // Priority 1: Check DB for pre-generated report
    if (resolvedPreGeneratedReportId) {
      console.info(`[/api/payment/success] Looking for pre-generated report in DB: ${resolvedPreGeneratedReportId}`);
      try {
        const result = await getReport(resolvedPreGeneratedReportId);
        const report = result?.report;
        const hasUsableHtml = report?.html && isUsableBhulekhReport(report as Record<string, unknown>);
        console.info(`[/api/payment/success] DB report:`, report ? {
          hasHtml: Boolean(report.html),
          htmlLength: (report.html as string)?.length ?? 0,
          isUsable: hasUsableHtml,
          title: report.title,
        } : "null");

        if (hasUsableHtml) {
          console.info(`[/api/payment/success] Using pre-generated report from DB ${resolvedPreGeneratedReportId}`);
          const preGeneratedHtml = addReportAccessTokensToHtml(report.html, resolvedPreGeneratedReportId);
          let emailSent = false;
          if (resolvedEmail) {
            const emailResult = await sendReportEmail({
              to: resolvedEmail,
              reportId: resolvedPreGeneratedReportId,
              reportTitle: report.title ?? "ClearDeed Report",
              reportHtml: preGeneratedHtml,
            });
            emailSent = emailResult.success;
          }
          // Funnel: client-side payment success, fast path
          await trackEvent({
            eventName: "payment_success",
            reportId: resolvedPreGeneratedReportId,
            metadata: { orderId: razorpay_order_id, fastPath: true },
          });
          // Funnel: report delivered to buyer (fast path: pre-generated, URL+email ready)
          await trackEvent({
            eventName: "report_delivered",
            reportId: resolvedPreGeneratedReportId,
            metadata: { emailSent, fastPath: true, orderId: razorpay_order_id },
          });
          return NextResponse.json({
            reportId: resolvedPreGeneratedReportId,
            reportUrl: buildReportUrl(resolvedPreGeneratedReportId, process.env.CLEARDEED_BASE_URL ?? req.nextUrl.origin),
            title: report.title ?? "ClearDeed Report",
            html: preGeneratedHtml,
            emailSent,
            status: report.errorMessage ? "generated_with_error" : "generated",
            bhunakshaPolygon: checkoutSession?.preGeneratedBhunakshaPolygon ?? null,
          });
        } else if (report?.html) {
          console.warn(`[/api/payment/success] DB report ${resolvedPreGeneratedReportId} has no usable Bhulekh data`);
        }
      } catch (err) {
        console.warn(`[/api/payment/success] DB lookup failed for ${resolvedPreGeneratedReportId}:`, err);
      }
    }

    // Priority 2: Use HTML stored directly in checkout session
    if (resolvedPreGeneratedHtml && isUsableBhulekhReport({ html: resolvedPreGeneratedHtml } as Record<string, unknown>)) {
      console.info(`[/api/payment/success] Using HTML from checkout session`);
      const html = addReportAccessTokensToHtml(resolvedPreGeneratedHtml, resolvedPreGeneratedReportId ?? "checkout");
      let emailSent = false;
      if (resolvedEmail) {
        const emailResult = await sendReportEmail({
          to: resolvedEmail,
          reportId: resolvedPreGeneratedReportId ?? "checkout",
          reportTitle: checkoutSession?.preGeneratedTitle ?? "ClearDeed Report",
          reportHtml: html,
        });
        emailSent = emailResult.success;
      }
      // Funnel: client-side payment success, html-in-session fast path
      if (resolvedPreGeneratedReportId) {
        await trackEvent({
          eventName: "payment_success",
          reportId: resolvedPreGeneratedReportId,
          metadata: { orderId: razorpay_order_id, htmlInSession: true },
        });
      }
      return NextResponse.json({
        reportId: resolvedPreGeneratedReportId ?? null,
        reportUrl: resolvedPreGeneratedReportId
          ? buildReportUrl(resolvedPreGeneratedReportId, process.env.CLEARDEED_BASE_URL ?? req.nextUrl.origin)
          : null,
        title: checkoutSession?.preGeneratedTitle ?? "ClearDeed Report",
        html,
        emailSent,
        status: checkoutSession?.preGeneratedError ? "generated_with_error" : "generated",
        bhunakshaPolygon: checkoutSession?.preGeneratedBhunakshaPolygon ?? null,
      });
    }
  }

  if (!resolvedTehsil || !resolvedVillage || !resolvedVillageCode || !resolvedSearchMode || !resolvedIdentifier) {
    return NextResponse.json(
      { error: "Payment succeeded, but report inputs were missing. Email us at support@cleardeed.in and we will recover it." },
      { status: 400 }
    );
  }

  // ── Slow path: generate report on-demand ───────────────────────────────────
  let reportId: string | undefined;
  let persistenceEnabled = false;
  try {
    const dbResult = await createReport({
      gpsLat: 0,
      gpsLon: 0,
      claimedOwnerName: resolvedClaimedOwnerName || resolvedIdentifier,
      userId: resolvedUserId,
    });
    reportId = dbResult.reportId;
    persistenceEnabled = true;
  } catch (dbError) {
    console.warn("[/api/payment/success] DB create failed:", dbError);
  }

  let pipelineOutput: Awaited<ReturnType<typeof generateReportV11>> | null = null;
  let reportError: string | null = null;

  try {
    pipelineOutput = await generateReportV11({
      reportId,
      tehsil: resolvedTehsil,
      tehsilValue: resolvedTehsilValue,
      village: resolvedVillage,
      villageCode: resolvedVillageCode,
      searchMode: resolvedSearchMode,
      identifier: resolvedIdentifier,
      claimedOwnerName: resolvedClaimedOwnerName,
    });
    reportId = pipelineOutput.reportId;
  } catch (pipelineError) {
    reportError = pipelineError instanceof Error ? pipelineError.message : String(pipelineError);
    console.error(`[/api/payment/success] Report generation failed for ${reportId}:`, reportError);
  }

  const reportHtml = pipelineOutput && reportId
    ? addReportAccessTokensToHtml(pipelineOutput.html, reportId)
    : "";

  if (persistenceEnabled && reportId) {
    try {
      await updateReportResults({
        reportId,
        reportHtml,
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

  if (reportError || !reportHtml.trim()) {
    return NextResponse.json(
      {
        error: reportError
          ? `Payment succeeded, but Bhulekh RoR could not be fetched: ${reportError}`
          : "Payment succeeded, but report generation did not produce HTML.",
        reportId,
        reportUrl: reportId ? buildReportUrl(reportId, process.env.CLEARDEED_BASE_URL ?? req.nextUrl.origin) : null,
        status: "failed",
      },
      { status: 502 }
    );
  }

  let emailSent = false;
  if (resolvedEmail && reportId && pipelineOutput) {
    const result = await sendReportEmail({
      to: resolvedEmail,
      reportId,
      reportTitle: pipelineOutput.title,
      reportHtml,
    });
    emailSent = result.success;
    if (!result.success) {
      console.warn(`[/api/payment/success] Email failed for ${reportId}: ${result.error}`);
    }
  }

  // Funnel: client-side payment success, slow path
  if (reportId) {
    await trackEvent({
      eventName: "payment_success",
      reportId,
      metadata: { orderId: razorpay_order_id, hasError: Boolean(reportError) },
    });
    // Funnel: report delivered to buyer (URL + email ready)
    await trackEvent({
      eventName: "report_delivered",
      reportId,
      metadata: { emailSent, hasHtml: Boolean(reportHtml), orderId: razorpay_order_id },
    });
  }

  return NextResponse.json({
    reportId,
    reportUrl: reportId ? buildReportUrl(reportId, process.env.CLEARDEED_BASE_URL ?? req.nextUrl.origin) : null,
    title: pipelineOutput?.title ?? "ClearDeed Report",
    html: reportHtml,
    emailSent,
    status: reportError ? "generated_with_error" : "generated",
  });
}
