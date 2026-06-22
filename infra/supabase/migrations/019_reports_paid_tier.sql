-- Migration 019: Add paid-tier reconciliation columns to reports
-- T-014: Razorpay metering — capture which tier was paid and how much.
--
-- Adds four columns:
--   paid_tier          text   — 'standard' | 'verified' | 'guaranteed' | null
--   price_paid_paise   int    — amount paid in paise (reconciled server-side)
--   paid_at            timestamptz — timestamp of payment capture
--   paid_order_id      text   — Razorpay order_id (for refunds + audit)
--
-- Also adds the mark_report_paid() RPC that the Razorpay webhook calls.
--
-- Safety:
--   - All four columns are nullable. Existing pre-paid rows are unaffected.
--   - The mark_report_paid() RPC uses SECURITY DEFINER so the webhook can
--     update any report row. RLS is bypassed intentionally — payment
--     reconciliation is a service-role concern, not a user-permission one.
--   - The RPC accepts (report_id, tier, price, paid_at, order_id) as a
--     single call to keep the wire-shape narrow and auditable.

ALTER TABLE reports
  ADD COLUMN IF NOT EXISTS paid_tier text,
  ADD COLUMN IF NOT EXISTS price_paid_paise integer,
  ADD COLUMN IF NOT EXISTS paid_at timestamptz,
  ADD COLUMN IF NOT EXISTS paid_order_id text;

COMMENT ON COLUMN reports.paid_tier IS
  'T-014: which ClearDeed tier was paid for this report. One of: standard, verified, guaranteed, or NULL for free preview / pre-paid rows.';
COMMENT ON COLUMN reports.price_paid_paise IS
  'T-014: amount paid in paise, reconciled server-side from the pricing module against Razorpay order notes.';
COMMENT ON COLUMN reports.paid_at IS
  'T-014: ISO timestamp of the payment.captured webhook event.';
COMMENT ON COLUMN reports.paid_order_id IS
  'T-014: Razorpay order_id (e.g. order_NXm9c3...). Used for refunds + audit.';

-- Lookup index for the metering gate (count paid reports by user)
-- The free-preview gate on /api/report/create queries this to enforce
-- FREE_PREVIEW_LIMIT_PER_USER (currently 1).
CREATE INDEX IF NOT EXISTS idx_reports_user_paid_at
  ON reports (user_id, paid_at)
  WHERE paid_at IS NOT NULL;

-- Lookup index for reconciling a report back to its Razorpay order
CREATE INDEX IF NOT EXISTS idx_reports_paid_order_id
  ON reports (paid_order_id)
  WHERE paid_order_id IS NOT NULL;

-- ── mark_report_paid RPC ─────────────────────────────────────────────────────
-- Idempotent: if the report is already paid with the same tier/price, no-op.
-- If it's already paid with a different tier/price, refuse (downgrade
-- attacks). This keeps the column read-only for the buyer.
CREATE OR REPLACE FUNCTION mark_report_paid(
  p_report_id text,
  p_paid_tier text,
  p_price_paid_paise integer,
  p_paid_at timestamptz,
  p_paid_order_id text
) RETURNS void AS $$
DECLARE
  v_existing_paid_tier text;
  v_existing_price_paise integer;
BEGIN
  SELECT paid_tier, price_paid_paise
    INTO v_existing_paid_tier, v_existing_price_paise
  FROM reports
  WHERE id = p_report_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Report % not found', p_report_id;
  END IF;

  IF v_existing_paid_tier IS NOT NULL AND v_existing_paid_tier <> p_paid_tier THEN
    RAISE EXCEPTION 'Report % is already paid at tier "%"; cannot change to "%"',
      p_report_id, v_existing_paid_tier, p_paid_tier;
  END IF;

  IF v_existing_price_paise IS NOT NULL AND v_existing_price_paise <> p_price_paid_paise THEN
    RAISE EXCEPTION 'Report % is already paid at price %; cannot change to %',
      p_report_id, v_existing_price_paise, p_price_paid_paise;
  END IF;

  UPDATE reports
  SET paid_tier = p_paid_tier,
      price_paid_paise = p_price_paid_paise,
      paid_at = p_paid_at,
      paid_order_id = p_paid_order_id
  WHERE id = p_report_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- count_user_paid_reports — used by the metering gate.
-- Returns the number of reports the given user has paid for.
-- Counts rows where paid_at IS NOT NULL (i.e. payment has been
-- reconciled, not just created). Free previews are excluded.
CREATE OR REPLACE FUNCTION count_user_paid_reports(p_user_id text)
RETURNS integer AS $$
DECLARE
  v_count integer;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN 0;
  END IF;
  SELECT count(*)::integer INTO v_count
  FROM reports
  WHERE user_id = p_user_id
    AND paid_at IS NOT NULL;
  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION mark_report_paid IS
  'T-014: idempotent RPC for the Razorpay webhook to reconcile a paid report.';
COMMENT ON FUNCTION count_user_paid_reports IS
  'T-014: count of paid reports for a user (used by the metering gate).';
