# ClearDeed — Supabase Service Role Key Rotation

If the service role key was pasted into a chat or terminal during setup, it must be rotated before the app goes live.

## Rotate in Supabase

1. Open your Supabase project: `https://supabase.com/dashboard/project/<your-project-id>/settings/api`
2. In the **API** settings page, find the **Service role** section (bottom of the page).
3. Click **Regenerate**. Supabase will revoke the old key and show a new one.
4. Copy the new key immediately — it is shown only once.

## Update in Vercel

1. Open `https://vercel.com/gmns-dos-projects/v0-cleardeed/settings/environment-variables`
2. Find `SUPABASE_SERVICE_ROLE_KEY` — click the edit icon and replace the value with the new key.
3. Do this for all three environments: **Production**, **Preview**, **Development**.
4. Click **Save Changes**. Vercel will redeploy automatically.

## Verify

After the redeploy completes, run the production smoke test:

```bash
ADMIN_VIEW_TOKEN="<your-admin-token>" npm run verify:prod
```

Expected: lead intake pass, report creation pass, report link pass, admin closed without token.

## If You Cannot Access the Supabase Project

If you cannot log into the Supabase dashboard (e.g., account was created on a different browser/device):

1. Go to `https://supabase.com/dashboard` and check if you are logged in.
2. If not, use your email + password (or SSO provider) to sign in.
3. If the project was created by a team member, ask them to transfer ownership or regenerate the key.
4. As a last resort, create a new Supabase project, re-run `infra/supabase/migrations/001_initial.sql` and `002_lead_requests.sql`, and update all four Supabase env vars in Vercel.

## Related tasks

- T-026: Rotate Supabase service role key (this file)
- T-027: Verify live report persistence
- `docs/ops/production-launch.md`: Full launch runbook
- `scripts/verify-persistence.ts`: End-to-end persistence verification script