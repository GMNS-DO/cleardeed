"use client";

import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { KHRDHA_TEHSIL_OPTIONS } from "@/lib/khordha-location";
import { fetchVillages, searchVillages, type Village } from "@/lib/villages";
import { createRazorpayOrder } from "@/lib/payment";
import { MapboxBoundaryMap } from "@/components/MapboxBoundaryMap";
import { getSupabaseBrowserAuth } from "@/lib/supabase/browser";

type SearchMode = "Plot" | "Khatiyan" | "Tenant";
type FormState = "form" | "ordering" | "paying" | "generating" | "success" | "error";

interface FormData {
  tehsilValue: string;
  village: string;
  villageCode: string;
  searchMode: SearchMode;
  identifier: string;
  sellerName: string;
  whatsapp: string;
  email: string;
  tier: "standard" | "verified" | "guaranteed";
}

const RAZORPAY_KEY_ID = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID ?? "";
const CHECKOUT_DRAFT_KEY = "cleardeed:checkout-draft:v1";
const CHECKOUT_DRAFT_MAX_AGE_MS = 30 * 60 * 1000;

const TEHSIL_OPTIONS = KHRDHA_TEHSIL_OPTIONS.map((t) => ({
  value: t.bhulekh_value,
  label: `${t.name_en} (${t.name_or})`,
  name_en: t.name_en,
}));

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

function isSearchMode(value: unknown): value is SearchMode {
  return value === "Plot" || value === "Khatiyan" || value === "Tenant";
}

function isTier(value: unknown): value is FormData["tier"] {
  return value === "standard" || value === "verified" || value === "guaranteed";
}

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
  const [reportData, setReportData] = useState<{
    reportId: string; title: string; html: string; emailSent: boolean;
    bhunakshaPolygon?: number[][][] | null;
  } | null>(null);
  const [villageQuery, setVillageQuery] = useState("");
  const [villagesByTahasil, setVillagesByTahasil] = useState<Record<string, Village[]>>({});
  const [villagesDoc, setVillagesDoc] = useState<{ totalVillages: number; tahasilCount: number } | null>(null);
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
    tier: "standard",
  });

  const preGeneratedReportIdRef = useRef<string | null>(null);
  const preGenerationPromiseRef = useRef<Promise<{ reportId: string; bhunakshaPolygon: number[][][] | null; html: string; title: string } | null> | null>(null);

  // Pre-load Razorpay script on mount
  useEffect(() => {
    loadRazorpayScript().then((loaded) => {
      razorpayLoaded.current = loaded;
    });
  }, []);

  // Restore a checkout attempt after the buyer completes phone OTP login.
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(CHECKOUT_DRAFT_KEY);
      if (!raw) return;
      const draft = JSON.parse(raw) as { form?: Partial<FormData>; step?: number; savedAt?: number };
      sessionStorage.removeItem(CHECKOUT_DRAFT_KEY);
      if (!draft.savedAt || Date.now() - draft.savedAt > CHECKOUT_DRAFT_MAX_AGE_MS || !draft.form) return;
      const draftForm = draft.form;
      setForm((current) => ({
        ...current,
        tehsilValue: typeof draftForm.tehsilValue === "string" ? draftForm.tehsilValue : current.tehsilValue,
        village: typeof draftForm.village === "string" ? draftForm.village : current.village,
        villageCode: typeof draftForm.villageCode === "string" ? draftForm.villageCode : current.villageCode,
        searchMode: isSearchMode(draftForm.searchMode) ? draftForm.searchMode : current.searchMode,
        identifier: typeof draftForm.identifier === "string" ? draftForm.identifier : current.identifier,
        sellerName: typeof draftForm.sellerName === "string" ? draftForm.sellerName : current.sellerName,
        whatsapp: typeof draftForm.whatsapp === "string" ? draftForm.whatsapp : current.whatsapp,
        email: typeof draftForm.email === "string" ? draftForm.email : current.email,
        tier: isTier(draftForm.tier) ? draftForm.tier : current.tier,
      }));
      setStep(draft.step === 2 || draft.step === 3 ? draft.step : 1);
      setVillageQuery("");
    } catch {
      sessionStorage.removeItem(CHECKOUT_DRAFT_KEY);
    }
  }, []);

  // Load the village directory once on mount.
  useEffect(() => {
    let cancelled = false;
    fetchVillages()
      .then((doc) => {
        if (cancelled) return;
        const byCode: Record<string, Village[]> = {};
        for (const v of doc.villages) {
          const key = v.bhulekhTahasilCode;
          if (!byCode[key]) byCode[key] = [];
          byCode[key].push(v);
        }
        setVillagesByTahasil(byCode);
        setVillagesDoc({ totalVillages: doc.totalVillages, tahasilCount: doc.tahasilCount });
      })
      .catch((e) => {
        // If the directory fails to load, the village input stays empty.
        // This is a non-fatal UX degradation — the rest of the form
        // (tehsil, search, contact) still works.
        console.warn("[BhulekhInputForm] villages directory failed to load:", e);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const villages = useMemo(() => {
    if (!form.tehsilValue) return [];
    return villagesByTahasil[form.tehsilValue] ?? [];
  }, [form.tehsilValue, villagesByTahasil]);

  const filteredVillages = useMemo(() => {
    return searchVillages(villageQuery, villages, 50);
  }, [villages, villageQuery]);

  const canAdvanceStep2 = Boolean(form.tehsilValue && form.village && form.villageCode);
  const canAdvanceStep3 = Boolean(form.identifier.trim());
  const emailValid = useMemo(() => {
    if (!form.email.trim()) return false;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email);
  }, [form.email]);
  const canCheckout = Boolean(canAdvanceStep3 && emailValid && form.tier);

  const selectedTehsilLabel = useMemo(
    () => TEHSIL_OPTIONS.find((t) => t.value === form.tehsilValue)?.name_en ?? "",
    [form.tehsilValue]
  );

  const handlePay = useCallback(async () => {
    if (!canCheckout || formState === "ordering" || formState === "paying" || formState === "generating") return;

    setErrorMsg(null);

    try {
      const supabase = getSupabaseBrowserAuth();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        sessionStorage.setItem(
          CHECKOUT_DRAFT_KEY,
          JSON.stringify({ form, step, savedAt: Date.now() })
        );
        window.location.href = `/login?next=${encodeURIComponent("/")}`;
        return;
      }
    } catch {
      sessionStorage.setItem(
        CHECKOUT_DRAFT_KEY,
        JSON.stringify({ form, step, savedAt: Date.now() })
      );
      window.location.href = `/login?next=${encodeURIComponent("/")}`;
      return;
    }

    setFormState("ordering");

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
      // Kick off pre-generation in parallel with order creation. This is the
      // 30-60s Bhulekh RoR fetch — it now runs in the background while the
      // user is completing payment, so the Razorpay modal opens within ~1s
      // of clicking "Get report" instead of after the full Bhulekh fetch.
      // If the user pays before pre-gen finishes, the success route will
      // await the in-flight pre-gen. If pre-gen fails, the success route
      // falls back to full regeneration (existing behavior, D-040).
      const preGenerationPromise = fetch("/api/report/pregenerate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tehsil: selectedTehsilLabel,
          tehsilValue: form.tehsilValue,
          village: form.village,
          villageCode: form.villageCode,
          searchMode: form.searchMode,
          identifier: form.identifier,
          claimedOwnerName: form.sellerName || undefined,
          email: form.email,
          tier: form.tier,
        }),
      }).then(async (r) => {
        const data = await r.json() as {
          reportId?: string | null; status?: string; error?: string;
          html?: string; title?: string; bhunakshaPolygon?: number[][][] | null
        };
        if (!r.ok || data.status !== "generated" || !data.reportId) {
          // Even on pregen failure, the server returns a reportId for the persisted DB
          // record. Capture it so the payment-success route can short-circuit and reuse
          // the failure error instead of re-running the entire pipeline.
          const failedReportId = data.reportId ?? null;
          const err = new Error(data.error ?? "Could not fetch Bhulekh RoR for this plot. Please retry.");
          (err as Error & { reportId?: string | null }).reportId = failedReportId;
          throw err;
        }
        console.info("[BhulekhInputForm] Pre-generation response:", data.status, "reportId:", data.reportId, "html length:", data.html?.length ?? 0);
        return { reportId: data.reportId, bhunakshaPolygon: data.bhunakshaPolygon ?? null, html: data.html ?? "", title: data.title ?? "" };
      });
      preGenerationPromiseRef.current = preGenerationPromise;

      // Surface the reportId as soon as pre-gen finishes so the success
      // handler can pass it through. We don't await this here.
      // On failure, also capture the persisted reportId from the server's error envelope
      // (if any) so payment-success can reuse the failed-pregen DB record.
      preGenerationPromise
        .then((r) => { preGeneratedReportIdRef.current = r.reportId; })
        .catch((e: Error & { reportId?: string | null }) => {
          if (e?.reportId) preGeneratedReportIdRef.current = e.reportId;
        });

      // Step 1: Create Razorpay order in parallel with pre-gen. This is
      // typically <500ms — the gating step for opening the modal.
      const orderRes = await createRazorpayOrder({
        tier: form.tier,
        email: form.email,
        plotDescription: `${form.village} · ${form.identifier}`,
      });

      // Step 2: Persist checkout session. If pre-gen hasn't finished yet,
      // the preGeneratedReportId field will be null and the success route
      // will fall back to regeneration. We'll patch the session after
      // pre-gen finishes if the user is still in the modal.
      const checkoutPayload = {
        orderId: orderRes.orderId,
        tehsil: selectedTehsilLabel,
        tehsilValue: form.tehsilValue,
        village: form.village,
        villageCode: form.villageCode,
        searchMode: form.searchMode,
        identifier: form.identifier,
        claimedOwnerName: form.sellerName || undefined,
        email: form.email,
        whatsapp: form.whatsapp || undefined,
        tier: form.tier,
        preGeneratedReportId: null, // patched below when pre-gen finishes
        preGeneratedHtml: null,
        preGeneratedTitle: null,
        preGeneratedBhunakshaPolygon: null,
      };
      // T-013: hard auth gate. /api/checkout returns 401 when no session —
      // redirect to /login BEFORE opening the Razorpay modal so the buyer
      // doesn't see a payment flow they can't complete.
      const checkoutRes = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(checkoutPayload),
      });
      if (checkoutRes.status === 401) {
        const data = (await checkoutRes.json().catch(() => ({}))) as { next?: string };
        const next = data.next ?? `/login?next=${encodeURIComponent("/")}`;
        window.location.href = next;
        return;
      }
      if (!checkoutRes.ok) {
        console.warn("[BhulekhInputForm] Checkout session store failed:", checkoutRes.status);
      }

      // When pre-gen finishes, patch the session with the result so the
      // webhook/success route can use the cached HTML (or the persisted
      // failure record, avoiding a second slow-path pipeline run).
      preGenerationPromise
        .then((r) => {
          fetch("/api/checkout", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              ...checkoutPayload,
              preGeneratedReportId: r.reportId,
              preGeneratedHtml: r.html,
              preGeneratedTitle: r.title,
              preGeneratedBhunakshaPolygon: r.bhunakshaPolygon,
            }),
          }).catch(() => {/* already in modal; fall back to regen if needed */});
        })
        .catch((e: Error & { reportId?: string | null }) => {
          const failedReportId = e?.reportId;
          if (!failedReportId) return;
          // Persist the failed-pregen reportId so the webhook/success route
          // can short-circuit and reuse the persisted error.
          fetch("/api/checkout", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              ...checkoutPayload,
              preGeneratedReportId: failedReportId,
            }),
          }).catch(() => {/* already in modal; fall back to regen if needed */});
        });

      // Step 3: Open Razorpay modal — typically within ~1s of click.
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
        amount: orderRes.amount.toString(),
        currency: "INR",
        name: "ClearDeed",
        description: `Property report — ${form.village} · Plot ${form.identifier}`,
        order_id: orderRes.orderId,
        email: form.email,
        prefill: {
          email: form.email,
          contact: form.whatsapp || undefined,
        },
        modal: {
          ondismiss: () => {
            setFormState("form");
          },
        },
        theme: {
          color: "#1d6f5b",
        },
        handler: async (response: { razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string }) => {
          console.info("[BhulekhInputForm] Payment success:", response);
          setFormState("generating");
          try {
            // If pre-gen already finished, use its reportId immediately.
            // Otherwise await it. We bound the wait at 6 minutes — long
            // enough to absorb a Bhulekh portal slowdown, short enough
            // that the buyer doesn't sit on a spinner forever. If the
            // pregen doesn't finish in 6 min, we hand off to the slow
            // path with no preGeneratedReportId and the user gets a
            // clear "your payment succeeded, we're still building the
            // report" message.
            const pregen = preGeneratedReportIdRef.current != null
              ? Promise.resolve({ reportId: preGeneratedReportIdRef.current, bhunakshaPolygon: null as number[][][] | null, html: "", title: "" })
              : Promise.race<{ reportId: string; bhunakshaPolygon: number[][][] | null; html: string; title: string } | null>([
                  preGenerationPromiseRef.current,
                  new Promise<null>((resolve) => setTimeout(() => resolve(null), 6 * 60 * 1000)),
                ]);
            const resolvedPreGenerated = await pregen;
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
                preGeneratedReportId: resolvedPreGenerated?.reportId ?? undefined,
              }),
            });
            const data = await result.json() as {
              reportId?: string;
              reportUrl?: string | null;
              title?: string;
              html?: string;
              emailSent?: boolean;
              error?: string;
              bhunakshaPolygon?: number[][][] | null;
            };
            console.info("[BhulekhInputForm] payment/success bhunakshaPolygon in response:", data.bhunakshaPolygon != null ? `found (${data.bhunakshaPolygon.length} rings)` : "NULL");
            const preGeneratedBhunakshaPolygon = null;
            console.info("[BhulekhInputForm] preGeneratedBhunakshaPolygon from pregen:", preGeneratedBhunakshaPolygon != null ? `found` : "NULL");
            if (!result.ok || data.error) {
              console.warn("[BhulekhInputForm] Payment success handler error:", data.error);
              setErrorMsg(data.error ?? "Report generation failed. Email us at support@cleardeed.in");
              setFormState("error");
              return;
            }
            if (!data.html || !data.html.trim()) {
              console.warn("[BhulekhInputForm] Payment success returned no report HTML. reportId:", data.reportId);
              setErrorMsg("Report generation timed out. Your payment was successful — email us at support@cleardeed.in and we'll deliver your report manually within 2 hours.");
              setFormState("error");
              return;
            }

            if (!data.reportId) {
              setErrorMsg("Payment succeeded, but the report ID was missing. Email us at support@cleardeed.in and we will recover it.");
              setFormState("error");
              return;
            }

            // Redirect to the server-minted report URL so production access
            // tokens are preserved. The fallback is for local/dev only.
            const reportUrl = data.reportUrl || `/report/${encodeURIComponent(data.reportId)}`;
            window.location.href = reportUrl;
          } catch (e) {
            console.warn("[BhulekhInputForm] Payment success callback failed:", e);
            setErrorMsg("Payment succeeded, but report generation did not complete. Email us at support@cleardeed.in and we will recover it.");
            setFormState("error");
            return;
          }
        },
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      rzp.on("payment.failed", ((response: any) => {
        console.error("[BhulekhInputForm] Payment failed:", response.error);
        setErrorMsg(`Payment failed: ${response.error?.description ?? "Please try again."}`);
        setFormState("error");
      }) as any);

      setFormState("paying");
      rzp.open();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Something went wrong. Please try again.";
      setErrorMsg(msg);
      setFormState("error");
    }
  }, [form, step, selectedTehsilLabel, canCheckout, formState]);

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
                <p className="font-semibold text-[#17231d]">Payment successful! Your report is ready.</p>
                <p className="text-xs text-[#5b665f]">
                  {reportData?.emailSent
                    ? <>Shown below and sent to <strong>{form.email}</strong>. Use the download button in the report header for a PDF copy.</>
                    : <>Shown below. Use the download button in the report header for a PDF copy.</>}
                </p>
              </div>
            </div>

            {/* Map — shown above the report if polygon was resolved */}
            {reportData?.bhunakshaPolygon ? (
              <MapboxBoundaryMap
                polygon={reportData.bhunakshaPolygon}
                villageName={form.village}
                plotNo={form.identifier}
              />
            ) : (
              <div className="rounded border border-[#d9ddd4] bg-[#f7f7f2] px-4 py-3 text-sm text-[#5b665f]">
                Plot boundary map is being prepared. It will appear in your emailed copy.
              </div>
            )}

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
                        <li key={`${v.bhulekhVillageCode}-${v.english || v.odia}`}>
                          <button
                            type="button"
                            onClick={() => {
                              setForm((f) => ({
                                ...f,
                                village: v.english || v.odia,
                                villageCode: v.bhulekhVillageCode,
                              }));
                              setVillageQuery("");
                            }}
                            className="w-full px-3 py-2 text-left text-sm hover:bg-[#eef1ea]"
                          >
                            <span className="font-medium">{v.english || v.odia}</span>
                            {v.english && (
                              <span className="ml-2 text-[#5b665f]">{v.odia}</span>
                            )}
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
                {!villageQuery && !form.village && villagesDoc && (
                  <p className="mt-1.5 text-xs text-[#5b665f]">
                    {villagesDoc.totalVillages.toLocaleString("en-IN")} villages ·{" "}
                    {villagesDoc.tahasilCount} tahasils. Type to search.
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
              onChange={(e) => {
                setForm((f) => ({ ...f, identifier: e.target.value }));
              }}
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
              className="flex-1 rounded bg-[#163d33] px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-[#b7c0b6]"
            >
              Continue →
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

          {/* Tier Selection */}
          <div>
            <label className="mb-2 block text-sm font-semibold text-[#17231d]">
              Report type <span className="text-[#c0392b]">*</span>
            </label>
            <div className="flex flex-col gap-2">
              {([
                { key: "standard", label: "Standard", price: "₹699", badge: null },
                { key: "verified", label: "Verified", price: "₹1,999", badge: "Popular" },
                { key: "guaranteed", label: "Guaranteed", price: "₹4,999", badge: "Best value" },
              ] as const).map(({ key, label, price, badge }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, tier: key }))}
                  className={`flex items-center justify-between rounded border px-3 py-2.5 text-left text-sm transition-colors ${
                    form.tier === key
                      ? "border-[#1d6f5b] bg-[#f0f7f4]"
                      : "border-[#d9ddd4] bg-white hover:border-[#1d6f5b] hover:bg-[#f7f7f2]"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <div className={`h-4 w-4 rounded-full border-2 flex items-center justify-center ${
                      form.tier === key ? "border-[#1d6f5b] bg-[#1d6f5b]" : "border-[#d9ddd4]"
                    }`}>
                      {form.tier === key && (
                        <div className="h-1.5 w-1.5 rounded-full bg-white" />
                      )}
                    </div>
                    <div>
                      <span className="font-semibold text-[#17231d]">{label}</span>
                      {badge && (
                        <span className={`ml-2 rounded px-1.5 py-0.5 text-xs font-medium ${
                          key === "verified"
                            ? "bg-[#1d6f5b] text-white"
                            : "bg-[#8a5f1d] text-white"
                        }`}>
                          {badge}
                        </span>
                      )}
                    </div>
                  </div>
                  <span className="font-bold text-[#17231d]">{price}</span>
                </button>
              ))}
            </div>
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
                : "Get report"}
            </button>
          </div>

          <p className="text-center text-xs text-[#5b665f]">
            ₹1 for the full report. Shown here after payment and emailed to <strong>{form.email || "your email"}</strong>.
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
