"use client";

/**
 * ClearDeed — ReportToolbarClient
 *
 * Sticky top toolbar on the live report view. Owns Print, Download PDF,
 * Download Bundle, and Buyer/Lawyer layer toggle; the report body lives in a
 * sibling `dangerouslySetInnerHTML` blob so this component never touches it.
 *
 * Migrated from inline `style={{ ... }}` to Tailwind utility classes so the
 * toolbar doesn't fight the CRED `<style>` block inside the report blob for
 * cascade priority (REPORT-SHELL-REDESIGN-PI / PR 1 fix).
 */

import { useRouter } from "next/navigation";

export interface ReportToolbarClientProps {
  reportId: string;
  pdfHref: string;
  bundleHref: string;
  currentLayer: "buyer" | "lawyer";
}

export default function ReportToolbarClient({
  reportId,
  pdfHref,
  bundleHref,
  currentLayer,
}: ReportToolbarClientProps) {
  const router = useRouter();

  const handlePrint = () => {
    window.print();
  };

  const switchLayer = (layer: "buyer" | "lawyer") => {
    const url = new URL(window.location.href);
    url.searchParams.set("layer", layer);
    router.replace(url.pathname + url.search, { scroll: false });
  };

  return (
    <div
      data-testid="report-toolbar"
      className="sticky top-0 z-50 flex items-center justify-between gap-3 bg-[#17231d] px-4 py-2.5 font-[system-ui,sans-serif] text-white shadow-sm sm:px-5"
    >
      <span className="flex items-center gap-2 text-sm">
        <span className="opacity-90 font-medium">ClearDeed report</span>
        <span className="hidden rounded border border-white/10 bg-white/5 px-1.5 py-0.5 font-mono text-[11px] opacity-50 sm:inline-block">
          {reportId}
        </span>
      </span>

      <div className="flex items-center gap-2">
        {/* Layer toggle — Buyer/Lawyer layers are a first-class product feature
            (Layer 1 + Layer 2 in the three-layer report spec). */}
        <div
          className="hidden items-center gap-1 rounded border border-white/10 bg-white/5 p-0.5 sm:flex"
          role="tablist"
          aria-label="Report layer"
        >
          <button
            type="button"
            role="tab"
            aria-selected={currentLayer === "buyer"}
            onClick={() => switchLayer("buyer")}
            className={`rounded px-2.5 py-1 text-[13px] transition-colors ${
              currentLayer === "buyer"
                ? "bg-white/15 text-white"
                : "text-white/60 hover:text-white"
            }`}
          >
            Buyer&rsquo;s read
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={currentLayer === "lawyer"}
            onClick={() => switchLayer("lawyer")}
            className={`rounded px-2.5 py-1 text-[13px] transition-colors ${
              currentLayer === "lawyer"
                ? "bg-white/15 text-white"
                : "text-white/60 hover:text-white"
            }`}
          >
            Lawyer&rsquo;s drill-down
          </button>
        </div>

        <button
          type="button"
          onClick={handlePrint}
          className="rounded border border-white/15 bg-transparent px-3 py-1.5 text-sm text-white hover:border-white/30 hover:bg-white/5"
        >
          Print
        </button>

        <a
          href={pdfHref}
          download
          data-testid="report-pdf-download"
          className="rounded border border-transparent bg-[#d4a017] px-3.5 py-1.5 text-sm font-semibold text-[#17231d] no-underline hover:brightness-110"
        >
          Download PDF
        </a>

        <a
          href={bundleHref}
          download
          className="rounded border border-white/15 bg-transparent px-3 py-1.5 text-sm text-white hover:border-white/30 hover:bg-white/5"
        >
          Bundle
        </a>
      </div>
    </div>
  );
}
