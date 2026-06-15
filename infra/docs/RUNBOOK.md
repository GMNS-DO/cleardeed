# ClearDeed Runbook (A.5.3)

> What to do when [X] breaks. Open this when something's on fire.

---

## 1. Home page 500s

**Symptom:** `GET /` returns 500. Buyers can't land on the site.

**Check:**
1. Vercel deployment status: `vercel.com/[team]/cleardeed` — last deploy green?
2. Supabase status: `status.supabase.com` — any incidents?
3. `report_events` table: any `event_name='error_caught'` with `route='/'` in the last hour?

**Fix:**
- If Vercel: redeploy via Vercel dashboard.
- If Supabase: check connection pool exhaustion (`SELECT count(*) FROM pg_stat_activity;` in Supabase SQL editor).
- If neither: roll back to previous deploy via Vercel.

---

## 2. /api/report/create returns 500

**Symptom:** Buyer paid but no report. `/api/payment/success` callback returns 500.

**Check:**
1. Look at the report row in `reports` table — does it have `html` and `error_message=NULL`?
2. `report_events` table: any `event_name='error_caught'` with `route='/api/report/create'`?
3. The fetchers' last live smoke result: `npx vitest run qa/all_fetchers_live_smoke.test.ts`

**Fix:**
- If the report is generated but not delivered: rerun the email via `POST /api/reports/[id]/refresh` (requires REPORT_CREATE_TOKEN).
- If the report is missing: rerun `POST /api/report/create` with the same plot data.
- If a fetcher is down: check the smoke test for the failing fetcher and either:
  - Wait for the upstream portal to recover (typical 1-6h)
  - Defer the affected sections to manual-instructions fallback (per D-037)

---

## 3. Razorpay webhook not firing

**Symptom:** Buyer paid, but `payment_success` funnel event not in `report_events` for that reportId.

**Check:**
1. Razorpay dashboard → Webhooks: is the webhook URL correct and is it enabled?
2. Vercel logs for `/api/webhook/razorpay` — any 401/500?
3. The webhook secret in env: `RAZORPAY_WEBHOOK_SECRET` matches what's in Razorpay dashboard?

**Fix:**
- If webhook is failing with 401: env secret mismatch. Update Vercel env, redeploy.
- If webhook is not being sent at all: check Razorpay for `payment.captured` event subscription.
- If webhook is succeeding but `payment_success` is not in DB: check `report_events` for `event_name='error_caught'` with webhook context.

---

## 4. Report email not delivered

**Symptom:** Buyer paid, report has `html` in DB, but no email.

**Check:**
1. Resend dashboard (`resend.com`): any bounces, complaints, or rate limits?
2. `report_events` table: any `event_name='error_caught'` with `route='/api/payment/success'` or `/api/webhook/razorpay`?
3. The buyer's email address — did they mistype it? Look at `checkout_sessions.session_data->>email`.

**Fix:**
- If Resend shows bounce: ask the buyer for a different email, rerun `POST /api/reports/[id]/refresh`.
- If Resend rate limit: wait and retry.
- If unknown error: `trackError()` will have captured it. Fix the underlying error and retry.

---

## 5. Bhulekh fetcher returning empty data

**Symptom:** Reports have `bhulekh_status='unavailable'`. Buyers see Section 1 missing.

**Check:**
1. `npx vitest run qa/all_fetchers_live_smoke.test.ts` — does the Bhulekh fetcher pass?
2. The Bhulekh portal: `bhulekh.ori.nic.in` — is it up?
3. Captcha: is the OCR pipeline (`packages/fetchers/bhulekh`) returning solvable captchas?

**Fix:**
- If portal is down: nothing to do, wait for recovery. Reports degrade to "manual verification required" per D-037.
- If OCR is failing: check the captcha model in `packages/fetchers/bhulekh/src/captcha.ts`. The model is ddddocr — re-run the test in `qa/captcha_accuracy.test.ts`.

---

## 6. Production DB full

**Symptom:** Reports table writes are failing with "disk full" or "out of memory".

**Check:**
1. Supabase dashboard → Database → Disk usage: >90%?
2. `SELECT pg_size_pretty(pg_database_size('postgres'));`
3. The `report_events` table — how many rows?

**Fix:**
- If `report_events` is large: it's append-only. Either:
  - Add a retention job: `DELETE FROM report_events WHERE created_at < NOW() - INTERVAL '90 days';`
  - Move to Supabase's logical replication + cold storage.
- If `reports` is large: PDF/HTML should be in object storage, not in the row. Move blobs to `storage.reports` bucket.

---

## 7. Rate-limit false positives

**Symptom:** Legitimate buyers getting 429 on `/api/preview` after a few attempts.

**Check:**
1. `apps/web/src/lib/rate-limit.ts` — what's the current limit? (default: 10 req/60s per IP)
2. Vercel edge logs — is the IP correct?

**Fix:**
- If the IP is wrong: switch from `req.headers.get('x-forwarded-for')` to Vercel's geo header.
- If the limit is too low: bump it (currently 10 req/60s per IP).

---

## 8. Stage vs Production out of sync

**Symptom:** Behavior differs on `staging.cleardeed.com` vs `cleardeed.com`.

**Check:**
1. Did someone merge a migration that wasn't applied to staging? Check `supabase/migrations/` for new files.
2. Are the env vars different? Vercel project → Settings → Env Vars.

**Fix:**
- `npx supabase db push` against staging DB.
- Sync env vars in Vercel.
