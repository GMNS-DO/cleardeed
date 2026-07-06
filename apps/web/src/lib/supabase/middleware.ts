/**
 * ClearDeed — Supabase Auth session refresh for Next.js middleware.
 *
 * Runs on every request matching the middleware matcher. Refreshes
 * expired access tokens using the refresh token in the cookie, so
 * Server Components always see a fresh session.
 *
 * Reference pattern: https://supabase.com/docs/guides/auth/server-side/nextjs
 *
 * Usage (apps/web/src/middleware.ts):
 *   import { updateSession } from "@/lib/supabase/middleware";
 *   export async function middleware(request: NextRequest) {
 *     return await updateSession(request);
 *   }
 *
 * Auth-gate contract: this module exposes updateSession(). The auth-gate
 * logic (redirect to /login) lives in apps/web/src/middleware.ts so this
 * module stays a pure session-refresh helper.
 */
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";

export interface SessionRefreshResult {
  response: NextResponse;
  /** Supabase client after token refresh; null when env vars are missing. */
  supabase: SupabaseClient | null;
  /** The authenticated user, or null when no valid session. */
  user: { id: string } | null;
}

export async function updateSession(request: NextRequest): Promise<SessionRefreshResult> {
  let response = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    return { response, supabase: null, user: null };
  }

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: Array<{ name: string; value: string; options?: CookieOptions }>) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  // IMPORTANT: do not run any code between createServerClient and getUser.
  // A simple mistake could make it very hard to debug issues with users
  // being randomly logged out.

  const { data: { user } } = await supabase.auth.getUser();

  return { response, supabase, user: user ? { id: user.id } : null };
}

/**
 * Build a redirect response to /login with `next` carrying the original pathname + search.
 * Used by apps/web/src/middleware.ts to gate protected pages such as /dashboard.
 */
export function buildLoginRedirect(request: NextRequest): NextResponse {
  const url = request.nextUrl.clone();
  const nextPath = request.nextUrl.pathname + request.nextUrl.search;
  url.pathname = "/login";
  url.search = `?next=${encodeURIComponent(nextPath)}`;
  return NextResponse.redirect(url);
}
