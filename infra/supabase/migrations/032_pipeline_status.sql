-- 025 pipeline_status columns
-- Adds a machine-readable pipeline completion flag to the reports table.
-- Used by the consumer-facing /report/[id] page to render the
-- PipelineFailedBanner when the source fetch failed after payment.

-- Only add columns if they do not already exist (idempotent against
-- repeated deploys across branches).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'reports'
      AND column_name = 'pipeline_status'
  ) THEN
    ALTER TABLE public.reports
      ADD COLUMN pipeline_status text NOT NULL DEFAULT 'queued'
      CHECK (pipeline_status IN ('queued','running','success','failed','generated_with_error'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'reports'
      AND column_name = 'pipeline_error'
  ) THEN
    ALTER TABLE public.reports
      ADD COLUMN pipeline_error text NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'reports'
      AND column_name = 'pipeline_completed_at'
  ) THEN
    ALTER TABLE public.reports
      ADD COLUMN pipeline_completed_at timestamptz NULL;
  END IF;
END
$$;

COMMENT ON COLUMN public.reports.pipeline_status IS
  'Machine-readable outcome of the report pipeline. failed/generated_with_error renders PipelineFailedBanner.';
COMMENT ON COLUMN public.reports.pipeline_error IS
  'Reason string (non-null only when pipeline_status is failed or generated_with_error).';
