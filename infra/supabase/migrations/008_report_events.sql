-- Migration: Add report_events table
-- Purpose: Funnel instrumentation — track buyer journey landing → preview → pay → delivered → feedback
-- Pattern mirrors report_feedback (id, report_id, event_name, event_data, created_at)

CREATE TABLE IF NOT EXISTS report_events (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  report_id TEXT,                                       -- NULL for landing_view / preview_view / checkout_open
  event_name TEXT NOT NULL,                             -- landing_view | preview_view | checkout_open | payment_success | report_delivered | feedback_submitted
  event_data JSONB DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for funnel queries: count events by name over a time window
CREATE INDEX IF NOT EXISTS idx_report_events_name_created ON report_events(event_name, created_at DESC);

-- Index for per-report timeline
CREATE INDEX IF NOT EXISTS idx_report_events_report_id ON report_events(report_id);

COMMENT ON TABLE report_events IS 'Conversion funnel events. Written by /api/track (client) and direct calls from server routes.';

-- Security: only service role can read or write
ALTER TABLE report_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role only" ON report_events FOR ALL USING (auth.role() = 'service_role');
