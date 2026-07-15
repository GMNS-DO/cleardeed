-- ClearDeed — Extend get_report() with lawyer co-sign fields
-- Migration: 030_get_report_lawyer_fields
-- Created: 2026-07-14
-- PI-3 T3 (lawyer co-sign).
--
-- Migration 029 adds lawyer_id, lawyer_signature_url, signed_at, and
-- guarantee_accepted_at to the reports table. Migration 020 defines get_report()
-- but does not surface those columns in its JSONB payload.
--
-- This migration replaces get_report() with an extended version that includes
-- the lawyer fields so ReportShell can decide whether to inject the co-sign
-- block into the rendered HTML.

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
      'lawyerId', v_report.lawyer_id,
      'lawyerSignatureUrl', v_report.lawyer_signature_url,
      'signedAt', v_report.signed_at,
      'guaranteeAcceptedAt', v_report.guarantee_accepted_at,
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
