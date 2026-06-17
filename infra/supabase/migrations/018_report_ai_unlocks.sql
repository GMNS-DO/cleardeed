-- P2 V1 follow-on: AI document interpretation unlock table.
--
-- When a user pays ₹499 for the AI summary add-on, the webhook
-- writes a row to report_ai_unlocks keyed by (report_id, doc_type).
-- The cost-tracker consults this table before issuing an LLM call —
-- if no unlock exists, the call is refused and a warning is returned
-- so the client can show the upsell gate.
--
-- One row per (report, doc). UNIQUE constraint enforces that.

CREATE TABLE report_ai_unlocks (
  id          BIGSERIAL PRIMARY KEY,
  report_id   UUID NOT NULL,
  doc_type    TEXT NOT NULL,                   -- 'igr_ec' | 'bhulekh_back'
  paid_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  order_id    TEXT NOT NULL,                   -- Razorpay order id (for refund audit)
  amount_paise INTEGER NOT NULL,               -- 49900 = ₹499
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (report_id, doc_type)
);

CREATE INDEX idx_report_ai_unlocks_report
  ON report_ai_unlocks (report_id);

ALTER TABLE report_ai_unlocks ENABLE ROW LEVEL SECURITY;
CREATE POLICY report_ai_unlocks_service_role
  ON report_ai_unlocks FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
