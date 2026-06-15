# ClearDeed Deploy & Monitor (A.5.3)

## Setup

```bash
git clone https://github.com/cleardeed/cleardeed.git
cd cleardeed
pnpm install
```

Create `.env.local`:
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
CLEARDEED_BASE_URL=http://localhost:3000
RAZORPAY_KEY_ID=
RAZORPAY_KEY_SECRET=
```

Start dev servers:
```bash
pnpm dev                                       # web on :3000
cd packages/orchestrator && pnpm dev           # orchestrator on :3002
```

Database: `npx supabase db reset` (local) or set `NEXT_PUBLIC_SUPABASE_URL` to a remote Supabase project.

## Deploy

Frontend → Vercel auto-deploy on push to `main`. Set env vars in Vercel project.

Database → Supabase Cloud in `ap-south-1` (Mumbai). Run `npx supabase db push` to apply migrations.

## Monitor

1. **Errors** — `trackError()` writes to `report_events` table (event_name='error_caught'). Query via Supabase dashboard.
2. **Latency** — `node qa/perf-baseline.mjs --base-url=https://your-app.vercel.app` measures home / preview / pipeline p95.
3. **Data quality** — `npx vitest run qa/ground_truth_expansion.test.ts` (15 ground-truth plots).
4. **Backups** — `infra/supabase/backup.sh` runs daily, 7-day retention.

## Staging

See `infra/STAGING.md` for the staging SOP. The preview smoke workflow runs on every PR.
