-- Deduplication for payment_success funnel events (A.5.2)
--
-- Ensures that webhook and client both firing payment_success for the same
-- reportId don't double-count. The unique constraint silently blocks
-- the second insert, guaranteeing the funnel query will count 1 event
-- per (reportId, eventName) pair.

CREATE UNIQUE INDEX idx_report_events_unique_per_report
  ON report_events (event_name, report_id)
  WHERE event_name IN ('payment_success');