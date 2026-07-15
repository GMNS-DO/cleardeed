# Survey Trigger Endpoint + Scheduler (PI-4 T7)

## Overview

Every ClearDeed report schedules four follow-up surveys at:
- 30 days post-generation
- 90 days
- 180 days
- 365 days

These surveys are the proprietary feedback loop described in CLAUDE.md §On the verification feedback loop — they feed back into the insight engine and are the single most defensible product asset.

## Endpoint contract

```
POST /api/internal/survey
Authorization: Bearer <ADMIN_VIEW_TOKEN>

Body:
{
  "reportId": "uuid",
  "stage": "30d" | "90d" | "180d" | "365d",
  "reason": "manual_trigger" | "scheduled"   // optional
}

Response 200:
{ "scheduled": true, "scheduledFor": "<ISO-8601>" }

Response 404:
{ "error": "report_not_found" }

Response 409:
{ "error": "already_scheduled", "scheduledFor": "<ISO-8601>" }
```

## Invariants

- The endpoint idempotently coalesces — a second POST with the same `(reportId, stage)` returns 409 rather than inserting a duplicate.
- The endpoint is fail-closed behind `ADMIN_VIEW_TOKEN`. It is not exposed to buyers.
- Scheduling logic lives in the cron runner (`scripts/cron/run-followup-surveys.ts`) which the Vercel cron hits at 06:00 UTC daily.
- A `survey_triggers` table (migration 026) stores pending triggers. Expired rows (>30 days old and not yet fired) are cleaned up by the cron.

## Cron config (vercel.json)

```json
{
  "crons": [
    { "path": "/api/internal/survey/cron", "schedule": "0 6 * * *" }
  ]
}
```

## Data flow

```
Report generated
  └─ reports.pipeline_status = success
  └─ cron runner wakes daily
      └─ queries survey_triggers WHERE due_at <= now() AND status = 'pending'
      └─ for each: emits trigger → sends SMTP with survey link → marks sent
      └─ if stage=365d and response received: flags report as "post-close validated"
```

## Survey link (hosted on cleardeed.in)

`https://cleardeed.in/survey?reportId=<id>&stage=30d`

The survey page collects: did you proceed? Which risks materialized? What did your lawyer find that ClearDeed missed? All responses are anonymized and stored against the rule IDs they confirm/refute — feeding the confidence calibration system in the consumer-report-writer.

## V1.5 migration path

Follow-up emails are sent from `noreply@cleardeed.in` with the survey link. The actual survey UI (form + storage) is V1.5; for V1 launch we just log the "would-have-sent" intent in `survey_triggers.scheduled_for` and flag the gap in the session log.
