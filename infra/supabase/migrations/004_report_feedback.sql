-- Migration: Add report feedback table
-- Run in Supabase SQL editor after deployment

CREATE TABLE IF NOT EXISTS report_feedback (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  report_id UUID NOT NULL,
  section TEXT NOT NULL,
  vote TEXT NOT NULL CHECK (vote IN ('up', 'down')),
  comment TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Index for fast lookups by report
CREATE INDEX IF NOT EXISTS idx_report_feedback_report_id ON report_feedback(report_id);

-- Index for section analytics
CREATE INDEX IF NOT EXISTS idx_report_feedback_section ON report_feedback(section);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_report_feedback_updated_at
  BEFORE UPDATE ON report_feedback
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Note: Run this after the main schema migration (001_initial.sql)
-- If the table already exists from a prior migration, this is idempotent.