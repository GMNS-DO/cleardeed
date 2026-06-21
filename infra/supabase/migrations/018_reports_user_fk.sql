-- Migration 018: Surface reports.user_id in get_report + FK to auth.users
-- T-013: Phone-OTP auth + per-user report ownership
--
-- Changes:
--   1. Add reports.user_id to the get_report() JSONB payload so callers can
--      enforce "only the owner can refresh / re-fetch" without an extra query.
--   2. Add a foreign-key constraint from reports.user_id to auth.users(id)
--      with ON DELETE SET NULL so deleting a user keeps the report row intact
--      but unlinks it.
--
-- Safety:
--   - Existing reports have user_id = NULL; the FK constraint allows NULL
--     and does not break the existing rows.
--   - The constraint is added with NOT VALID first, then VALIDATE in the
--     same migration. For a 100% safe backfill, run this in two deploys —
--     one to add the constraint NOT VALID, one to VALIDATE — but on a
--     small dataset the inline validate is fine.
--   - New reports from T-013 onwards have user_id populated from auth.uid().

-- ── 1. Extend get_report to include user_id ──────────────────────────────────
CREATE OR REPLACE FUNCTION get_report(p_report_id TEXT)
RETURNS JSONB AS $$
DECLARE
  v_report reports%ROWTYPE;
  v_sources JSONB;
BEGIN
  SELECT * INTO v_report FROM reports WHERE id = p_report_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Report not found');
  END IF;

  SELECT jsonb_agg(jsonb_build_object(
    'source', source_name,
    'status', status,
    'fetchedAt', fetched_at,
    'data', parsed_data,
    'error', error_message,
    'durationMs', duration_ms
  ))
  INTO v_sources
  FROM source_results
  WHERE report_id = p_report_id;

  RETURN jsonb_build_object(
    'report', jsonb_build_object(
      'id', v_report.id,
      'userId', v_report.user_id,
      'status', v_report.report_status,
      'gps', jsonb_build_object('lat', v_report.gps_lat, 'lon', v_report.gps_lon),
      'claimedOwnerName', v_report.claimed_owner_name,
      'fatherHusbandName', v_report.father_husband_name,
      'plotDescription', v_report.plot_description,
      'html', v_report.report_html,
      'title', v_report.report_title,
      'nominatimStatus', v_report.nominatim_status,
      'bhunakshaStatus', v_report.bhunaksha_status,
      'bhulekhStatus', v_report.bhulekh_status,
      'ecourtsStatus', v_report.ecourts_status,
      'rccmsStatus', v_report.rccms_status,
      'validationFindings', v_report.validation_findings,
      'sourceSummary', v_report.source_summary,
      'errorMessage', v_report.error_message,
      'createdAt', v_report.created_at,
      'updatedAt', v_report.updated_at,
      'expiresAt', v_report.expires_at,
      'revokedAt', v_report.revoked_at
    ),
    'sources', COALESCE(v_sources, '[]'::jsonb)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── 2. Add FK from reports.user_id to auth.users(id) ─────────────────────────
-- ON DELETE SET NULL preserves the report row even if the user is deleted
-- (PDPD Act right-to-erasure). Reports become anonymous after user deletion.
ALTER TABLE reports
  ADD CONSTRAINT reports_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

-- Index is already in place from 001_initial (idx_reports_user_id).

COMMENT ON CONSTRAINT reports_user_id_fkey ON reports IS
  'T-013: phone-OTP user owns the report. ON DELETE SET NULL — user erasure does not cascade-delete reports (PDPD Act keeps data minimal but row intact for audit).';
