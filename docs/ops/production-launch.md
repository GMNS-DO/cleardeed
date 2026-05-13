# ClearDeed Production Launch Runbook

Use this after deploying the current code to Vercel.

## Required Vercel Environment Variables

Set these for Production, Preview, and Development unless a narrower scope is intentional:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `ADMIN_VIEW_TOKEN`
- `REPORT_CREATE_TOKEN` (optional; if omitted, `ADMIN_VIEW_TOKEN` is accepted for report creation)

`ADMIN_VIEW_TOKEN` should be a long random value. The `/admin` route fails closed when this is missing.
`POST /api/report/create` requires a bearer token in production so the expensive scraper pipeline is not publicly callable during concierge launch.

## Supabase

1. Rotate the service role key if it was pasted into any chat or terminal history.
   See [key-rotation.md](./key-rotation.md) for exact steps.
2. Update `SUPABASE_SERVICE_ROLE_KEY` in Vercel.
3. Apply `infra/supabase/migrations/002_lead_requests.sql` if the `lead_requests` table does not exist.

## Smoke Test

After deploy:

```bash
npm run verify:prod
```

With admin verification:

```bash
ADMIN_VIEW_TOKEN="<same value configured in Vercel>" npm run verify:prod
```

With a separate report-creation token:

```bash
ADMIN_VIEW_TOKEN="<admin token>" REPORT_CREATE_TOKEN="<report token>" npm run verify:prod
```

Expected result:

- Lead intake writes.
- Report creation returns a durable `reportId`.
- `/report/<reportId>` renders the persisted report, not demo data.
- `/admin` is locked without a token.
- `/admin?token=...` loads and shows the smoke report when `ADMIN_VIEW_TOKEN` is provided.

## Current Known Production Failure

As of Session 032, production accepts lead intake but report generation fails because the deployed app still has old A11 OutputAuditor false positives for required negated disclaimer language. Deploy the current local code before re-running the smoke test.
