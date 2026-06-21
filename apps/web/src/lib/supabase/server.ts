/**
 * ClearDeed — Supabase Auth server client (App Router).
 *
 * Used in:
 *   - Server Components
 *   - API Routes
 *   - Middleware (via lib/supabase/middleware.ts)
 *
 * The server client reads cookies via next/headers. Use this anywhere
 * outside of middleware.ts. For middleware, use lib/supabase/middleware.ts
 * which gets cookies from the request directly.
 *
 * Authentication contract:
 *   - const { data: { user } } = await supabase.auth.getUser();
 *   - user is null when there is no valid session
 *   - user.id is the auth.uid() to write into reports.user_id
 *
 * Uses @supabase/ssr (not the deprecated @supabase/auth-helpers-nextjs).
 * Cookies are read/written via the getAll/setAll callback contract that
 * App Router requires.
 */
import { cookies } from "next/headers";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

export interface ServerSupabaseOptions {
  /** Override the response cookies (used in API routes that want to surface Set-Cookie). */
  responseCookies?: { set: (name: string, value: string, options?: CookieOptions) => void };
}

export async function getSupabaseServerAuth(): Promise<SupabaseClient> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      "Missing Supabase env vars. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY."
    );
  }

  const cookieStore = await cookies();

  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Server Components cannot write cookies — middleware handles that case.
          // We swallow the error so getUser() can still read the existing cookie.
        }
      },
    },
  });
}
