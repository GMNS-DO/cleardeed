/**
 * POST /api/track
 *
 * Client-side funnel event ingest. Browser-side events (landing_view, report_delivered)
 * hit this endpoint; server-side events fire trackEvent() directly.
 *
 * Input: { eventName, reportId?, metadata? }
 * Output: { ok: true }
 */
import { NextRequest, NextResponse } from "next/server";
import { trackEvent, type FunnelEventName } from "@/lib/track";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_EVENTS: FunnelEventName[] = [
  "landing_view",
  "preview_view",
  "checkout_open",
  "payment_success",
  "report_delivered",
  "feedback_submitted",
];

export async function POST(req: NextRequest) {
  let body: { eventName?: string; reportId?: string; metadata?: Record<string, unknown> };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.eventName || !ALLOWED_EVENTS.includes(body.eventName as FunnelEventName)) {
    return NextResponse.json({ error: "Invalid or missing eventName" }, { status: 400 });
  }

  await trackEvent({
    eventName: body.eventName as FunnelEventName,
    reportId: body.reportId,
    metadata: body.metadata,
  });

  return NextResponse.json({ ok: true });
}
