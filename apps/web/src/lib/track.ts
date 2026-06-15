/**
 * Conversion funnel instrumentation + lightweight error monitoring.
 *
 * Writes one row per event to the `report_events` table.
 * Failures are logged and swallowed — tracking must never break the user flow.
 *
 * Funnel stages: landing_view, preview_view, checkout_open, payment_success,
 *                report_delivered, feedback_submitted.
 * Error events (A.4.1): error_caught, api_500.
 */
import { supabaseAdmin } from "./db";

export type FunnelEventName =
  | "landing_view"
  | "preview_view"
  | "checkout_open"
  | "payment_success"
  | "report_delivered"
  | "feedback_submitted"
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
        event_data: input.metadata ?? {},
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
 * a row with: { name, message, stack, route, reportId, ts }.
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
  const stack = err instanceof Error ? err.stack : undefined;
  await trackEvent({
    eventName: "error_caught",
    reportId: context.reportId ?? null,
    metadata: {
      name,
      message,
      stack: stack ? stack.split("\n").slice(0, 10).join("\n") : undefined,
      route: context.route,
      ts: new Date().toISOString(),
      ...context.extra,
    },
  });
}
