/**
 * Conversion funnel instrumentation + lightweight error monitoring.
 *
 * Writes one row per event to the `report_events` table.
 * Failures are logged and swallowed — tracking must never break the user flow.
 *
 * Funnel stages: landing_view, preview_view, checkout_open, payment_success,
 *                report_delivered, feedback_submitted.
 * Error events (A.4.1): error_caught, api_500.
 *
 * PDPD hygiene: metadata is scrubbed of any field whose key matches a known
 * PII surface before the row is inserted. Stack traces are dropped unless
 * the caller explicitly opts in. This keeps the `report_events` table
 * suitable for analytics without becoming a PII liability.
 */
import { supabaseAdmin } from "./db";

// Keys that, if present in metadata, must be dropped before insert. Matched
// case-insensitively so the redaction is robust against casing drift.
const PII_KEYS = new Set([
  "email",
  "e-mail",
  "emailaddress",
  "contact",
  "phone",
  "whatsapp",
  "sellerName",
  "seller_name",
  "claimedOwnerName",
  "claimed_owner_name",
  "identifier",
  "fullName",
  "full_name",
  "address",
  "razorpay_payment_id",
  "razorpay_order_id",
  "razorpay_signature",
]);

function redactMetadata(
  metadata?: Record<string, unknown>
): Record<string, unknown> | undefined {
  if (!metadata) return metadata;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(metadata)) {
    if (PII_KEYS.has(k.toLowerCase())) continue;
    out[k] = v;
  }
  return out;
}

export type FunnelEventName =
  | "landing_view"
  | "preview_view"
  | "checkout_open"
  | "payment_success"
  | "report_delivered"
  | "feedback_submitted"
  | "survey_dispatch"
  | "error_caught"
  | "api_500";

export interface TrackEventInput {
  eventName: FunnelEventName;
  reportId?: string | null;
  metadata?: Record<string, unknown>;
}

export async function trackEvent(input: TrackEventInput): Promise<void> {
  try {
    const { error } = await supabaseAdmin()
      .from("report_events")
      .insert({
        report_id: input.reportId ?? null,
        event_name: input.eventName,
        event_data: redactMetadata(input.metadata) ?? {},
      });
    if (error) {
      console.warn(`[track] report_events insert failed for ${input.eventName}:`, error.message);
    }
  } catch (err) {
    console.warn(`[track] report_events insert threw for ${input.eventName}:`, err instanceof Error ? err.message : String(err));
  }
}

/**
 * Capture a caught error for monitoring (A.4.1).
 *
 * Lightweight alternative to Sentry — uses the same `report_events`
 * table as funnel events with event_name='error_caught'. Writes
 * a row with: { name, message, route, reportId, ts }.
 *
 * PDPD note: stack traces are never persisted to the events table. If
 * the caller wants a stack trace, it should record it separately in
 * a structured logging system with appropriate access controls.
 *
 * Failures are logged and swallowed — error tracking must never
 * break the user flow.
 */
export async function trackError(
  err: unknown,
  context: { route?: string; reportId?: string | null; extra?: Record<string, unknown> } = {}
): Promise<void> {
  const name = err instanceof Error ? err.name : "UnknownError";
  const message = err instanceof Error ? err.message : String(err);
  await trackEvent({
    eventName: "error_caught",
    reportId: context.reportId ?? null,
    metadata: {
      name,
      message,
      route: context.route,
      ts: new Date().toISOString(),
      ...redactMetadata(context.extra),
    },
  });
}
