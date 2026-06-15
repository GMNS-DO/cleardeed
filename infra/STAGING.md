# Staging Environment (A.4.4)

The launch-week staging environment is composed of two
independently-managed pieces:

## 1. Vercel Preview Deployments (auto)

Vercel auto-creates a preview deployment for every PR. This is the
fastest "does my change work" check. Use it for:

- Visual review of UI changes
- Smoke-testing new API routes before they hit main
- Sharing "look at this" links in PR review

**Configuration**: Default Vercel behavior. No `vercel.json` change
required. Preview URL is `https://cleardeed-git-<branch>-<team>.vercel.app`.

**Environment variables for preview**: Vercel reads preview env vars
from the Vercel project settings → Environment Variables → add
"Preview" environment. The production env vars are NOT shared with
preview by default. As of June 2026, the founder needs to manually
copy the production env vars to the Preview environment on first
setup, then keep them in sync via the Vercel CLI:
  `vercel env pull .env.preview`

## 2. Staging Supabase Project (manual, one-time setup)

A separate Supabase project (named "ClearDeed Staging") for any
work that needs DB writes outside a production-shaped data flow.

**Setup steps** (one-time, run by the founder):

1. Create a new Supabase project at https://supabase.com
   - Name: `cleardeed-staging`
   - Region: `ap-south-1` (Mumbai, same as production)
   - Plan: Free tier is fine for launch
2. In the staging project SQL editor, run all migrations from
   `infra/supabase/migrations/` in numeric order (001 → 013).
3. Set the staging project's API URL and service-role key as the
   Preview env vars in the Vercel project (so preview deployments
   talk to the staging DB, not production).
4. Optional: also set the founder's personal Supabase URL as
   the "Development" env, so `pnpm dev` locally doesn't write to
   production by accident.

**Why two projects (staging + preview auto-deploys)**:
- Preview auto-deploys: fast, no DB setup, good for code-only changes
- Staging project: when you need to test against a real DB (e.g.
  a fetcher's contract against the live Bhulekh portal, which
  needs the staging DB to hold a "test report" record)

## 3. What is NOT staging

This is launch-week, not enterprise. We are not building:

- A separate `staging` branch. Use Vercel preview deployments.
- A canary release system. Vercel does this automatically.
- A separate staging domain (e.g. `staging.cleardeed.in`).
  Preview URLs from Vercel are enough for review.

## Verification

After creating the staging project, the founder should:

1. Open a PR with a small UI change.
2. Confirm Vercel auto-creates a preview URL in the PR.
3. Confirm the preview URL writes a row to the staging DB
   (check the staging Supabase → Table Editor → `reports`).
4. Confirm `pnpm dev` locally also points at the staging DB.

If any of those four steps fail, the staging environment is not
set up correctly and the launch plan will not work.

## Production data protection

The single most important rule:

> **No code change may be merged to `main` without a smoke test
> against the staging project (or a preview deployment)
> confirming it works.**

This is enforced informally today. After PI 3 launch, the
production smoke workflow (`.github/workflows/production-smoke.yml`)
is extended to run on every PR with the preview URL.
