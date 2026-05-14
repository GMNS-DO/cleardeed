"use client";

import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { KHRDHA_TEHSIL_OPTIONS } from "@/lib/khordha-location";
import { createRazorpayOrder } from "@/lib/payment";

type SearchMode = "Plot" | "Khatiyan" | "Tenant";
type FormState = "form" | "ordering" | "paying" | "generating" | "success" | "error";

interface VillageOption {
  name_en: string;
  name_or: string;
  bhulekhVillageCode: string;
  nameEnAlternates: string[];
  nameOrAlternates: string[];
}

interface FormData {
  tehsilValue: string;
  village: string;
  villageCode: string;
  searchMode: SearchMode;
  identifier: string;
  sellerName: string;
  whatsapp: string;
  email: string;
}

const RAZORPAY_KEY_ID = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID ?? "";

const TEHSIL_OPTIONS = KHRDHA_TEHSIL_OPTIONS.map((t) => ({
  value: t.bhulekh_value,
  label: `${t.name_en} (${t.name_or})`,
  name_en: t.name_en,
}));

function getVillages(tehsilBhulekhValue: string): VillageOption[] {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tehsil = (KHRDHA_TEHSIL_OPTIONS as unknown as any[]).find(
    (t: { bhulekh_value: string }) => t.bhulekh_value === tehsilBhulekhValue
  );
  if (!tehsil) return [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (tehsil.riCircles as any).flatMap((ri: { villages: VillageOption[] }) => ri.villages);
}

const SEARCH_LABELS: Record<SearchMode, string> = {
  Plot: "Plot number",
  Khatiyan: "Khatiyan number",
  Tenant: "Tenant name",
};

const SEARCH_PLACEHOLDERS: Record<SearchMode, string> = {
  Plot: "e.g. 1, 128, 415",
  Khatiyan: "e.g. 830, 345/1391",
  Tenant: "e.g. Lakshmi Sahu",
};

const SEARCH_HINTS: Record<SearchMode, string> = {
  Plot: "Plot number from broker documents or Bhunaksha map",
  Khatiyan: "Khatiyan/khata number from RoR or mutation records",
  Tenant: "Tenant name as it appears in Bhulekh RoR records",
};

// Load Razorpay script dynamically
function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if ((window as unknown as Record<string, any>).Razorpay) {
      resolve(true);
      return;
    }
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.head.appendChild(script);
  });
}

export function BhulekhInputForm() {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [formState, setFormState] = useState<FormState>("form");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [reportData, setReportData] = useState<{ reportId: string; title: string; html: string; emailSent: boolean } | null>(null);
  const [villageQuery, setVillageQuery] = useState("");
  const razorpayLoaded = useRef(false);

  const [form, setForm] = useState<FormData>({
    tehsilValue: "",
    village: "",
    villageCode: "",
    searchMode: "Plot",
    identifier: "",
    sellerName: "",
    whatsapp: "",
    email: "",
  });

  // Pre-load Razorpay script on mount
  useEffect(() => {
    loadRazorpayScript().then((loaded) => {
      razorpayLoaded.current = loaded;
    });
  }, []);

  const villages = useMemo(() => {
    if (!form.tehsilValue) return [];
    return getVillages(form.tehsilValue);
  }, [form.tehsilValue]);

  const filteredVillages = useMemo(() => {
    if (!villageQuery.trim()) return villages.slice(0, 50);
    const q = villageQuery.toLowerCase();
    return villages
      .filter(
        (v) =>
          v.name_en.toLowerCase().includes(q) ||
          v.name_or.includes(villageQuery) ||
          v.nameEnAlternates.some((a: string) => a.toLowerCase().includes(q)) ||
          v.nameOrAlternates.some((a: string) => a.includes(villageQuery))
      )
      .slice(0, 50);
  }, [villages, villageQuery]);

  const canAdvanceStep2 = Boolean(form.tehsilValue && form.village && form.villageCode);
  const canAdvanceStep3 = Boolean(form.identifier.trim());
  const emailValid = useMemo(() => {
    if (!form.email.trim()) return false;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email);
  }, [form.email]);
  const canCheckout = Boolean(canAdvanceStep3 && emailValid);

  const selectedTehsilLabel = useMemo(
    () => TEHSIL_OPTIONS.find((t) => t.value === form.tehsilValue)?.name_en ?? "",
    [form.tehsilValue]
  );

  const handlePay = useCallback(async () => {
    if (!canCheckout || formState === "ordering" || formState === "paying" || formState === "generating") return;

    setFormState("ordering");
    setErrorMsg(null);

    // Ensure Razorpay script is loaded
    if (!razorpayLoaded.current) {
      const loaded = await loadRazorpayScript();
      if (!loaded) {
        setErrorMsg("Could not load payment system. Please refresh and try again.");
        setFormState("error");
        return;
      }
    }

    try {
      // Step 1: Create order
      const orderRes = await createRazorpayOrder({
        email: form.email,
        plotDescription: `${form.village} · ${form.identifier}`,
      });

      // Step 3: Open Razorpay modal
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const Razorpay = (window as unknown as Record<string, any>).Razorpay as {
        new (options: Record<string, unknown>): {
          open: () => void;
          on: (event: string, handler: (response: { error?: { description: string } }) => void) => void;
        };
      } | undefined;

      if (!Razorpay) {
        throw new Error("Razorpay not available");
      }

      const rzp = new Razorpay({
        key: RAZORPAY_KEY_ID,
        amount: "100", // ₹1 in paise
        currency: "INR",
        name: "ClearDeed",
        description: `Property report — ${form.village} · Plot ${form.identifier}`,
        order_id: orderRes.orderId,
        email: form.email,
        prefill: {
          email: form.email,
          contact: form.whatsapp || undefined,
        },
        theme: {
          color: "#1d6f5b",
        },
        handler: async (response: { razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string }) => {
          console.info("[BhulekhInputForm] Payment success:", response);
          // Generate report and send email via client-side callback
          setFormState("generating");
          try {
            const result = await fetch("/api/payment/success", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                tehsil: selectedTehsilLabel,
                tehsilValue: form.tehsilValue,
                village: form.village,
                villageCode: form.villageCode,
                searchMode: form.searchMode,
                identifier: form.identifier,
                claimedOwnerName: form.sellerName || undefined,
                email: form.email,
                whatsapp: form.whatsapp || undefined,
              }),
            });
            const data = await result.json() as { reportId?: string; title?: string; html?: string; emailSent?: boolean; error?: string };
            if (!result.ok || data.error) {
              console.warn("[BhulekhInputForm] Payment success handler error:", data.error);
              setErrorMsg(data.error ?? "Report generation failed. Email us at support@cleardeed.in");
              setFormState("error");
              return;
            }
            setReportData({ reportId: data.reportId ?? "", title: data.title ?? "", html: data.html ?? "", emailSent: data.emailSent ?? false });
          } catch (e) {
            console.warn("[BhulekhInputForm] Payment success callback failed:", e);
          }
          setFormState("success");
        },
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      rzp.on("payment.failed", ((response: any) => {
        console.error("[BhulekhInputForm] Payment failed:", response.error);
        setErrorMsg(`Payment failed: ${response.error?.description ?? "Please try again."}`);
        setFormState("error");
      }) as any);

      rzp.open();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Something went wrong. Please try again.";
      setErrorMsg(msg);
      setFormState("error");
    }
  }, [form, selectedTehsilLabel, canCheckout, formState]);

  // ── Success / Report state ───────────────────────────────────────────────
  if (formState === "success" || formState === "generating") {
    return (
      <div className="flex flex-col gap-4">
        {formState === "generating" ? (
          <div className="flex items-center gap-3 rounded border border-[#e8efe9] bg-[#f7f7f2] px-4 py-4 text-sm">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 border-[#1d6f5b] border-t-transparent animate-spin text-[#1d6f5b] text-xs font-bold">↻</div>
            <div>
              <p className="font-semibold text-[#17231d]">Generating your report…</p>
              <p className="text-xs text-[#5b665f]">This takes up to 60 seconds. Please wait.</p>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-3 rounded border border-[#e8efe9] bg-[#f7f7f2] px-4 py-4 text-sm">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#1d6f5b] text-white text-base font-bold">✓</div>
              <div>
                <p className="font-semibold text-[#17231d]">Payment successful! Report generated.</p>
                <p className="text-xs text-[#5b665f]">
                  {reportData?.emailSent
                    ? <>Sent to <strong>{form.email}</strong>. Check your inbox (and spam).</>
                    : <>Report generated. Save or screenshot this page.</>}
                </p>
              </div>
            </div>
            {reportData?.html && (
              <div dangerouslySetInnerHTML={{ __html: reportData.html }} />
            )}
          </>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Step dots */}
      <div className="flex items-center gap-2 text-sm">
        {([1, 2, 3] as const).map((s, i) => (
          <div key={s} className="flex items-center gap-1.5">
            <div
              className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                step >= s ? "bg-[#1d6f5b] text-white" : "bg-[#eef1ea] text-[#5b665f]"
              }`}
            >
              {s}
            </div>
            <span className={step >= s ? "text-[#1d6f5b]" : "text-[#5b665f]"}>
              {s === 1 ? "Location" : s === 2 ? "Search" : "Contact"}
            </span>
            {i < 2 && (
              <div className={`h-px w-6 ${step > s ? "bg-[#1d6f5b]" : "bg-[#d9ddd4]"}`} />
            )}
          </div>
        ))}
      </div>

      {/* Step 1: Location */}
      {step === 1 && (
        <div className="flex flex-col gap-4">
          <div>
            <label className="mb-1 block text-sm font-semibold text-[#17231d]">District</label>
            <div className="rounded border border-[#d9ddd4] bg-[#f7f7f2] px-3 py-2 text-sm text-[#5b665f]">
              Khordha (ଖୋର୍ଦ୍ଧା)
            </div>
          </div>

          <div>
            <label htmlFor="tehsil" className="mb-1 block text-sm font-semibold text-[#17231d]">
              Tehsil <span className="text-[#c0392b]">*</span>
            </label>
            <select
              id="tehsil"
              value={form.tehsilValue}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  tehsilValue: e.target.value,
                  village: "",
                  villageCode: "",
                }))
              }
              className="w-full rounded border border-[#d9ddd4] px-3 py-2 text-sm focus:border-[#1d6f5b] focus:outline-none"
            >
              <option value="">Select Tehsil</option>
              {TEHSIL_OPTIONS.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="village-search" className="mb-1 block text-sm font-semibold text-[#17231d]">
              Village <span className="text-[#c0392b]">*</span>
            </label>
            {form.tehsilValue ? (
              <div className="relative">
                <input
                  id="village-search"
                  type="text"
                  value={villageQuery || form.village}
                  onChange={(e) => {
                    setVillageQuery(e.target.value);
                    if (form.village) {
                      setForm((f) => ({ ...f, village: "", villageCode: "" }));
                    }
                  }}
                  onFocus={() => {
                    if (form.village) {
                      setVillageQuery("");
                      setForm((f) => ({ ...f, village: "", villageCode: "" }));
                    }
                  }}
                  placeholder="Type to search villages..."
                  className="w-full rounded border border-[#d9ddd4] px-3 py-2 text-sm focus:border-[#1d6f5b] focus:outline-none"
                />
                {villageQuery && (
                  <ul className="absolute z-10 mt-1 max-h-48 w-full overflow-y-auto rounded border border-[#d9ddd4] bg-white shadow-md">
                    {filteredVillages.length > 0 ? (
                      filteredVillages.map((v) => (
                        <li key={`${v.bhulekhVillageCode}-${v.name_en}`}>
                          <button
                            type="button"
                            onClick={() => {
                              setForm((f) => ({
                                ...f,
                                village: v.name_en,
                                villageCode: v.bhulekhVillageCode,
                              }));
                              setVillageQuery("");
                            }}
                            className="w-full px-3 py-2 text-left text-sm hover:bg-[#eef1ea]"
                          >
                            <span className="font-medium">{v.name_en}</span>
                            <span className="ml-2 text-[#5b665f]">{v.name_or}</span>
                          </button>
                        </li>
                      ))
                    ) : (
                      <li className="px-3 py-2 text-sm text-[#5b665f]">
                        No villages found. Try a different spelling.
                      </li>
                    )}
                  </ul>
                )}
                {form.village && !villageQuery && (
                  <p className="mt-1.5 text-xs text-[#5b665f]">
                    Selected: <strong className="text-[#17231d]">{form.village}</strong>{" "}
                    <span className="text-[#8a5f1d]">code {form.villageCode}</span>
                    <button
                      type="button"
                      onClick={() =>
                        setForm((f) => ({ ...f, village: "", villageCode: "" }))
                      }
                      className="ml-2 text-[#1d6f5b] underline"
                    >
                      Change
                    </button>
                  </p>
                )}
              </div>
            ) : (
              <p className="rounded border border-[#e8efe9] bg-[#f7f7f2] px-3 py-2 text-sm text-[#5b665f]">
                Select a tehsil first
              </p>
            )}
          </div>

          <button
            type="button"
            disabled={!canAdvanceStep2}
            onClick={() => setStep(2)}
            className="w-full rounded bg-[#1d6f5b] px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-[#b7c0b6]"
          >
            Continue to search details →
          </button>
        </div>
      )}

      {/* Step 2: Search */}
      {step === 2 && (
        <div className="flex flex-col gap-4">
          <div className="rounded border border-[#e8efe9] bg-[#f7f7f2] px-3 py-2 text-xs text-[#5b665f]">
            {selectedTehsilLabel} / <strong className="text-[#17231d]">{form.village}</strong>
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-[#17231d]">
              Search by <span className="text-[#c0392b]">*</span>
            </label>
            <div className="flex rounded border border-[#d9ddd4]">
              {(["Plot", "Khatiyan", "Tenant"] as SearchMode[]).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() =>
                    setForm((f) => ({ ...f, searchMode: mode, identifier: "" }))
                  }
                  className={`flex-1 px-3 py-2 text-xs font-medium transition-colors ${
                    form.searchMode === mode
                      ? "bg-[#1d6f5b] text-white"
                      : "bg-white text-[#5b665f] hover:bg-[#eef1ea]"
                  }`}
                >
                  {SEARCH_LABELS[mode]}
                </button>
              ))}
            </div>
            <p className="mt-1.5 text-xs text-[#5b665f]">
              {SEARCH_HINTS[form.searchMode]}
            </p>
          </div>

          <div>
            <label htmlFor="identifier" className="mb-1 block text-sm font-semibold text-[#17231d]">
              {SEARCH_LABELS[form.searchMode]} <span className="text-[#c0392b]">*</span>
            </label>
            <input
              id="identifier"
              type="text"
              value={form.identifier}
              onChange={(e) =>
                setForm((f) => ({ ...f, identifier: e.target.value }))
              }
              placeholder={SEARCH_PLACEHOLDERS[form.searchMode]}
              className="w-full rounded border border-[#d9ddd4] px-3 py-2 text-sm focus:border-[#1d6f5b] focus:outline-none"
            />
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="flex-1 rounded border border-[#d9ddd4] px-4 py-2.5 text-sm font-semibold text-[#5b665f] hover:bg-[#f7f7f2]"
            >
              ← Back
            </button>
            <button
              type="button"
              disabled={!canAdvanceStep3}
              onClick={() => setStep(3)}
              className="flex-1 rounded bg-[#1d6f5b] px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-[#b7c0b6]"
            >
              Continue to payment →
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Contact + Payment */}
      {step === 3 && (
        <div className="flex flex-col gap-4">
          <div className="rounded border border-[#e8efe9] bg-[#f7f7f2] px-3 py-2 text-xs text-[#5b665f]">
            {selectedTehsilLabel} / <strong className="text-[#17231d]">{form.village}</strong> ·{" "}
            {SEARCH_LABELS[form.searchMode]}{" "}
            <strong className="text-[#17231d]">{form.identifier}</strong>
          </div>

          <div>
            <label htmlFor="email" className="mb-1 block text-sm font-semibold text-[#17231d]">
              Email <span className="text-[#c0392b]">*</span>
              <span className="ml-1 font-normal text-[#5b665f]">(for report delivery)</span>
            </label>
            <input
              id="email"
              type="email"
              value={form.email}
              onChange={(e) =>
                setForm((f) => ({ ...f, email: e.target.value }))
              }
              placeholder="buyer@email.com"
              className="w-full rounded border border-[#d9ddd4] px-3 py-2 text-sm focus:border-[#1d6f5b] focus:outline-none"
            />
            {form.email && !emailValid && (
              <p className="mt-1 text-xs text-[#c0392b]">Enter a valid email address</p>
            )}
          </div>

          <div>
            <label htmlFor="sellerName" className="mb-1 block text-sm font-semibold text-[#17231d]">
              Seller name{" "}
              <span className="font-normal text-[#5b665f]">(optional)</span>
            </label>
            <input
              id="sellerName"
              type="text"
              value={form.sellerName}
              onChange={(e) =>
                setForm((f) => ({ ...f, sellerName: e.target.value }))
              }
              placeholder="Name from broker note or agreement"
              className="w-full rounded border border-[#d9ddd4] px-3 py-2 text-sm focus:border-[#1d6f5b] focus:outline-none"
            />
          </div>

          <div>
            <label htmlFor="whatsapp" className="mb-1 block text-sm font-semibold text-[#17231d]">
              WhatsApp <span className="font-normal text-[#5b665f]">(optional)</span>
            </label>
            <input
              id="whatsapp"
              type="tel"
              value={form.whatsapp}
              onChange={(e) =>
                setForm((f) => ({ ...f, whatsapp: e.target.value }))
              }
              placeholder="+91 98765 43210"
              className="w-full rounded border border-[#d9ddd4] px-3 py-2 text-sm focus:border-[#1d6f5b] focus:outline-none"
            />
          </div>

          {errorMsg && (
            <div className="rounded border border-[#e8a29a] bg-[#fff0ee] px-3 py-2 text-sm text-[#8d2118]">
              {errorMsg}
            </div>
          )}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setStep(2)}
              disabled={["ordering", "paying", "generating"].includes(formState as string)}
              className="flex-1 rounded border border-[#d9ddd4] px-4 py-2.5 text-sm font-semibold text-[#5b665f] hover:bg-[#f7f7f2] disabled:opacity-50"
            >
              ← Back
            </button>
            <button
              type="button"
              disabled={!canCheckout || ["ordering", "paying", "generating"].includes(formState as string)}
              onClick={handlePay}
              className="flex-1 rounded bg-[#163d33] px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-[#b7c0b6]"
            >
              {(formState as string) === "ordering"
                ? "Preparing..."
                : ["paying", "generating"].includes(formState as string)
                ? "Opening payment..."
                : "Pay ₹1 → Get Report"}
            </button>
          </div>

          <p className="text-center text-xs text-[#5b665f]">
            ₹1 for the full report. Delivered to <strong>{form.email || "your email"}</strong> by email after payment.
          </p>

          <div className="flex items-center justify-center gap-2">
            <svg className="h-4 w-4 text-[#5b665f]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            <span className="text-xs text-[#5b665f]">Secured by Razorpay</span>
          </div>
        </div>
      )}
    </div>
  );
}