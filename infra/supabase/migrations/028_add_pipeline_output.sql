-- ── Migration 028: Add pipeline_output JSONB column ────────────────────────────
-- Date: 2026-07-14
-- Purpose:
--   The V1.1 pipeline orchestrator emits a structured V11PipelineOutput
--   (insights, buyer questions, financial exposure, ownership verdict, plot
--   geometry, plot-diagram reference, source status map). Today that payload
--   is rendered into HTML and then discarded — the DB only stores the raw
--   source responses and one-line summaries in `source_summary`.
--
--   This migration adds a `pipeline_output` JSONB column on `reports` so the
--   React buyer-layer (and the lazy re-run path) can read the structured
--   substrate without re-running the pipeline. The HTML blob remains the
--   canonical rendered output for PDF export and backward compatibility.
--
--   GIN index on the JSONB column enables cheap lookups by rules (e.g. finding
--   all reports that fired ROR-INS-153 for the time-series trajectory rules in
--   T-059 and the buyer-outcome database in T-060).
--
-- Scope:
--   - Column + index added to `reports` table.
--   - `update_report_results` RPC extended to accept p_pipeline_output JSONB
--     with a DEFAULT '{}'::JSONB so existing callers that omit it continue
--     to work without code changes.
--   - This migration does NOT pass pipeline_output from any route yet.
--     Routes that need updating next:
--       * /api/report/create/route.ts — pass V11PipelineOutput object as
--         `pipelineOutput` to updateReportResults().
--       * /api/admin/dashboard/rerun/route.ts — same treatment for rerun
--         results.
--       * apps/web/src/lib/db.ts — UpdateReportParams.pipelineOutput field
--         added; the updateReportResults() call passes it as p_pipeline_output.
--
-- Why a separate column instead of overloading `source_summary`:
--   - `source_summary` is one-line-per-source summaries consumed by the audit
--     panel and per-source status columns. The pipeline output is an order of
--     magnitude larger and consumed by React components, not the audit panel.
--   - Separate column means each remains purpose-built and drop-in replaceable.
--
-- Mapper refactor (separate task, NOT this migration):
--   The mapper currently returns ConsumerReportGenInput which renders to HTML.
--   For the buyer-layer, the mapper (or a new mapToPipelineOutput() helper)
--   should produce the JSON shape defined in
--   docs/superpowers/audits/pipeline-schema-audit.md#section-4 alongside the
--   HTML. This migration enables storage; the shape mapping is a follow-up.

-- ── Column ─────────────────────────────────────────────────────────────────────
ALTER TABLE reports
  ADD COLUMN IF NOT EXISTS pipeline_output JSONB DEFAULT '{}'::JSONB;

COMMENT ON COLUMN reports.pipeline_output IS
  'Structured V11PipelineOutput from the report pipeline (insights, buyer questions, financial exposure, ownership verdict, plot geometry, plot-diagram reference). Populated by /api/report/create and /api/admin/dashboard/rerun via the update_report_results RPC. The HTML blob in report_html remains the canonical rendered output; this column is the structured substrate for the React buyer-layer.';

-- ── GIN index for JSONB containment lookups ────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_reports_pipeline_output
  ON reports USING GIN (pipeline_output);

-- ── Extend update_report_results RPC ───────────────────────────────────────────
-- New parameter has a DEFAULT so all existing callers (including those that
-- do not yet pass pipeline_output) continue to work.
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
  p_error_message TEXT DEFAULT NULL,
  p_pipeline_output JSONB DEFAULT '{}'::JSONB
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
    error_message = p_error_message,
    pipeline_output = p_pipeline_output
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
