-- 024 survey_sends
-- Tracks 30/90/180/365-day post-report follow-up survey dispatches.
-- Used by /api/internal/survey/dispatch cron job.

CREATE TABLE IF NOT EXISTS survey_sends (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id   uuid NOT NULL REFERENCES reports(id),
  day         smallint NOT NULL CHECK (day IN (30, 90, 180, 365)),
  sent_at     timestamptz NOT NULL DEFAULT now(),
  delivery_status text NOT NULL DEFAULT 'queued',
  -- queued | sent | bounced | unsubscribed | completed
  payload     jsonb NOT NULL DEFAULT '{}',
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS survey_sends_report_day_uniq
  ON survey_sends (report_id, day);

-- Dispatchers batch-select by day window; ordering allows pagination if
-- the queue grows (more useful once multiple districts + cohorts are active).
CREATE INDEX IF NOT EXISTS idx_survey_sends_report
  ON survey_sends (report_id, day);

COMMENT ON TABLE survey_sends IS 'Post-report buyer-followup survey dispatches (30/90/180/365d).';
COMMENT ON COLUMN survey_sends.day IS 'Survey window in days from report creation.';
COMMENT ON COLUMN survey_sends.delivery_status IS 'Current delivery state for the mailing queue.';
