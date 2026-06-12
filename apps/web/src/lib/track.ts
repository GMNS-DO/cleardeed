/**
 * Conversion funnel instrumentation.
 *
 * Writes one row per funnel event to the `report_events` table.
 * Failures are logged and swallowed — tracking must never break the user flow.
 *
 * Stages: landing_view, preview_view, checkout_open, payment_success, report_delivered, feedback_submitted.
 */
import { supabaseAdmin } from "./db";

export type FunnelEventName =
  | "landing_view"
  | "preview_view"
  | "checkout_open"
  | "payment_success"
  | "report_delivered"
  | "feedback_submitted";

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
