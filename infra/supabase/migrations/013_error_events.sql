-- Migration: Add error tracking to report_events table
-- Purpose: Lightweight error monitoring without a 3rd-party SDK.
-- Adds two new event_name values: "error_caught" (any captured
-- exception in an API route or pipeline orchestrator) and
-- "api_500" (Next.js API route returned 500).
-- Same table as funnel events so the founder can query both in
-- one place; event_name is the discriminator.

-- Update the comment on the event_name column to reflect broader scope
COMMENT ON COLUMN report_events.event_name IS
  'landing_view | preview_view | checkout_open | payment_success | report_delivered | feedback_submitted | error_caught | api_500';

-- Add an index for error events: query all errors in the last N hours
CREATE INDEX IF NOT EXISTS idx_report_events_errors
  ON report_events(created_at DESC)
  WHERE event_name IN ('error_caught', 'api_500');

COMMENT ON INDEX idx_report_events_errors IS
  'Optimizes: "show me all errors in the last hour" (A.4.1 error monitoring).';
