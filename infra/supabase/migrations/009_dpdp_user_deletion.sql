-- ClearDeed — DPDP Act 2023: User Data Deletion
-- Migration: 009_dpdp_user_deletion.sql
-- Created: 2026-06-16
--
-- Per DPDP Act Section 12 (right to erasure) and the privacy policy
-- (apps/web/src/app/privacy/page.tsx), users may request deletion of
-- their personal data. We soft-delete first to allow recovery in case
-- of accidental request, then hard-delete after 30 days.
--
-- Soft-delete columns:
--   deleted_at TIMESTAMPTZ     -- set when user requests deletion
--   deletion_reason TEXT       -- optional, for audit
--
-- After 30 days, a cleanup job (or manual run) hard-deletes records
-- with deleted_at < NOW() - INTERVAL '30 days'.

-- ── Reports: soft-delete column ────────────────────────────────────────────────
ALTER TABLE reports
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS deletion_reason TEXT DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_reports_deleted_at
  ON reports (deleted_at)
  WHERE deleted_at IS NOT NULL;

-- ── report_feedback: soft-delete + anonymize text ─────────────────────────────
ALTER TABLE report_feedback
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_report_feedback_deleted_at
  ON report_feedback (deleted_at)
  WHERE deleted_at IS NOT NULL;

-- ── lead_requests: soft-delete ────────────────────────────────────────────────
ALTER TABLE lead_requests
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS deletion_reason TEXT DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_lead_requests_deleted_at
  ON lead_requests (deleted_at)
  WHERE deleted_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_lead_requests_phone
  ON lead_requests (phone)
  WHERE deleted_at IS NULL;

-- ── Hard-delete function: 30-day retention ─────────────────────────────────────
-- Run this manually or schedule via Supabase cron:
--   SELECT hard_delete_expired_user_data();
--
-- Returns counts of records that were hard-deleted. Logs the count
-- to console so cron runs leave an audit trail in pg logs.
CREATE OR REPLACE FUNCTION hard_delete_expired_user_data()
RETURNS TABLE (table_name TEXT, deleted_count BIGINT) AS $$
DECLARE
  v_reports_count BIGINT;
  v_feedback_count BIGINT;
  v_leads_count BIGINT;
BEGIN
  -- Reports: hard-delete where deleted_at is more than 30 days old
  DELETE FROM reports
  WHERE deleted_at IS NOT NULL
    AND deleted_at < NOW() - INTERVAL '30 days';
  GET DIAGNOSTICS v_reports_count = ROW_COUNT;

  -- report_feedback: hard-delete where deleted_at is more than 30 days old
  DELETE FROM report_feedback
  WHERE deleted_at IS NOT NULL
    AND deleted_at < NOW() - INTERVAL '30 days';
  GET DIAGNOSTICS v_feedback_count = ROW_COUNT;

  -- lead_requests: hard-delete where deleted_at is more than 30 days old
  DELETE FROM lead_requests
  WHERE deleted_at IS NOT NULL
    AND deleted_at < NOW() - INTERVAL '30 days';
  GET DIAGNOSTICS v_leads_count = ROW_COUNT;

  RETURN QUERY
    SELECT 'reports', v_reports_count
    UNION ALL
    SELECT 'report_feedback', v_feedback_count
    UNION ALL
    SELECT 'lead_requests', v_leads_count;

  RAISE NOTICE '[DPDP cleanup] hard-deleted: reports=%, feedback=%, leads=%',
    v_reports_count, v_feedback_count, v_leads_count;
END;
$$ LANGUAGE plpgsql;

-- ── Comment on retention policy ───────────────────────────────────────────────
COMMENT ON COLUMN reports.deleted_at IS
  'DPDP Act: timestamp of user deletion request. Hard-deleted 30 days later via hard_delete_expired_user_data().';
COMMENT ON COLUMN report_feedback.deleted_at IS
  'DPDP Act: timestamp of user deletion request. On set, the comment field is anonymized to NULL.';
COMMENT ON COLUMN lead_requests.deleted_at IS
  'DPDP Act: timestamp of user deletion request. Hard-deleted 30 days later via hard_delete_expired_user_data().';
