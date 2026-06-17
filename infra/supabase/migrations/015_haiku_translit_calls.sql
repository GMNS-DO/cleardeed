-- P1 P3: Haiku oracle call tracker.
--
-- The Haiku oracle (agents/consumer-report-writer/src/translit/llm-oracle.ts)
-- is gated by HAIKU_TRANSLIT_ENABLED feature flag (default off in prod).
-- When enabled, we need to:
--   1. Track per-report call count to enforce the 3-call sub-budget.
--   2. Track daily total to enforce the 200/day hard cap.
--   3. Audit trail: which reports used the oracle, what was sent, what
--      was returned, what it cost.
--
-- Plan §2.1 P1 P3: "Supabase-backed per-report sub-budget (3 calls);
-- counter survives Vercel cold-starts."
--
-- The /tmp approach from earlier drafts was rejected in the plan
-- (adversarial P1.4): Vercel serverless functions have ephemeral
-- /tmp that does not survive cold starts. Supabase is the durable
-- source of truth.

CREATE TABLE haiku_translit_calls (
  id          BIGSERIAL PRIMARY KEY,
  report_id   UUID NOT NULL,
  odia_text   TEXT NOT NULL,         -- the original Odia input (PII-redacted copy stored separately if needed)
  redacted    BOOLEAN NOT NULL,      -- whether redactPII was applied
  result      TEXT NOT NULL,         -- 'ok' | 'rejected' | 'timeout' | 'error'
  output      TEXT,                  -- the LLM's transliteration (NULL on error)
  cost_usd    NUMERIC(10, 6) NOT NULL DEFAULT 0,  -- tracked cost in USD (6 decimals)
  duration_ms INTEGER NOT NULL,      -- SDK call duration
  error       TEXT,                  -- error message if result != 'ok'
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for the two query patterns the agent uses:
-- (a) "How many calls has this report used?" → idx on report_id
-- (b) "How many calls in the last 24h?" → idx on created_at
CREATE INDEX idx_haiku_translit_calls_report_id
  ON haiku_translit_calls (report_id);
CREATE INDEX idx_haiku_translit_calls_created_at
  ON haiku_translit_calls (created_at DESC);

-- RLS: read access for service_role only (admin tooling); no public read.
-- The agent uses the service role key, not anon, so RLS is a defence
-- in depth.
ALTER TABLE haiku_translit_calls ENABLE ROW LEVEL SECURITY;
CREATE POLICY haiku_translit_calls_service_role
  ON haiku_translit_calls FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
