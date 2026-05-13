"use client";

import { FormEvent, useState } from "react";

type SubmitState = "idle" | "submitting" | "success" | "error";

export function LeadRequestForm() {
  const [state, setState] = useState<SubmitState>("idle");
  const [message, setMessage] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState("submitting");
    setMessage("");

    const form = event.currentTarget;
    const formData = new FormData(form);
    const payload = Object.fromEntries(formData.entries());

    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Request failed");

      form.reset();
      setState("success");
      setMessage("Request received. We will review the plot details and follow up on WhatsApp.");
    } catch (err) {
      setState("error");
      setMessage(err instanceof Error ? err.message : "Something went wrong.");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-4 rounded border border-[#d8dbd2] bg-white p-5 shadow-sm">
      <div className="grid gap-2">
        <label className="text-sm font-semibold text-[#1f3329]" htmlFor="buyerName">
          Your name
        </label>
        <input
          id="buyerName"
          name="buyerName"
          required
          autoComplete="name"
          className="h-11 rounded border border-[#c6cbc0] px-3 text-base outline-none focus:border-[#1d6f5b]"
        />
      </div>

      <div className="grid gap-2">
        <label className="text-sm font-semibold text-[#1f3329]" htmlFor="phone">
          WhatsApp number
        </label>
        <input
          id="phone"
          name="phone"
          required
          autoComplete="tel"
          className="h-11 rounded border border-[#c6cbc0] px-3 text-base outline-none focus:border-[#1d6f5b]"
        />
      </div>

      <div className="grid gap-2">
        <label className="text-sm font-semibold text-[#1f3329]" htmlFor="userType">
          I am checking this as
        </label>
        <select
          id="userType"
          name="userType"
          className="h-11 rounded border border-[#c6cbc0] bg-white px-3 text-base outline-none focus:border-[#1d6f5b]"
          defaultValue="buyer"
        >
          <option value="buyer">Buyer</option>
          <option value="seller">Seller</option>
          <option value="broker">Broker or builder</option>
          <option value="lawyer">Lawyer helping a client</option>
        </select>
      </div>

      <div className="grid gap-2">
        <label className="text-sm font-semibold text-[#1f3329]" htmlFor="locationText">
          Plot location or Google Maps link
        </label>
        <input
          id="locationText"
          name="locationText"
          placeholder="Khordha / Bhubaneswar area, GPS, or map link"
          className="h-11 rounded border border-[#c6cbc0] px-3 text-base outline-none focus:border-[#1d6f5b]"
        />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="grid gap-2">
          <label className="text-sm font-semibold text-[#1f3329]" htmlFor="claimedOwnerName">
            Seller name
          </label>
          <input
            id="claimedOwnerName"
            name="claimedOwnerName"
            className="h-11 rounded border border-[#c6cbc0] px-3 text-base outline-none focus:border-[#1d6f5b]"
          />
        </div>
        <div className="grid gap-2">
          <label className="text-sm font-semibold text-[#1f3329]" htmlFor="plotDescription">
            Plot or khata details
          </label>
          <input
            id="plotDescription"
            name="plotDescription"
            placeholder="Optional"
            className="h-11 rounded border border-[#c6cbc0] px-3 text-base outline-none focus:border-[#1d6f5b]"
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={state === "submitting"}
        className="h-11 rounded bg-[#1d6f5b] px-4 text-base font-semibold text-white transition hover:bg-[#155443] disabled:cursor-not-allowed disabled:bg-[#93a69d]"
      >
        {state === "submitting" ? "Sending request..." : "Request a reviewed report"}
      </button>

      {message ? (
        <p
          className={
            state === "success"
              ? "text-sm font-medium text-[#1d6f5b]"
              : "text-sm font-medium text-[#9a3412]"
          }
        >
          {message}
        </p>
      ) : null}
    </form>
  );
}
