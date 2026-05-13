-- ClearDeed — Lead Requests
-- Migration: 002_lead_requests.sql
-- Created: 2026-04-29

CREATE TABLE IF NOT EXISTS lead_requests (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  buyer_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  user_type TEXT NOT NULL DEFAULT 'buyer',
  location_text TEXT,
  gps_lat DECIMAL(9, 6),
  gps_lon DECIMAL(9, 6),
  claimed_owner_name TEXT,
  plot_description TEXT,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'new',
  source TEXT NOT NULL DEFAULT 'website',
  utm JSONB DEFAULT '{}'::JSONB
);

CREATE INDEX IF NOT EXISTS idx_lead_requests_created_at ON lead_requests(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_lead_requests_status ON lead_requests(status);
CREATE INDEX IF NOT EXISTS idx_lead_requests_phone ON lead_requests(phone);

DROP TRIGGER IF EXISTS update_lead_requests_updated_at ON lead_requests;
CREATE TRIGGER update_lead_requests_updated_at
  BEFORE UPDATE ON lead_requests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE lead_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow service role for lead_requests" ON lead_requests;
CREATE POLICY "Allow service role for lead_requests" ON lead_requests
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

COMMENT ON TABLE lead_requests IS 'Concierge launch intake requests from buyers, sellers, and brokers';
