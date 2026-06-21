"use client";

/**
 * Two-step phone-OTP login form.
 *
 * Step 1: 10-digit phone input (Indian default, +91 prefix).
 * Step 2: 6-digit OTP input. Auto-advance, paste, backspace.
 *
 * Status messages announce via aria-live="polite" for screen readers.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { parsePhoneNumberFromString } from "libphonenumber-js";
import { getSupabaseBrowserAuth } from "@/lib/supabase/browser";

const RESEND_COOLDOWN_S = 30;
const OTP_LENGTH = 6;

type Status =
  | { kind: "idle" }
  | { kind: "sending_code" }
  | { kind: "code_sent"; phone: string; cooldownEndsAt: number }
  | { kind: "verifying" }
  | { kind: "error"; message: string };

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = searchParams.get("next") ?? "/dashboard";

  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [phone, setPhone] = useState("");
  const [otpDigits, setOtpDigits] = useState<string[]>(Array(OTP_LENGTH).fill(""));
  const otpInputRefs = useRef<Array<HTMLInputElement | null>>([]);

  // Cooldown ticker — re-renders every second while waiting.
  const [, setTick] = useState(0);
  useEffect(() => {
    if (status.kind !== "code_sent") return;
    const id = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [status.kind]);

  const cooldownRemaining =
    status.kind === "code_sent"
      ? Math.max(0, Math.ceil((status.cooldownEndsAt - Date.now()) / 1000))
      : 0;

  const handleSendCode = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      const parsed = parsePhoneNumberFromString(phone, "IN");
      if (!parsed || !parsed.isValid()) {
        setStatus({ kind: "error", message: "Enter a valid 10-digit Indian phone number." });
        return;
      }
      const e164 = parsed.number;
      setStatus({ kind: "sending_code" });
      try {
        const supabase = getSupabaseBrowserAuth();
        const { error } = await supabase.auth.signInWithOtp({
          phone: e164,
          options: { channel: "sms" },
        });
        if (error) {
          setStatus({ kind: "error", message: error.message });
          return;
        }
        setStatus({
          kind: "code_sent",
          phone: e164,
          cooldownEndsAt: Date.now() + RESEND_COOLDOWN_S * 1000,
        });
        // Focus the first OTP input.
        setTimeout(() => otpInputRefs.current[0]?.focus(), 50);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Could not send the code.";
        setStatus({ kind: "error", message });
      }
    },
    [phone]
  );

  const handleOtpChange = useCallback(
    (index: number, value: string) => {
      // Allow paste of multi-digit code into a single cell.
      const digits = value.replace(/\D/g, "");
      if (digits.length > 1) {
        const next = Array(OTP_LENGTH).fill("");
        for (let i = 0; i < Math.min(digits.length, OTP_LENGTH); i++) {
          next[i] = digits[i];
        }
        setOtpDigits(next);
        const lastIndex = Math.min(digits.length, OTP_LENGTH) - 1;
        otpInputRefs.current[lastIndex]?.focus();
        return;
      }
      const next = [...otpDigits];
      next[index] = digits;
      setOtpDigits(next);
      if (digits && index < OTP_LENGTH - 1) {
        otpInputRefs.current[index + 1]?.focus();
      }
    },
    [otpDigits]
  );

  const handleOtpKeyDown = useCallback(
    (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Backspace" && !otpDigits[index] && index > 0) {
        otpInputRefs.current[index - 1]?.focus();
      }
    },
    [otpDigits]
  );

  const handleVerify = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (status.kind !== "code_sent") return;
      const token = otpDigits.join("");
      if (token.length !== OTP_LENGTH) {
        setStatus({ kind: "error", message: `Enter all ${OTP_LENGTH} digits.` });
        return;
      }
      setStatus({ kind: "verifying" });
      try {
        const supabase = getSupabaseBrowserAuth();
        const { error } = await supabase.auth.verifyOtp({
          phone: status.phone,
          token,
          type: "sms",
        });
        if (error) {
          setStatus({ kind: "error", message: error.message });
          return;
        }
        router.push(nextPath);
        router.refresh();
      } catch (err) {
        const message = err instanceof Error ? err.message : "Could not verify the code.";
        setStatus({ kind: "error", message });
      }
    },
    [status, otpDigits, router, nextPath]
  );

  const handleChangeNumber = useCallback(() => {
    setOtpDigits(Array(OTP_LENGTH).fill(""));
    setStatus({ kind: "idle" });
  }, []);

  return (
    <div>
      {status.kind === "idle" || status.kind === "sending_code" || status.kind === "error" ? (
        <form onSubmit={handleSendCode} noValidate>
          <label htmlFor="phone" className="block text-sm font-medium text-[#13251e]">
            Phone number
          </label>
          <div className="mt-2 flex rounded border border-[#d9ddd4] focus-within:border-[#1d6f5b] focus-within:ring-1 focus-within:ring-[#1d6f5b]">
            <span className="inline-flex items-center px-3 text-sm text-[#5b665f]">+91</span>
            <input
              id="phone"
              name="phone"
              type="tel"
              inputMode="numeric"
              autoComplete="tel-national"
              maxLength={10}
              pattern="[0-9]{10}"
              value={phone}
              onChange={(e) => {
                setPhone(e.target.value.replace(/\D/g, "").slice(0, 10));
                if (status.kind === "error") setStatus({ kind: "idle" });
              }}
              className="flex-1 bg-transparent py-3 pr-3 text-base outline-none"
              placeholder="98765 43210"
              aria-invalid={status.kind === "error"}
              aria-describedby="phone-status"
              required
            />
          </div>

          <p
            id="phone-status"
            role="status"
            aria-live="polite"
            className={
              status.kind === "error" ? "mt-2 text-sm text-[#9a2a2a]" : "mt-2 text-sm text-[#5b665f]"
            }
          >
            {status.kind === "sending_code"
              ? "Sending code…"
              : status.kind === "error"
                ? status.message
                : "We'll text a 6-digit code to this number."}
          </p>

          <button
            type="submit"
            disabled={status.kind === "sending_code" || phone.length !== 10}
            className="mt-4 w-full rounded bg-[#163d33] px-4 py-3 text-base font-semibold text-white transition hover:bg-[#1d6f5b] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {status.kind === "sending_code" ? "Sending…" : "Send code"}
          </button>
        </form>
      ) : null}

      {(status.kind === "code_sent" || status.kind === "verifying") && (
        <form onSubmit={handleVerify} noValidate>
          <div className="mb-1 flex items-center justify-between">
            <p className="text-sm text-[#5b665f]">
              Code sent to{" "}
              <span className="font-medium text-[#13251e]">
                {status.kind === "code_sent" ? status.phone : ""}
              </span>
            </p>
            <button
              type="button"
              onClick={handleChangeNumber}
              className="text-sm text-[#1d6f5b] hover:underline"
            >
              Change number
            </button>
          </div>
          <p className="mb-4 text-xs text-[#5b665f]">
            Didn't get it? Check that the number above is correct. SMS delivery can take up to a minute.
          </p>

          <label htmlFor="otp-0" className="block text-sm font-medium text-[#13251e]">
            Verification code
          </label>
          <div className="mt-2 flex gap-2" role="group" aria-labelledby="otp-0">
            {otpDigits.map((digit, index) => (
              <input
                key={index}
                ref={(el) => {
                  otpInputRefs.current[index] = el;
                }}
                id={`otp-${index}`}
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={digit}
                onChange={(e) => handleOtpChange(index, e.target.value)}
                onKeyDown={(e) => handleOtpKeyDown(index, e)}
                className="h-12 w-10 rounded border border-[#d9ddd4] text-center text-lg font-semibold text-[#13251e] focus:border-[#1d6f5b] focus:outline-none focus:ring-1 focus:ring-[#1d6f5b]"
                aria-label={`Digit ${index + 1} of ${OTP_LENGTH}`}
                required
              />
            ))}
          </div>

          <p role="status" aria-live="polite" className="mt-3 min-h-[1.25rem] text-sm text-[#5b665f]">
            {status.kind === "verifying"
              ? "Verifying…"
              : cooldownRemaining > 0
                ? `Resend available in ${cooldownRemaining}s.`
                : "Tap verify, or resend below."}
          </p>

          <button
            type="submit"
            disabled={status.kind === "verifying" || otpDigits.join("").length !== OTP_LENGTH}
            className="mt-4 w-full rounded bg-[#163d33] px-4 py-3 text-base font-semibold text-white transition hover:bg-[#1d6f5b] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {status.kind === "verifying" ? "Verifying…" : "Verify and sign in"}
          </button>

          {cooldownRemaining === 0 && status.kind === "code_sent" && (
            <button
              type="button"
              onClick={handleSendCode as unknown as () => void}
              className="mt-3 w-full rounded border border-[#d9ddd4] bg-white px-4 py-2 text-sm font-medium text-[#1d6f5b] transition hover:bg-[#f7f7f2]"
            >
              Resend code
            </button>
          )}
        </form>
      )}

      {status.kind === "error" && (
        <p role="alert" className="mt-3 text-sm text-[#9a2a2a]">
          {status.message}
        </p>
      )}
    </div>
  );
}
