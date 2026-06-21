# ClearDeed — Authentication source

This file is the canonical source-of-truth for how buyer / admin authentication works in ClearDeed. Update this file BEFORE changing any of the related code.

## What it does

Buyers sign in with their phone number. We send a 6-digit OTP via SMS through Supabase Auth. They enter the OTP, get a session cookie, and the session is used to:

1. Gate the buyer's dashboard at `/dashboard` (only their own reports show up).
2. Pre-payment auth gate at `/api/checkout` — no anonymous purchases.
3. Refresh-ownership check at `/api/reports/:id/refresh` — only the report's owner can pay to refresh it.
4. Write `reports.user_id = auth.uid()` for every report the buyer purchases.

## Stack

- **Provider**: Supabase Auth (phone-OTP channel `sms`).
- **Client**: `@supabase/ssr` (`createBrowserClient` / `createServerClient`), not the deprecated `@supabase/auth-helpers-nextjs`.
- **Phone library**: `libphonenumber-js` for E.164 normalization on the client.
- **SMS gateway**: MSG91 (India). Set up via Supabase's custom-SMS-hook.

## Files

| File | Role |
| --- | --- |
| `apps/web/src/lib/supabase/server.ts` | Server client (App Router) for API routes + Server Components. |
| `apps/web/src/lib/supabase/browser.ts` | Singleton browser client for client components. |
| `apps/web/src/lib/supabase/middleware.ts` | `updateSession()` — refreshes the access token on every request. |
| `apps/web/src/middleware.ts` | Next.js middleware. Wires `updateSession()` and gates `/dashboard` and `/checkout/*`. |
| `apps/web/src/lib/auth-helpers.ts` | `getAuthUser()` — extracts the user from the request's session cookie. |
| `apps/web/src/app/login/page.tsx` | Public marketing-style header. |
| `apps/web/src/app/login/LoginForm.tsx` | Two-step phone → OTP client component. |
| `apps/web/src/app/dashboard/page.tsx` | Buyer's report history. Lists only `auth.uid() == reports.user_id`. |
| `apps/web/src/app/dashboard/SignOutButton.tsx` | Client component that calls `supabase.auth.signOut()`. |
| `apps/web/src/app/api/checkout/route.ts` | Hard auth gate. 401 with `next: /login?...` when no session. |
| `apps/web/src/app/api/reports/[id]/refresh/route.ts` | Hard auth gate + ownership check (`report.userId == auth.uid()`). |
| `apps/web/src/app/api/report/create/route.ts` | Anonymous-OK. Writes `user_id` when authenticated. |
| `apps/web/src/app/api/report/pregenerate/route.ts` | Anonymous-OK. Writes `user_id` when authenticated. |
| `apps/web/src/app/api/payment/success/route.ts` | Reads `auth.uid()` from session cookie; falls back to `checkout_sessions.auth_uid`. |
| `apps/web/src/app/api/webhook/razorpay/route.ts` | Reads `auth_uid` from `checkout_sessions` (server-to-server — no cookie). |
| `infra/supabase/migrations/018_reports_user_fk.sql` | Adds `userId` to `get_report()` JSONB; FK from `reports.user_id` to `auth.users(id)` ON DELETE SET NULL. |

## Auth flow

```
[Buyer]                 [Browser]                 [ClearDeed]            [Supabase]            [MSG91]
   |                       |                          |                       |                     |
   |  enters phone         |                          |                       |                     |
   |---------------------->|                          |                       |                     |
   |                       |  signInWithOtp(phone)    |                       |                     |
   |                       |------------------------->|---------------------->|                     |
   |                       |                          |                       |  send OTP request   |
   |                       |                          |                       |-------------------->|
   |                       |                          |                       |                     |
   |                       |                          |                       |<----- SMS -----|
   |  receives OTP         |                          |                       |                     |
   |<----------------------|                          |                       |                     |
   |                       |                          |                       |                     |
   |  enters OTP           |                          |                       |                     |
   |---------------------->|                          |                       |                     |
   |                       |  verifyOtp(phone,token)  |                       |                     |
   |                       |------------------------->|---------------------->|                     |
   |                       |                          |                       |                     |
   |                       |<---- Set-Cookie: sb-...-auth-token -----|
   |                       |                          |                       |                     |
   |  navigates /dashboard |                          |                       |                     |
   |---------------------->|  /dashboard (Server)     |                       |                     |
   |                       |  getUser() -> user       |                       |                     |
   |                       |  SELECT * FROM reports WHERE user_id = auth.uid()   |                |
   |                       |                          |                       |                     |
   |  clicks Buy           |                          |                       |                     |
   |---------------------->|  POST /api/checkout      |                       |                     |
   |                       |  getAuthUser() -> user   |                       |                     |
   |                       |  --> writes session_data.auth_uid             |                     |
   |                       |                          |                       |                     |
   |                       |  opens Razorpay modal    |                       |                     |
   |                       |  ... pays ...            |                       |                     |
   |                       |                          |                       |                     |
   |                       |  Razorpay webhook        |                       |                     |
   |                       |  POST /api/webhook/razorpay                  |                     |
   |                       |  --> reads session_data.auth_uid              |                     |
   |                       |  --> createReport({ userId: auth_uid })       |                     |
   |                       |  --> reports.user_id is set                  |                     |
```

## Setup checklist (production)

1. **Supabase project**: Already done (Vercel env vars set in T-026).
2. **Phone provider enabled**: In Supabase dashboard → Authentication → Sign In/Up → Phone → toggle ON.
3. **SMS provider set to MSG91**: Authentication → SMS Provider → Custom (uses the Auth Hook).
4. **Auth Hook configured**: Authentication → Hooks → Custom SMS Hook. The hook URL is the MSG91 HTTP endpoint with the Supabase Bearer in the `Authorization` header. See https://supabase.com/docs/guides/auth/auth-hooks/custom-sms-hook.
5. **DLT registration in India** (mandatory for any commercial SMS):
   - Register on https://vigyapanpehlihan.gov.in
   - Get a Sender ID (e.g. "CDEEDIN")
   - Get a Template ID (e.g. for "Your ClearDeed OTP is {#var#}")
6. **Site URL + Redirect URLs**: Authentication → URL Configuration → set to `https://cleardeed.in` and add `http://localhost:3000` for dev.
7. **Rate limits**: Supabase enforces 4 OTPs/hour/phone by default. This is fine — buyers retry the same code rather than requesting new ones.
8. **OTP expiry**: Default 60s. Phone is the entire identity, so brute-force risk is bounded by the per-phone rate limit.

## Setup checklist (local dev)

1. Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` in `apps/web/.env.local`.
2. Phone provider: use a test phone (e.g. `+919999999999`) configured in Supabase's "Test Phone Numbers" — Supabase will skip the SMS gateway and accept any 6-digit code.
3. The dev console logs `[/api/...]` lines for every auth gate hit.

## Security boundaries

| Boundary | Mechanism | Failure mode |
| --- | --- | --- |
| Buyer cannot view another buyer's reports | `/dashboard` query: `WHERE user_id = auth.uid()` + the FK constraint in migration 018 | Query is server-side; FK is the safety net if the app filter is ever removed. |
| Buyer cannot pay for someone else's report | `/api/checkout` and `/api/reports/:id/refresh` both return 401 without session, 403 if `report.userId != auth.uid()` | 403 is enforced at the route level. The migration FK is the safety net. |
| Anonymous reports still work | `reports.user_id` is nullable; pre-T-013 rows have NULL | Existing reports remain visible via token URL only (no `/dashboard` listing). |
| User deletion (PDPD Act right-to-erasure) | FK `ON DELETE SET NULL` | Reports become anonymous but stay intact — preserves audit trail. |
| Session theft | Supabase refresh tokens rotate; access token is HTTP-only cookie (via `setAll` in `getSupabaseServerAuth`) | Server-side `getUser()` re-verifies against Supabase on every API call. |

## Known limitations

- **Email auth is not implemented.** Phone-only. Adding email later is one extra route in the login page.
- **No MFA / 2FA.** Phone-OTP is the only factor. Adding a second factor would require a custom Auth Hook.
- **No passwordless email link.** Only SMS OTP.
- **No social login.** Adding Google OAuth is ~30 minutes of work but unblocks nothing for the Indian land-buyer cohort.
- **Pre-T-013 reports are unowned.** They show up in /dashboard only if the buyer's first authenticated purchase triggers backfill — they do NOT. To claim an old report, the buyer should re-purchase (which they can re-do free of cost, since the ₹1 trial is meant for testing the flow).

## Failure modes (operational)

| Failure | What the buyer sees | What we see |
| --- | --- | --- |
| MSG91 down | "Code not sent" error on /login | Supabase Auth Hook logs the gateway error |
| Supabase down | /login never renders the form | Vercel function errors (500) |
| FK violation on insert | (Should never happen — auth.uid() is always valid) | Supabase insert error in `/api/payment/success` |
| Stale session cookie | Redirect to /login on next dashboard visit | No-op; refresh token is rotated automatically |

## Testing

- `apps/web/src/lib/auth-helpers.test.ts` — 5 unit tests for `getAuthUser()`.
- `apps/web/src/lib/supabase/middleware.test.ts` — 5 unit tests for `updateSession()` and `buildLoginRedirect()`.
- `apps/web/src/app/api/reports/[id]/refresh/route.test.ts` — adds 1 test for the 401 auth gate, updates the 200 test to mock `getAuthUser`.

Manual smoke: log in at /login, navigate to /dashboard, see the report list filtered to your account. Sign out, navigate to /dashboard, get redirected back to /login.
