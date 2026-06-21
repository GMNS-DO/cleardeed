/**
 * ClearDeed — Auth helpers for API routes.
 *
 * Extracts the authenticated user from the request's Supabase session cookie
 * using the @supabase/ssr server client. Returns the user id (auth.uid())
 * or null when there is no valid session.
 *
 * Used by all /api routes that need to write reports.user_id.
 *
 * Server-only — never imported from client components.
 */
import { getSupabaseServerAuth } from "./supabase/server";

export interface AuthUser {
  id: string;
  phone?: string;
}

export async function getAuthUser(): Promise<AuthUser | null> {
  try {
    const supabase = await getSupabaseServerAuth();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;
    return {
      id: user.id,
      phone: (user.phone as string | undefined) ?? undefined,
    };
  } catch {
    // Missing env vars or other init failure — treat as no auth.
    return null;
  }
}
