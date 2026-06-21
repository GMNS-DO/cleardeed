/**
 * ClearDeed — phone-OTP login.
 *
 * Two-step flow:
 *   1. Enter phone (10-digit Indian number, normalized to +91XXXXXXXXXX E.164)
 *   2. Enter 6-digit OTP sent via SMS (MSG91 through Supabase's custom SMS hook)
 *
 * On success: redirect to ?next=<path> (default: /dashboard).
 *
 * Resend rate-limit: 30s cooldown (Supabase's hard limit is 4 OTPs/hour/phone).
 *
 * Accessibility: every status change announces via aria-live="polite". OTP
 * inputs support auto-advance on digit, paste, and backspace.
 */
import { Suspense } from "react";
import { LoginForm } from "./LoginForm";

export const metadata = {
  title: "Sign in — ClearDeed",
  description: "Sign in to ClearDeed with your phone number to view your property reports.",
};

export const dynamic = "force-dynamic";

export default function LoginPage() {
  return (
    <main className="min-h-screen bg-[#f7f7f2] px-5 py-8 text-[#17231d] md:px-8">
      <div className="mx-auto max-w-md">
        <div className="mb-6 flex items-center justify-between">
          <a href="/" className="text-xl font-bold text-[#163d33]">
            ClearDeed
          </a>
          <a href="/" className="text-sm text-[#1d6f5b] hover:underline">
            ← Back to site
          </a>
        </div>

        <div className="rounded border border-[#d9ddd4] bg-white p-6 md:p-8">
          <header className="mb-6">
            <h1 className="text-2xl font-bold text-[#13251e]">Sign in</h1>
            <p className="mt-2 text-sm text-[#5b665f]">
              Enter your phone number. We'll send a one-time code to verify it's you.
            </p>
          </header>

          <Suspense
            fallback={
              <p className="text-sm text-[#5b665f]" role="status">
                Loading…
              </p>
            }
          >
            <LoginForm />
          </Suspense>
        </div>

        <p className="mt-6 text-center text-xs text-[#5b665f]">
          By signing in, you agree to our{" "}
          <a href="/terms" className="underline hover:text-[#1d6f5b]">
            Terms
          </a>{" "}
          and{" "}
          <a href="/privacy" className="underline hover:text-[#1d6f5b]">
            Privacy Policy
          </a>
          . Your phone number is your identity; we never share it.
        </p>
      </div>
    </main>
  );
}
