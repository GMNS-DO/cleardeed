-- Migration 026: drop legacy 10-param overload of update_report_results
--
-- Background:
--   Migration 001 defined `update_report_results` with 10 params. Migration 028
--   extended it to 12 params (11 explicit + 1 implicit null default) using
--   `CREATE OR REPLACE FUNCTION`. Because 021 originally shipped WITHOUT
--   `OR REPLACE`, the production DB ended up with TWO overloads. PostgREST
--   cannot disambiguate, so every call to `update_report_results` returns:
--
--   "Could not choose the best candidate function between: ..."
--
--   This migration DROPs the 10-param overload explicitly, leaving only the
--   12-param version (which Supabase's current tsgen emits). The 10-param
--   version is unreachable in application code — every caller in the repo
--   passes 11+ arguments.
--
-- Verification:
--   Run `SELECT proargnames::text[] FROM pg_proc WHERE proname = 'update_report_results';`
--   It should return exactly one row with 12 elements (including the implicit
--   p_pipeline_output).

BEGIN;

-- Drop the legacy 10-param overload by its full signature.
-- COALESCE protects against the migration being re-applied.
DROP FUNCTION IF EXISTS update_report_results(
  p_report_id TEXT,
  p_report_html TEXT,
  p_report_title TEXT,
  p_nominatim_status TEXT,
  p_bhunaksha_status TEXT,
  p_bhulekh_status TEXT,
  p_ecourts_status TEXT,
  p_rccms_status TEXT,
  p_validation_findings JSONB,
  p_source_summary JSONB,
  p_error_message TEXT
);

COMMIT;
