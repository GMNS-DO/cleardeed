"use client";

import { useState, useEffect } from "react";

interface Lawyer {
  id: string;
  name: string;
  firm: string | null;
  email: string;
  phone: string | null;
  license_number: string | null;
  photo_url: string | null;
  is_panel: boolean;
}

interface LawyerSelectProps {
  value: string;
  onChange: (lawyerId: string) => void;
}

export function LawyerSelect({ value, onChange }: LawyerSelectProps) {
  const [lawyers, setLawyers] = useState<Lawyer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/lawyers")
      .then((r) => r.json())
      .then((data: Lawyer[] | { error?: string }) => {
        if (Array.isArray(data)) {
          setLawyers(data);
        }
      })
      .catch(() => {/* noop */})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <label htmlFor="lawyerId" className="mb-1 block text-sm font-semibold text-[#17231d]">
        Select panel advocate <span className="text-[#c0392b]">*</span>
      </label>
      <select
        id="lawyerId"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={loading}
        className="w-full rounded border border-[#d9ddd4] bg-white px-3 py-2 text-sm focus:border-[#1d6f5b] focus:outline-none disabled:opacity-60"
      >
        <option value="">— select an advocate —</option>
        {lawyers.map((l) => (
          <option key={l.id} value={l.id}>
            {l.name} {l.firm ? `· ${l.firm}` : ""} {l.license_number ? `(#${l.license_number})` : ""}
          </option>
        ))}
      </select>
      <p className="mt-1 text-xs text-[#5b665f]">
        This advocate will co-sign your Guaranteed-tier report.
        Or choose &quot;— select an advocate —&quot; and we&apos;ll reach out after purchase.
      </p>
    </div>
  );
}
