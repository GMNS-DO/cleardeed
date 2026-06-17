-- P1 P4: Odia name feedback ingest.
--
-- User-reported corrections to Odia transliterations feed the
-- admin review queue. After threshold of unique users + zero
-- rejections, entries auto-merge into odia-names.json (P1 P1 dict).
--
-- This table is created in P1 P3 (alongside the Haiku tracker) so
-- that the migration files are in dependency order. The actual
-- API endpoint and admin UI ship in P1 P4.

CREATE TABLE odia_name_feedback (
  id              BIGSERIAL PRIMARY KEY,
  user_id         UUID NOT NULL,         -- auth.users.id
  report_id       UUID,                  -- context: which report triggered the correction
  odia_input      TEXT NOT NULL,         -- the original Odia text
  current_output  TEXT NOT NULL,         -- what our system produced
  suggested_output TEXT NOT NULL,        -- what the user thinks is correct
  status          TEXT NOT NULL DEFAULT 'pending',  -- pending | approved | rejected
  reviewed_by     UUID,                  -- admin user who acted on this
  reviewed_at     TIMESTAMPTZ,
  merged_version  INTEGER,               -- dict_version when this was merged into the dict
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_odia_name_feedback_status
  ON odia_name_feedback (status, created_at);
CREATE INDEX idx_odia_name_feedback_user
  ON odia_name_feedback (user_id, odia_input);

ALTER TABLE odia_name_feedback ENABLE ROW LEVEL SECURITY;
CREATE POLICY odia_name_feedback_user_insert
  ON odia_name_feedback FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY odia_name_feedback_user_select
  ON odia_name_feedback FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY odia_name_feedback_service_role
  ON odia_name_feedback FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
