# PID layer (`apps/web/src/lib/pipeline/pid/`)

The Pattern Intelligence Database (PID) is the corpus layer that
sits underneath the report pipeline. Every fetch result lands here
as an artifact + fact assertions + an event. Future sub-plans
(Sub-plan F: seller-name normalizer, Sub-plan G: ground-truth
expansion) read from this layer.

## Modules

- `keys.ts` — deterministic SHA-256 artifact keys. Same input → same key.
- `types.ts` — Zod schemas for the 4 write-input types.
- `client.ts` — typed DB client. One function per PID table.
  All writes go through `supabaseAdmin()` (service role, bypasses RLS).
- `mapper.ts` — pure `SourceResult → PidWritePayload` mapper.
  No I/O, fully unit-testable.
- `record-fetch-result.ts` — top-level `recordFetchResult()` called
  from the pipeline. Best-effort; never throws.

## Read paths

Live in `apps/web/src/lib/pipeline/corpus.ts`:
- `readPidArtifactsForReport(reportId)` — artifacts linked to a report
- `readPidEventsForProperty(propertyId)` — events on a property

## Kill switch

`PID_RECORDING_ENABLED=true` in the env turns on the pipeline write path.
Default is OFF. Set on Vercel only when explicitly enabling for a session.

## Read-when-stuck checklist

- Schema lives in `infra/supabase/migrations/006_pid_core.sql` +
  `007_pid_operational_layers.sql`. Both applied 2026-06-25.
- Sub-plan A (this) wires write paths. Sub-plan F adds the UI badge.
- The original PID track was removed in commit `fb6a2aa` (D-024/D-025).
  See `apps/web/src/lib/pipeline/corpus.ts` for the legacy no-op stubs.