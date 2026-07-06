"use client";

/**
 * Sticky top toolbar on the live report view. Provides a "Download PDF" button
 * and a print action; the click handler must live in a Client Component under
 * the App Router.
 */
export default function ReportToolbarClient({
  reportId,
  pdfHref,
}: {
  reportId: string;
  pdfHref: string;
}) {
  return (
    <div
      data-testid="report-toolbar"
      style={{
        position: "sticky",
        top: 0,
        zIndex: 50,
        background: "#17231d",
        color: "#fff",
        padding: "10px 16px",
        display: "flex",
        gap: "12px",
        alignItems: "center",
        justifyContent: "space-between",
        fontFamily: "system-ui, sans-serif",
        fontSize: "14px",
        boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
      }}
    >
      <span style={{ opacity: 0.85, fontWeight: 500 }}>
        ClearDeed report
        <span style={{ opacity: 0.5, marginLeft: 8, fontSize: "12px" }}>
          {reportId}
        </span>
      </span>
      <div style={{ display: "flex", gap: "8px" }}>
        <button
          type="button"
          onClick={() => window.print()}
          style={{
            background: "transparent",
            color: "#fff",
            border: "1px solid #4a5e51",
            borderRadius: "4px",
            padding: "6px 14px",
            fontSize: "14px",
            cursor: "pointer",
            fontFamily: "inherit",
          }}
        >
          Print
        </button>
        <a
          href={pdfHref}
          download
          data-testid="report-pdf-download"
          style={{
            background: "#d4a017",
            color: "#17231d",
            border: "none",
            borderRadius: "4px",
            padding: "6px 16px",
            fontSize: "14px",
            fontWeight: 600,
            textDecoration: "none",
            cursor: "pointer",
            fontFamily: "inherit",
          }}
        >
          Download PDF
        </a>
      </div>
    </div>
  );
}
