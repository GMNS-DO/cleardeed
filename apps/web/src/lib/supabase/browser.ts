/**
 * ClearDeed — Supabase Auth browser client.
 *
 * Used in Client Components (any "use client" file). Singleton — Supabase
 * recommends reusing the client across the app to avoid stale sessions
 * and unnecessary reconnection.
 *
 * Phone-OTP flow:
 *   const supabase = getSupabaseBrowserAuth();
 *   await supabase.auth.signInWithOtp({ phone: e164, options: { channel: "sms" } });
 *   await supabase.auth.verifyOtp({ phone, token, type: "sms" });
 *   await supabase.auth.signOut();
 */
"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

let _client: SupabaseClient | null = null;

export function getSupabaseBrowserAuth(): SupabaseClient {
  if (_client) return _client;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      "Missing Supabase env vars. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY."
    );
  }

  _client = createBrowserClient(url, anonKey);
  return _client;
}
