"use client";

import { useFormStatus } from "react-dom";
import { useState } from "react";
import { pdpdConsentLabel } from "@/lib/pdpd";

export function PDPDConsentCheckbox({ bucket }: { bucket: string }) {
  const { pending } = useFormStatus();
  const [checked, setChecked] = useState(false);

  return (
    <label className="flex items-start gap-2 text-xs text-[#5b665f]">
      <input
        type="checkbox"
        required
        disabled={pending}
        checked={checked}
        onChange={(e) => setChecked(e.target.checked)}
        className="mt-0.5 h-4 w-4 shrink-0 rounded border-[#d9ddd4] accent-[#1d6f5b]"
      />
      <span>{pdpdConsentLabel(bucket)}</span>
    </label>
  );
}
