"use client";

/**
 * AIDocUpsellGate — when AI summary is unavailable (failed, gated, or
 * over budget), offer the ₹499 add-on that unlocks it.
 *
 * Plan §3.1 V1: the upsell must be live from day one. PM review:
 * monetise immediately, do not block on the report.
 */

import { useState } from "react";

type Props = {
  reportId: string;
  docType: "igr_ec" | "bhulekh_back";
  reason?: string;
  onRetry?: () => void;
  onReset?: () => void;
};

const UPSELL_AMOUNT_PAISE = 49900; // ₹499

function ensureRazorpayScript(): Promise<boolean> {
  if (typeof window === "undefined") return Promise.resolve(false);
  const w = window as unknown as Record<string, any>;
  if (w.Razorpay) return Promise.resolve(true);
  return new Promise((resolve) => {
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.onload = () => resolve(!!w.Razorpay);
    s.onerror = () => resolve(false);
    document.head.appendChild(s);
  });
}

export function AIDocUpsellGate({ reportId, docType, reason, onRetry, onReset }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleUpsell = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/order/ai-doc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reportId, docType, amount: UPSELL_AMOUNT_PAISE }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      const body = (await res.json()) as {
        orderId: string;
        amount: number;
        currency: string;
        receipt?: string;
      };

      // Open Razorpay using the same window-pattern as
      // BhulekhInputForm.tsx. We re-load the script on demand.
      await ensureRazorpayScript();
      const Razorpay = (window as unknown as Record<string, any>).Razorpay as
        | undefined
        | {
            new (options: Record<string, unknown>): {
              open: () => void;
              on: (event: string, handler: (response: { error?: { description: string } }) => void) => void;
            };
          };
      if (!Razorpay) throw new Error("Razorpay not available");

      const rzp = new Razorpay({
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID ?? "",
        amount: String(body.amount),
        currency: body.currency,
        name: "ClearDeed",
        description: "AI document summary",
        order_id: body.orderId,
        modal: { ondismiss: () => setLoading(false) },
        handler: () => onRetry?.(),
      });
      rzp.open();
    } catch (err: any) {
      setError(err?.message ?? "Could not start checkout");
      setLoading(false);
    }
  };

  return (
    <section
      aria-label="AI summary upsell"
      data-state="upsell"
      className="ai-doc-upsell"
    >
      <h3>AI summary unavailable right now</h3>
      {reason && <p className="ai-doc-upsell-reason">Reason: {reason}</p>}
      <p>
        Unlock a plain-English explanation of this document, with every fact
        tied to the source text. ₹499 per document.
      </p>
      <div className="ai-doc-upsell-actions">
        <button
          type="button"
          onClick={handleUpsell}
          disabled={loading}
          className="ai-doc-upsell-cta"
        >
          {loading ? "Loading…" : "Unlock for ₹499"}
        </button>
        {onRetry && (
          <button type="button" onClick={onRetry} className="ai-doc-upsell-retry">
            Try again (free)
          </button>
        )}
        {onReset && (
          <button type="button" onClick={onReset} className="ai-doc-upsell-reset">
            Reset
          </button>
        )}
      </div>
      {error && <p className="ai-doc-upsell-error">{error}</p>}
      <small>One-time payment · Razorpay secured · 7-day refund window</small>
    </section>
  );
}
