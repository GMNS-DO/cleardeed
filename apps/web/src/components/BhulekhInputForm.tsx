"use client";

import { useState, useCallback, useMemo } from "react";
import { KHRDHA_TEHSIL_OPTIONS } from "@/lib/khordha-location";

type SearchMode = "Plot" | "Khatiyan" | "Tenant";
type FormState = "form" | "submitting" | "success" | "error";

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

export function BhulekhInputForm() {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [formState, setFormState] = useState<FormState>("form");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [reportId, setReportId] = useState<string | null>(null);
  const [reportHtml, setReportHtml] = useState<string | null>(null);
  const [villageQuery, setVillageQuery] = useState("");

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

  const phoneValid = useMemo(() => {
    if (!form.whatsapp.trim()) return true;
    const digits = form.whatsapp.replace(/\s/g, "");
    return /^\+?[0-9]{10,13}$/.test(digits);
  }, [form.whatsapp]);

  const selectedTehsilLabel = useMemo(
    () => TEHSIL_OPTIONS.find((t) => t.value === form.tehsilValue)?.name_en ?? "",
    [form.tehsilValue]
  );

  const handleSubmit = useCallback(async () => {
    setFormState("submitting");
    setSubmitError(null);

    try {
      const res = await fetch("/api/report/create", {
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
          whatsapp: form.whatsapp || undefined,
          email: form.email || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setSubmitError(data.error ?? "Report generation failed. Please try again.");
        setFormState("error");
        return;
      }

      if (data.html) {
        setReportId(data.reportId);
        setReportHtml(data.html);
        setFormState("success");
      } else {
        window.location.href = `/report/${data.reportId}`;
      }
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : "Something went wrong.");
      setFormState("error");
    }
  }, [form, selectedTehsilLabel]);

  // ── Success state ─────────────────────────────────────────────────────────
  if (formState === "success" && reportHtml) {
    return (
      <div>
        <div className="mb-4 flex items-center gap-3 rounded border border-[#e8efe9] bg-[#f7f7f2] px-4 py-3 text-sm">
          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[#1d6f5b] text-white text-xs font-bold">✓</div>
          <div>
            <p className="font-semibold text-[#17231d]">Report generated</p>
            <p className="text-xs text-[#5b665f]">ID: {reportId}</p>
          </div>
        </div>
        <div dangerouslySetInnerHTML={{ __html: reportHtml }} />
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
              Continue to contact →
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Contact */}
      {step === 3 && (
        <div className="flex flex-col gap-4">
          <div className="rounded border border-[#e8efe9] bg-[#f7f7f2] px-3 py-2 text-xs text-[#5b665f]">
            {selectedTehsilLabel} / <strong className="text-[#17231d]">{form.village}</strong> ·{" "}
            {SEARCH_LABELS[form.searchMode]}{" "}
            <strong className="text-[#17231d]">{form.identifier}</strong>
          </div>

          <div>
            <label htmlFor="sellerName" className="mb-1 block text-sm font-semibold text-[#17231d]">
              Seller name{" "}
              <span className="font-normal text-[#5b665f]">(optional — for manual review)</span>
            </label>
            <input
              id="sellerName"
              type="text"
              value={form.sellerName}
              onChange={(e) =>
                setForm((f) => ({ ...f, sellerName: e.target.value }))
              }
              placeholder="Name as it appears in agreement or broker note"
              className="w-full rounded border border-[#d9ddd4] px-3 py-2 text-sm focus:border-[#1d6f5b] focus:outline-none"
            />
          </div>

          <div>
            <label htmlFor="whatsapp" className="mb-1 block text-sm font-semibold text-[#17231d]">
              WhatsApp number{" "}
              <span className="font-normal text-[#5b665f]">(for report delivery)</span>
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
            {form.whatsapp && !phoneValid && (
              <p className="mt-1 text-xs text-[#c0392b]">Enter a valid 10-13 digit phone number</p>
            )}
          </div>

          <div>
            <label htmlFor="email" className="mb-1 block text-sm font-semibold text-[#17231d]">
              Email <span className="font-normal text-[#5b665f]">(optional)</span>
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
          </div>

          {submitError && (
            <div className="rounded border border-[#e8a29a] bg-[#fff0ee] px-3 py-2 text-sm text-[#8d2118]">
              {submitError}
            </div>
          )}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setStep(2)}
              disabled={formState === "submitting"}
              className="flex-1 rounded border border-[#d9ddd4] px-4 py-2.5 text-sm font-semibold text-[#5b665f] hover:bg-[#f7f7f2] disabled:opacity-50"
            >
              ← Back
            </button>
            <button
              type="button"
              disabled={formState === "submitting" || !canAdvanceStep3 || !phoneValid}
              onClick={handleSubmit}
              className="flex-1 rounded bg-[#1d6f5b] px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-[#b7c0b6]"
            >
              {formState === "submitting" ? "Generating..." : "Generate report"}
            </button>
          </div>

          <p className="text-center text-xs text-[#5b665f]">
            ₹499 for first concierge-reviewed report. Delivered on WhatsApp after manual review.
          </p>
        </div>
      )}
    </div>
  );
}
