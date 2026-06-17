-- P2 V1: AI document interpretation (Claude) — DB tables.
--
-- Three tables:
--   1. report_ai_interpretations  — the canonical interpretation result
--      (fields, summary, cost) per (report, docType). One row per
--      (report_id, doc_type) — UPSERT on conflict.
--   2. report_ai_costs            — append-only ledger of every LLM
--      call (org_id, model, input/output/cache tokens, cost in USD,
--      duration). Used to (a) enforce the org-level $500/month cap
--      and (b) audit trail for the lawyer review.
--   3. report_ai_quotas           — per-org daily + monthly spend
--      accumulator, updated on each cost row insert. The cost-tracker
--      consults this row before issuing an LLM call.
--
-- Plan §3.1: the upsell (₹499) lives in the checkout flow and is
-- outside the scope of this migration. The ai_doc_order_kind enum
-- value would be added there.
--
-- Plan §3.2: per-report P2 ceiling is $0.05. Org cap is $500/month.
-- The default quota row uses $500.

-- 1. The interpretation result (one row per report + doc type).
CREATE TABLE report_ai_interpretations (
  id               BIGSERIAL PRIMARY KEY,
  report_id        UUID NOT NULL,
  org_id           UUID,                              -- nullable for backward compat
  doc_type         TEXT NOT NULL,                     -- 'igr_ec' | 'bhulekh_back' | ...
  model            TEXT NOT NULL,                     -- 'claude-sonnet-4-5' | 'claude-haiku-4-5' | ...
  cache_hit        BOOLEAN NOT NULL DEFAULT false,
  fields           JSONB NOT NULL,                    -- FieldExtraction[] (validated by the agent)
  summary          TEXT,                              -- plainEnglishSummary
  warnings         JSONB NOT NULL DEFAULT '[]'::jsonb,
  cost_usd_cents   INTEGER NOT NULL,                  -- rounded to whole cents
  duration_ms      INTEGER NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (report_id, doc_type)
);
CREATE INDEX idx_report_ai_interpretations_report
  ON report_ai_interpretations (report_id);

ALTER TABLE report_ai_interpretations ENABLE ROW LEVEL SECURITY;
CREATE POLICY report_ai_interpretations_service_role
  ON report_ai_interpretations FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- 2. The cost ledger (append-only).
CREATE TABLE report_ai_costs (
  id                  BIGSERIAL PRIMARY KEY,
  org_id              UUID,                            -- nullable
  report_id           UUID,                            -- nullable (cost may be tracked before report is finalised)
  doc_type            TEXT NOT NULL,
  model               TEXT NOT NULL,
  input_tokens        INTEGER NOT NULL,
  output_tokens       INTEGER NOT NULL,
  cache_read_tokens   INTEGER NOT NULL DEFAULT 0,
  cache_write_tokens  INTEGER NOT NULL DEFAULT 0,
  cost_usd_cents      INTEGER NOT NULL,
  duration_ms         INTEGER NOT NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_report_ai_costs_org_created
  ON report_ai_costs (org_id, created_at DESC);
CREATE INDEX idx_report_ai_costs_report
  ON report_ai_costs (report_id);

ALTER TABLE report_ai_costs ENABLE ROW LEVEL SECURITY;
CREATE POLICY report_ai_costs_service_role
  ON report_ai_costs FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- 3. Per-org spend quota (read by the cost-tracker before each call).
-- Row is created on first spend; updated on every cost insert.
CREATE TABLE report_ai_quotas (
  org_id                 UUID PRIMARY KEY,
  monthly_cap_usd_cents  INTEGER NOT NULL DEFAULT 50000,  -- $500
  monthly_spent_cents    INTEGER NOT NULL DEFAULT 0,
  daily_cap_usd_cents    INTEGER NOT NULL DEFAULT 10000,   -- $100
  daily_spent_cents      INTEGER NOT NULL DEFAULT 0,
  month_started_at       TIMESTAMPTZ NOT NULL DEFAULT date_trunc('month', now()),
  day_started_at         TIMESTAMPTZ NOT NULL DEFAULT date_trunc('day', now()),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE report_ai_quotas ENABLE ROW LEVEL SECURITY;
CREATE POLICY report_ai_quotas_service_role
  ON report_ai_quotas FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
