"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Props {
  token: string;
}

export function AdminLawyerForm({ token }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    firm: "",
    email: "",
    phone: "",
    license_number: "",
    photo_url: "",
    is_panel: true,
  });

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/lawyers", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-token": token,
        },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Request failed (${res.status})`);
      }
      setOpen(false);
      setForm({
        name: "",
        firm: "",
        email: "",
        phone: "",
        license_number: "",
        photo_url: "",
        is_panel: true,
      });
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded bg-[#1d6f5b] px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[#155a4a]"
      >
        Add advocate
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded border border-stone-200 bg-white p-6 shadow-lg">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-semibold">Add panel advocate</h3>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="text-stone-500 hover:text-stone-700"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {error ? (
          <div className="mb-3 rounded border border-rose-300 bg-rose-50 p-2 text-sm text-rose-900">
            {error}
          </div>
        ) : null}

        <form onSubmit={handleSubmit} className="space-y-3 text-sm">
          <Field label="Name" required>
            <input
              type="text"
              required
              value={form.name}
              onChange={(e) => update("name", e.target.value)}
              className="w-full rounded border border-stone-300 px-3 py-2"
            />
          </Field>
          <Field label="Firm">
            <input
              type="text"
              value={form.firm}
              onChange={(e) => update("firm", e.target.value)}
              className="w-full rounded border border-stone-300 px-3 py-2"
            />
          </Field>
          <Field label="Email" required>
            <input
              type="email"
              required
              value={form.email}
              onChange={(e) => update("email", e.target.value)}
              className="w-full rounded border border-stone-300 px-3 py-2"
            />
          </Field>
          <Field label="Phone">
            <input
              type="text"
              value={form.phone}
              onChange={(e) => update("phone", e.target.value)}
              className="w-full rounded border border-stone-300 px-3 py-2"
            />
          </Field>
          <Field label="License number">
            <input
              type="text"
              value={form.license_number}
              onChange={(e) => update("license_number", e.target.value)}
              className="w-full rounded border border-stone-300 px-3 py-2"
            />
          </Field>
          <Field label="Photo URL">
            <input
              type="text"
              value={form.photo_url}
              onChange={(e) => update("photo_url", e.target.value)}
              className="w-full rounded border border-stone-300 px-3 py-2"
            />
          </Field>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={form.is_panel}
              onChange={(e) => update("is_panel", e.target.checked)}
            />
            <span>On ClearDeed panel</span>
          </label>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded border border-stone-300 px-4 py-2 text-sm hover:bg-stone-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded bg-[#1d6f5b] px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[#155a4a] disabled:opacity-50"
            >
              {submitting ? "Saving…" : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold text-stone-700">
        {label} {required ? <span className="text-rose-600">*</span> : null}
      </span>
      {children}
    </label>
  );
}