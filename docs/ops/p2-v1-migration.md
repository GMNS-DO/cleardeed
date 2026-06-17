# P2 V1 — Apply AI Document Interpretation Migrations

## Required migrations

| # | File | Purpose |
|---|---|---|
| 017 | `infra/supabase/migrations/017_ai_document_interpretation.sql` | `report_ai_interpretations`, `report_ai_costs`, `report_ai_quotas` |
| 018 | `infra/supabase/migrations/018_report_ai_unlocks.sql` | `report_ai_unlocks` (one row per paid ₹499 unlock) |

Both are committed in `05a47c2` (P2 V1 unlock flow).

## Staging

1. Open the Supabase dashboard for the **staging** project.
2. SQL Editor → paste the contents of `017_ai_document_interpretation.sql` → Run.
3. SQL Editor → paste the contents of `018_report_ai_unlocks.sql` → Run.
4. Verify:
   ```sql
   SELECT table_name FROM information_schema.tables
   WHERE table_name IN ('report_ai_interpretations','report_ai_costs','report_ai_quotas','report_ai_unlocks')
   ORDER BY table_name;
   ```
   Expect 4 rows.

5. Smoke test the unlock flow with a Razorpay test order:
   - `POST /api/order/ai-doc` with `{ "reportId": "<staging-report-id>", "docType": "igr_ec" }`
   - Pay the order with a Razorpay test card.
   - Verify a row landed:
     ```sql
     SELECT * FROM report_ai_unlocks WHERE report_id = '<staging-report-id>';
     ```
   - Open `/report/<staging-report-id>` and click "Get AI Summary" — expect the Sonnet summary to render in the IGR EC panel.
   - Repeat for a **second** report with no payment — expect the upsell CTA, not a Claude call.

## Production

Apply the same migrations to production **after** the staging smoke test passes and at least one production-shape report has been processed end-to-end.

## Rollback

```sql
DROP TABLE IF EXISTS report_ai_unlocks;
DROP TABLE IF EXISTS report_ai_quotas;
DROP TABLE IF EXISTS report_ai_costs;
DROP TABLE IF EXISTS report_ai_interpretations;
```

Note: this drops the AI interpretation ledger. Do not run after production data has accumulated — there is no export step.
