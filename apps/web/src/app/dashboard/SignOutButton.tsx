"use client";

import { useState } from "react";
import { getSupabaseBrowserAuth } from "@/lib/supabase/browser";

export function SignOutButton() {
  const [busy, setBusy] = useState(false);

  async function handleSignOut() {
    setBusy(true);
    try {
      const supabase = getSupabaseBrowserAuth();
      await supabase.auth.signOut();
      // Use a hard navigation so the Server Component re-runs without auth.
      window.location.href = "/";
    } catch {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleSignOut}
      disabled={busy}
      className="rounded border border-stone-300 bg-white px-3 py-1.5 text-xs font-semibold text-stone-700 hover:bg-[#f7f7f2] disabled:opacity-60"
    >
      {busy ? "Signing out…" : "Sign out"}
    </button>
  );
}