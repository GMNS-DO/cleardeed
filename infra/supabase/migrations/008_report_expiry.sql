-- ClearDeed — Migration 008: Report expiry + revocation
-- Purpose: Sprint 5 — 60-day paid report validity with pay-to-refresh (₹299).
-- Adds expires_at + revoked_at columns to reports and updates the create / get
-- RPCs so the new columns are written and read.
--
-- Scope is minimal. No new tables, no RLS changes (the reports table already
-- allows full access for the launch).

-- ── New columns ────────────────────────────────────────────────────────────────
ALTER TABLE reports
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMPTZ;

-- Index for expiry sweeps / cron (cheap, single-purpose).
CREATE INDEX IF NOT EXISTS idx_reports_expires_at ON reports(expires_at);

COMMENT ON COLUMN reports.expires_at IS 'When this paid report auto-expires. NULL = never (legacy reports) or revoked.';
COMMENT ON COLUMN reports.revoked_at IS 'If set, the report is administratively revoked and must not be served.';

-- ── create_report: default new reports to +60 days from creation ───────────────
CREATE OR REPLACE FUNCTION create_report(
  p_gps_lat DECIMAL,
  p_gps_lon DECIMAL,
  p_claimed_owner_name TEXT,
  p_father_husband_name TEXT DEFAULT NULL,
  p_plot_description TEXT DEFAULT NULL,
  p_user_id TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_report_id TEXT;
  v_report record;
BEGIN
  v_report_id := gen_random_uuid()::TEXT;

  INSERT INTO reports (
    id, user_id, gps_lat, gps_lon,
    claimed_owner_name, father_husband_name, plot_description,
    report_status, expires_at
  )
  VALUES (
    v_report_id, p_user_id, p_gps_lat, p_gps_lon,
    p_claimed_owner_name, p_father_husband_name, p_plot_description,
    'pending', NOW() + INTERVAL '60 days'
  )
  RETURNING * INTO v_report;

  INSERT INTO audit_log (report_id, event_type, event_data)
  VALUES (v_report_id, 'report_created', jsonb_build_object(
    'claimed_owner_name', p_claimed_owner_name,
    'gps', jsonb_build_object('lat', p_gps_lat, 'lon', p_gps_lon),
    'expires_at', v_report.expires_at
  ));

  RETURN jsonb_build_object(
    'reportId', v_report.id,
    'status', v_report.report_status,
    'createdAt', v_report.created_at,
    'expiresAt', v_report.expires_at
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── get_report: surface expires_at + revoked_at to callers ────────────────────
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
    'sources', COALESCE(v_sources, '[]'::JSONB)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
