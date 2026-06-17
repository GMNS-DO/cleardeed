"use client";

/**
 * AIDocSummaryCard — renders the AI-generated document summary.
 *
 * Plan §3.1: idle / streaming / done / failed states; ₹499 upsell gate
 * is rendered when the AI summary is unavailable.
 */

import { useDocInterpretation } from "@/hooks/useDocInterpretation";
import { AIDocUpsellGate } from "./AIDocUpsellGate";

type Props = {
  reportId: string;
  docType: "igr_ec" | "bhulekh_back";
};

export function AIDocSummaryCard({ reportId, docType }: Props) {
  const { state, start, reset } = useDocInterpretation(reportId, docType);

  if (state.status === "idle") {
    return (
      <section
        aria-label="AI document summary"
        data-state="idle"
        className="ai-doc-summary-card"
      >
        <h3>AI summary available</h3>
        <p>
          Get a plain-English explanation of this document, with every fact
          tied to the source text.
        </p>
        <button
          type="button"
          onClick={start}
          className="ai-doc-summary-cta"
        >
          Explain this document
        </button>
        <small>Powered by Claude · result grounded in source text</small>
      </section>
    );
  }

  if (state.status === "streaming") {
    return (
      <section
        aria-label="AI document summary (loading)"
        data-state="streaming"
        aria-busy="true"
        className="ai-doc-summary-card"
      >
        <h3>Reading document…</h3>
        <p>{state.fields.length} fields extracted so far</p>
      </section>
    );
  }

  if (state.status === "failed") {
    return (
      <AIDocUpsellGate
        reportId={reportId}
        docType={docType}
        reason={state.error}
        onRetry={start}
        onReset={reset}
      />
    );
  }

  // status === "done"
  const summary = state.meta.fields.find((f) => f.field === "plainEnglishSummary");
  const fields = state.meta.fields.filter((f) => f.field !== "plainEnglishSummary");
  const lowGrounding = state.meta.warnings.includes("low_grounding_rate");

  return (
    <section
      aria-label="AI document summary"
      data-state="done"
      className="ai-doc-summary-card"
    >
      {lowGrounding && (
        <p className="ai-doc-summary-warning" role="status">
          ⚠️ Some fields could not be verified against the document. Check the
          source quotes before relying on this summary.
        </p>
      )}
      {summary && (
        <div className="ai-doc-summary-lead">
          <h3>Summary</h3>
          <p>{summary.value}</p>
        </div>
      )}
      <h4>Extracted fields</h4>
      <table>
        <thead>
          <tr>
            <th scope="col">Field</th>
            <th scope="col">Value</th>
            <th scope="col">Confidence</th>
          </tr>
        </thead>
        <tbody>
          {fields.map((f) => (
            <tr key={f.field}>
              <th scope="row">{f.field}</th>
              <td>{f.value}</td>
              <td>
                {f.confidence < 0.5 ? "⚠️" : "✓"}{" "}
                {Math.round(f.confidence * 100)}%
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="ai-doc-summary-meta">
        {state.meta.model} · {state.meta.cacheHit ? "cache hit" : "fresh"} ·
        ₹{(state.meta.costUsdCents / 100).toFixed(2)} per call
      </p>
    </section>
  );
}
