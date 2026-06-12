"use client";

/**
 * Client component for the "Pay ₹299 to refresh" button.
 *
 * - Asks the server to mint a Razorpay order via POST /api/reports/:id/refresh
 * - Loads Razorpay's checkout.js (idempotent — caches via window.Razorpay)
 * - Opens the Razorpay modal; on payment success the webhook bumps expires_at
 *   and a hard reload re-renders the (now-valid) cached report.
 *
 * Server-side expiry check + cache reuse is handled by the parent server page.
 */

import { useState, useEffect } from "react";

const REFRESH_PRICE_INR = 299;
const REFRESH_AMOUNT_PAISE = REFRESH_PRICE_INR * 100; // 29900

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open: () => void };
  }
}

function ensureRazorpayScript(): Promise<boolean> {
  if (typeof window === "undefined") return Promise.resolve(false);
  if (window.Razorpay) return Promise.resolve(true);
  return new Promise((resolve) => {
    const existing = document.querySelector(
      'script[src="https://checkout.razorpay.com/v1/checkout.js"]'
    );
    if (existing) {
      existing.addEventListener("load", () => resolve(Boolean(window.Razorpay)));
      existing.addEventListener("error", () => resolve(false));
      return;
    }
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => resolve(Boolean(window.Razorpay));
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

export default function RefreshButtonClient({
  reportId,
  refreshUrl,
}: {
  reportId: string;
  refreshUrl: string;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Preload Razorpay on idle so the click is instant.
    void ensureRazorpayScript();
  }, []);

  const handleClick = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(refreshUrl, { method: "POST" });
      const body = (await res.json()) as { orderId?: string; error?: string };
      if (!res.ok) throw new Error(body.error ?? "Could not create refresh order");
      if (!body.orderId) throw new Error("No order ID returned");

      const ready = await ensureRazorpayScript();
      if (!ready || !window.Razorpay) {
        throw new Error("Razorpay checkout failed to load");
      }

      const checkout = new window.Razorpay({
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID ?? process.env.RAZORPAY_KEY_ID,
        order_id: body.orderId,
        amount: REFRESH_AMOUNT_PAISE,
        currency: "INR",
        name: "ClearDeed",
        description: `Refresh report ${reportId} — +60 days access`,
        handler: () => {
          // The webhook will have bumped expires_at. Reload to see the report.
          window.location.reload();
        },
        modal: {
          ondismiss: () => setLoading(false),
        },
      });
      checkout.open();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setLoading(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        data-testid="refresh-button"
        data-report-id={reportId}
        data-amount-inr={REFRESH_PRICE_INR}
        style={{
          display: "inline-block",
          width: "100%",
          padding: "14px 20px",
          background: "#17231d",
          color: "#fff",
          border: "none",
          borderRadius: "4px",
          fontSize: "16px",
          fontWeight: 600,
          cursor: loading ? "wait" : "pointer",
          opacity: loading ? 0.7 : 1,
        }}
      >
        {loading ? "Processing..." : `Pay ₹${REFRESH_PRICE_INR} to refresh`}
      </button>
      {error ? (
        <p style={{ color: "#c00", fontSize: "13px", marginTop: "8px" }}>{error}</p>
      ) : null}
    </>
  );
}
