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

## Pre-apply verification (2026-06-17)

Static checks performed before staging migration:

| Check | Result |
|---|---|
| SQL balanced parens / statement count | 017: 34/34, 12 stmts; 018: 10/10, 4 stmts |
| Insert columns vs NOT NULL columns | Found bug: `duration_ms` missing from `recordCost` insert — fixed in `ecd081c` |
| `report_ai_unlocks` UNIQUE constraint match | `(report_id, doc_type)` — webhook upsert matches (`018`) |
| `isUnlocked` query | Reads `(report_id, doc_type)` — matches `report_ai_unlocks` UNIQUE |
| SSE wire protocol match | Server emits `field`/`done`/`error`; client hook adds 3 listeners — match |
| `AIDocUpsellGate` body | Posts `{ reportId, docType, amount: 49900 }` — `docType` is `"igr_ec" \| "bhulekh_back"`, accepted by order endpoint |
| `AIDocUpsellGate` ↔ webhook | Upsell order `kind: "ai_doc"` → webhook writes `report_ai_unlocks` row → next SSE call passes `isUnlocked()` check |
| Migration 017 `report_ai_quotas` table | Created but not yet read by cost-store; cost-tracker sums from `report_ai_costs` directly. V2 work: switch to quota-row lookups for O(1) gate. Not blocking. |
| Test suite | 524/524 pass; 12 skipped (200-name gate, V2 work) |

Open the migration PR. After staging apply, run the smoke test and confirm the upsell → unlock → SSE chain works end-to-end on a staging report.
