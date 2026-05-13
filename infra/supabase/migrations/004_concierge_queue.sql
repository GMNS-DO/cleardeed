-- ClearDeed — Concierge Queue
-- Migration: 004_concierge_queue.sql
-- Created: 2026-05-13
-- V1.1: Adds concierge workflow status to reports table

-- Add concierge fields to reports
ALTER TABLE reports ADD COLUMN IF NOT EXISTS report_status TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE reports ADD COLUMN IF NOT EXISTS wh_ad_uno TEXT;
ALTER TABLE reports ADD COLUMN IF NOT EXISTS wh_ad_status TEXT DEFAULT 'pending';
ALTER TABLE reports ADD COLUMN IF NOT EXISTS wh_ad_sent_at TIMESTAMPTZ;
ALTER TABLE reports ADD COLUMN IF NOT EXISTS wh_ad_message TEXT;
ALTER TABLE reports ADD COLUMN IF NOT EXISTS reviewed_by TEXT;
ALTER TABLE reports ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;
ALTER TABLE reports ADD COLUMN IF NOT EXISTS review_notes TEXT;

-- Rename old column if it exists (avoid duplicate column error)
-- The initial schema had report_status already — this migration is idempotent

COMMENT ON COLUMN reports.report_status IS 'pending | generating | pending_review | complete | failed | delivered — pending_review means founder must approve before WhatsApp delivery';
COMMENT ON COLUMN reports.wh_ad_status IS 'pending | approved | delivered | skipped';
COMMENT ON COLUMN reports.wh_ad_sent_at IS 'When the WhatsApp delivery message was sent';

-- Add default for review fields (safe to re-run)
ALTER TABLE reports ALTER COLUMN wh_ad_status SET DEFAULT 'pending';
ALTER TABLE reports ALTER COLUMN report_status SET DEFAULT 'pending';

-- Index for concierge queue query (pending_review + pending_whatsapp)
CREATE INDEX IF NOT EXISTS idx_reports_concierge_queue
  ON reports(report_status, wh_ad_status, created_at DESC)
  WHERE report_status IN ('pending_review', 'complete');
