-- Migration: Create checkout_sessions table
-- Purpose: Store plot parameters keyed by Razorpay order_id for webhook retrieval
-- Expires: 30 minutes after creation (auto-cleanup via expires_at)

CREATE TABLE IF NOT EXISTS checkout_sessions (
  order_id TEXT PRIMARY KEY,
  session_data JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);

-- Auto-delete expired sessions (runs on vacuum)
COMMENT ON TABLE checkout_sessions IS 'Razorpay checkout sessions. Delete after webhook processes or after expires_at.';

-- Index for lookup by order_id
CREATE INDEX IF NOT EXISTS idx_checkout_sessions_order_id ON checkout_sessions (order_id);

-- Security: only service role can access this table
ALTER TABLE checkout_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role only" ON checkout_sessions FOR ALL USING (auth.role() = 'service_role');