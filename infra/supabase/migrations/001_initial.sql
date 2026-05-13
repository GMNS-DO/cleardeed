-- ClearDeed — Initial Schema
-- Migration: 001_initial.sql
-- Created: 2026-04-29

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ── Reports table ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS reports (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  user_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- GPS coordinates (from user)
  gps_lat DECIMAL(9, 6) NOT NULL,
  gps_lon DECIMAL(9, 6) NOT NULL,

  -- User-provided inputs
  claimed_owner_name TEXT NOT NULL,
  father_husband_name TEXT,
  plot_description TEXT,

  -- Generated output
  report_html TEXT,
  report_title TEXT,
  report_status TEXT NOT NULL DEFAULT 'pending', -- 'pending' | 'generating' | 'complete' | 'failed'

  -- Orchestrator results summary
  nominatim_status TEXT,
  bhunaksha_status TEXT,
  bhulekh_status TEXT,
  ecourts_status TEXT,
  rccms_status TEXT,

  -- Validation findings (JSON array)
  validation_findings JSONB DEFAULT '[]'::JSONB,

  -- Error message if failed
  error_message TEXT,

  -- Source summary (JSON object)
  source_summary JSONB DEFAULT '{}'::JSONB
);

-- ── Source results table ─────────────────────────────────────────────────────
-- Stores raw + parsed results from each fetcher per report
CREATE TABLE IF NOT EXISTS source_results (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  report_id TEXT NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
  source_name TEXT NOT NULL, -- 'nominatim' | 'bhunaksha' | 'bhulekh' | 'ecourts' | 'rccms'
  status TEXT NOT NULL, -- 'success' | 'partial' | 'failed' | 'error'
  fetched_at TIMESTAMPTZ,

  -- Parsed data (JSON)
  parsed_data JSONB,

  -- Raw response (for debugging/replay)
  raw_response TEXT,

  -- Error details
  error_message TEXT,

  -- Timing
  duration_ms INTEGER,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (report_id, source_name)
);

-- ── Audit log ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS audit_log (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  report_id TEXT REFERENCES reports(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL, -- 'report_created' | 'report_viewed' | 'report_exported' | 'source_fetched' | 'error'
  event_data JSONB DEFAULT '{}'::JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Indexes ──────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_reports_user_id ON reports(user_id);
CREATE INDEX IF NOT EXISTS idx_reports_created_at ON reports(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(report_status);
CREATE INDEX IF NOT EXISTS idx_source_results_report_id ON source_results(report_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_report_id ON audit_log(report_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log(created_at DESC);

-- ── Updated_at trigger ────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_reports_updated_at ON reports;
CREATE TRIGGER update_reports_updated_at
  BEFORE UPDATE ON reports
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ── RPC: Create report ─────────────────────────────────────────────────────────
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

  INSERT INTO reports (id, user_id, gps_lat, gps_lon, claimed_owner_name, father_husband_name, plot_description, report_status)
  VALUES (v_report_id, p_user_id, p_gps_lat, p_gps_lon, p_claimed_owner_name, p_father_husband_name, p_plot_description, 'pending')
  RETURNING * INTO v_report;

  INSERT INTO audit_log (report_id, event_type, event_data)
  VALUES (v_report_id, 'report_created', jsonb_build_object(
    'claimed_owner_name', p_claimed_owner_name,
    'gps', jsonb_build_object('lat', p_gps_lat, 'lon', p_gps_lon)
  ));

  RETURN jsonb_build_object(
    'reportId', v_report.id,
    'status', v_report.report_status,
    'createdAt', v_report.created_at
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── RPC: Update report with results ──────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_report_results(
  p_report_id TEXT,
  p_report_html TEXT,
  p_report_title TEXT,
  p_nominatim_status TEXT DEFAULT NULL,
  p_bhunaksha_status TEXT DEFAULT NULL,
  p_bhulekh_status TEXT DEFAULT NULL,
  p_ecourts_status TEXT DEFAULT NULL,
  p_rccms_status TEXT DEFAULT NULL,
  p_validation_findings JSONB DEFAULT '[]'::JSONB,
  p_source_summary JSONB DEFAULT '{}'::JSONB,
  p_error_message TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_new_status TEXT;
BEGIN
  -- Determine overall status
  IF p_error_message IS NOT NULL THEN
    v_new_status := 'failed';
  ELSE
    v_new_status := 'complete';
  END IF;

  UPDATE reports
  SET
    report_html = p_report_html,
    report_title = p_report_title,
    report_status = v_new_status,
    nominatim_status = p_nominatim_status,
    bhunaksha_status = p_bhunaksha_status,
    bhulekh_status = p_bhulekh_status,
    ecourts_status = p_ecourts_status,
    rccms_status = p_rccms_status,
    validation_findings = p_validation_findings,
    source_summary = p_source_summary,
    error_message = p_error_message
  WHERE id = p_report_id;

  INSERT INTO audit_log (report_id, event_type, event_data)
  VALUES (p_report_id, 'report_completed', jsonb_build_object('status', v_new_status));

  RETURN jsonb_build_object(
    'reportId', p_report_id,
    'status', v_new_status,
    'updatedAt', NOW()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── RPC: Upsert source result ─────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION upsert_source_result(
  p_report_id TEXT,
  p_source_name TEXT,
  p_status TEXT,
  p_fetched_at TIMESTAMPTZ,
  p_parsed_data JSONB DEFAULT NULL,
  p_raw_response TEXT DEFAULT NULL,
  p_error_message TEXT DEFAULT NULL,
  p_duration_ms INTEGER DEFAULT NULL
)
RETURNS JSONB AS $$
BEGIN
  INSERT INTO source_results (report_id, source_name, status, fetched_at, parsed_data, raw_response, error_message, duration_ms)
  VALUES (p_report_id, p_source_name, p_status, p_fetched_at, p_parsed_data, p_raw_response, p_error_message, p_duration_ms)
  ON CONFLICT (report_id, source_name) DO UPDATE SET
    status = EXCLUDED.status,
    fetched_at = EXCLUDED.fetched_at,
    parsed_data = EXCLUDED.parsed_data,
    raw_response = EXCLUDED.raw_response,
    error_message = EXCLUDED.error_message,
    duration_ms = EXCLUDED.duration_ms;

  INSERT INTO audit_log (report_id, event_type, event_data)
  VALUES (p_report_id, 'source_fetched', jsonb_build_object('source', p_source_name, 'status', p_status, 'durationMs', p_duration_ms));

  RETURN jsonb_build_object(
    'reportId', p_report_id,
    'source', p_source_name,
    'status', p_status
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── RPC: Get report ────────────────────────────────────────────────────────────
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
      'updatedAt', v_report.updated_at
    ),
    'sources', COALESCE(v_sources, '[]'::JSONB)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── Row Level Security ────────────────────────────────────────────────────────
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE source_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- For V1 (no auth): allow all read/write (public reports)
-- TODO: After Supabase Auth is wired, add user_id checks
DROP POLICY IF EXISTS "Allow all for reports" ON reports;
CREATE POLICY "Allow all for reports" ON reports FOR ALL USING (true);
DROP POLICY IF EXISTS "Allow all for source_results" ON source_results;
CREATE POLICY "Allow all for source_results" ON source_results FOR ALL USING (true);
DROP POLICY IF EXISTS "Allow all for audit_log" ON audit_log;
CREATE POLICY "Allow all for audit_log" ON audit_log FOR ALL USING (true);

COMMENT ON TABLE reports IS 'Stores generated ClearDeed property due-diligence reports';
COMMENT ON TABLE source_results IS 'Raw + parsed results from each source fetcher (Bhulekh, Bhunaksha, eCourts, etc.)';
COMMENT ON TABLE audit_log IS 'Audit trail for all report operations';
