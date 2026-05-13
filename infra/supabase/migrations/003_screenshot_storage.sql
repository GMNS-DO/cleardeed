-- ClearDeed — Screenshot Storage for V1.1
-- Migration: 003_screenshot_storage
-- Created: 2026-05-13
-- V1.1: Bhulekh Front Page + Back Page screenshots per report

-- Create storage bucket for report screenshots
INSERT INTO storage.buckets (id, name, public)
VALUES ('report-screenshots', 'report-screenshots', false)
ON CONFLICT (id) DO NOTHING;

-- Create reports_screenshots table for screenshot metadata
CREATE TABLE IF NOT EXISTS reports_screenshots (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  report_id TEXT NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
  screenshot_type TEXT NOT NULL, -- 'bhulekh_front' | 'bhulekh_back' | 'cadastre'
  storage_path TEXT NOT NULL, -- e.g. 'reports/{reportId}/bhulekh/front.png'
  storage_url TEXT, -- public URL after upload
  file_size_bytes INTEGER,
  captured_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (report_id, screenshot_type)
);

-- Add bhulekh screenshot columns to reports table for quick access
ALTER TABLE reports ADD COLUMN IF NOT EXISTS bhulekh_front_screenshot_url TEXT;
ALTER TABLE reports ADD COLUMN IF NOT EXISTS bhulekh_back_screenshot_url TEXT;
ALTER TABLE reports ADD COLUMN IF NOT EXISTS bhulekh_back_page_status TEXT; -- 'success' | 'blank' | 'failed' | 'not_applicable'
ALTER TABLE reports ADD COLUMN IF NOT EXISTS bhulekh_back_page_mutations INTEGER DEFAULT 0;
ALTER TABLE reports ADD COLUMN IF NOT EXISTS bhulekh_back_page_encumbrances INTEGER DEFAULT 0;

-- Index for screenshot lookups
CREATE INDEX IF NOT EXISTS idx_reports_screenshots_report_id ON reports_screenshots(report_id);
CREATE INDEX IF NOT EXISTS idx_reports_screenshots_type ON reports_screenshots(screenshot_type);