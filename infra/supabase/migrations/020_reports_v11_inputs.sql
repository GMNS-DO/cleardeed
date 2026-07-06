-- ClearDeed — Persist V1.1 dropdown inputs on reports
-- Migration: 020_reports_v11_inputs
-- Created: 2026-06-25
-- T-009 follow-up (CLAUDE.md T-009 notes).
--
-- V1.1 (dropdown mode) reports are created with a Tehsil + Village + search-mode
-- + identifier. These were NOT persisted on the reports table — only the
-- resolved Bhulekh payload was. As a result, the lawyer dashboard re-run
-- button could not replay V1.1 reports and returned V11_RERUN_UNSUPPORTED.
--
-- Adds six typed columns. Nullable so legacy (GPS-mode) reports are unaffected.
--
--   tehsil        — selected tehsil name (e.g. "Bhubaneswar")
--   tehsil_code   — Bhulekh tehsil code (e.g. "2" for Bhubaneswar)
--   village       — selected village name
--   village_code  — Bhulekh village code from location graph
--   plot_no       — user-selected plot identifier (from ranked picker)
--   search_mode   — "Plot" | "Khatiyan" | "Tenant"

ALTER TABLE reports
  ADD COLUMN IF NOT EXISTS tehsil text,
  ADD COLUMN IF NOT EXISTS tehsil_code text,
  ADD COLUMN IF NOT EXISTS village text,
  ADD COLUMN IF NOT EXISTS village_code text,
  ADD COLUMN IF NOT EXISTS plot_no text,
  ADD COLUMN IF NOT EXISTS search_mode text;

COMMENT ON COLUMN reports.tehsil IS
  'V1.1 dropdown input: selected tehsil name (e.g. "Bhubaneswar"). Used by lawyer dashboard rerun.';
COMMENT ON COLUMN reports.tehsil_code IS
  'V1.1 dropdown input: Bhulekh tehsil code (e.g. "2" for Bhubaneswar). Used by rerun route to call Bhulekh.';
COMMENT ON COLUMN reports.village IS
  'V1.1 dropdown input: selected village name.';
COMMENT ON COLUMN reports.village_code IS
  'V1.1 dropdown input: Bhulekh village code from location graph.';
COMMENT ON COLUMN reports.plot_no IS
  'V1.1 dropdown input: user-selected identifier (plot number, khatiyan, or tenant) from ranked picker.';
COMMENT ON COLUMN reports.search_mode IS
  'V1.1 dropdown input: search mode — "Plot" | "Khatiyan" | "Tenant".';

-- RPC: set_v11_inputs(reportId, tehsil, tehsilCode, village, villageCode, plotNo, searchMode, tier)
-- Lets the create route persist the V1.1 dropdown inputs after the report row
-- is created by create_report() (which does not know about dropdown inputs).
-- The rerun route reads these columns via get_report() to call Bhulekh again.
-- tier: paid tier captured at checkout time (standard | verified | guaranteed | NULL)
CREATE OR REPLACE FUNCTION set_v11_inputs(
  p_report_id TEXT,
  p_tehsil TEXT DEFAULT NULL,
  p_tehsil_code TEXT DEFAULT NULL,
  p_village TEXT DEFAULT NULL,
  p_village_code TEXT DEFAULT NULL,
  p_plot_no TEXT DEFAULT NULL,
  p_search_mode TEXT DEFAULT NULL,
  p_tier TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
BEGIN
  UPDATE reports
  SET
    tehsil = COALESCE(p_tehsil, tehsil),
    tehsil_code = COALESCE(p_tehsil_code, tehsil_code),
    village = COALESCE(p_village, village),
    village_code = COALESCE(p_village_code, village_code),
    plot_no = COALESCE(p_plot_no, plot_no),
    search_mode = COALESCE(p_search_mode, search_mode),
    paid_tier = COALESCE(p_tier, paid_tier)
  WHERE id = p_report_id;

  RETURN jsonb_build_object(
    'reportId', p_report_id,
    'updatedAt', NOW()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Extend get_report to surface the V1.1 inputs so the rerun route can call
-- Bhulekh again with the exact same tehsil/village/identifier the user picked.
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
      'htmlLawyer', v_report.report_html_lawyer,
      'title', v_report.report_title,
      'nominatimStatus', v_report.nominatim_status,
      'bhunakshaStatus', v_report.bhunaksha_status,
      'bhulekhStatus', v_report.bhulekh_status,
      'ecourtsStatus', v_report.ecourts_status,
      'rccmsStatus', v_report.rccms_status,
      'validationFindings', v_report.validation_findings,
      'sourceSummary', v_report.source_summary,
      'errorMessage', v_report.error_message,
      'expiresAt', v_report.expires_at,
      'revokedAt', v_report.revoked_at,
      'paidTier', v_report.paid_tier,
      'paidOrderId', v_report.paid_order_id,
      'pricePaidPaise', v_report.price_paid_paise,
      'paidAt', v_report.paid_at,
      'v11Inputs', jsonb_build_object(
        'tehsil', v_report.tehsil,
        'tehsilCode', v_report.tehsil_code,
        'village', v_report.village,
        'villageCode', v_report.village_code,
        'plotNo', v_report.plot_no,
        'searchMode', v_report.search_mode
      )
    ),
    'sources', COALESCE(v_sources, '[]'::jsonb)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
