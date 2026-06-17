"use client";

/**
 * useDocInterpretation — fetches /api/reports/:id/interpret-doc?docType=igr_ec
 * via SSE, accumulates fields, returns idle/streaming/done/failed.
 *
 * Plan §3.1 V1: idempotent. If the user re-runs, the previous result
 * is restored from localStorage on first render.
 */

import { useEffect, useState, useCallback, useRef } from "react";

export type InterpretationField = {
  field: string;
  value: string;
  quote?: { text: string; page?: number; bbox?: { x: number; y: number; w: number; h: number } };
  interpretation: string;
  confidence: number;
};

export type InterpretationDone = {
  fields: InterpretationField[];
  warnings: string[];
  costUsdCents: number;
  model: string;
  durationMs: number;
  cacheHit: boolean;
};

export type InterpretationState =
  | { status: "idle" }
  | { status: "streaming"; fields: InterpretationField[] }
  | { status: "done"; fields: InterpretationField[]; meta: InterpretationDone }
  | { status: "failed"; error: string };

const STORAGE_PREFIX = "doc_interpret_v1:";

export function useDocInterpretation(reportId: string, docType: "igr_ec" | "bhulekh_back") {
  const [state, setState] = useState<InterpretationState>({ status: "idle" });
  const esRef = useRef<EventSource | null>(null);

  // Restore from localStorage on mount.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_PREFIX + reportId + ":" + docType);
      if (raw) {
        const parsed = JSON.parse(raw) as InterpretationDone;
        // If the cached result is an empty fields list (e.g. an
        // earlier ai_not_purchased), don't restore it — the user
        // may have paid in the meantime, and we want a fresh SSE
        // attempt. The hook's start() will fetch and either succeed
        // or fail again.
        if (parsed.warnings?.includes("ai_not_purchased")) {
          localStorage.removeItem(STORAGE_PREFIX + reportId + ":" + docType);
          return;
        }
        setState({ status: "done", fields: parsed.fields, meta: parsed });
      }
    } catch {
      // ignore corrupt cache
    }
  }, [reportId, docType]);

  const start = useCallback(() => {
    if (state.status === "streaming") return;
    setState({ status: "streaming", fields: [] });

    const url = `/api/reports/${reportId}/interpret-doc?docType=${docType}`;
    const es = new EventSource(url);
    esRef.current = es;
    const fields: InterpretationField[] = [];

    es.addEventListener("field", (ev) => {
      try {
        const f = JSON.parse((ev as MessageEvent).data) as InterpretationField;
        fields.push(f);
        setState({ status: "streaming", fields: [...fields] });
      } catch {
        // ignore malformed
      }
    });

    es.addEventListener("done", (ev) => {
      try {
        const meta = JSON.parse((ev as MessageEvent).data) as InterpretationDone;
        // Payment gate: if the cost-tracker refused on
        // ai_not_purchased, surface it as a failed state so the
        // AIDocUpsellGate renders. We don't cache an empty result
        // in localStorage (the user might pay and retry).
        if (meta.warnings?.includes("ai_not_purchased")) {
          setState({ status: "failed", error: "ai_not_purchased" });
          es.close();
          esRef.current = null;
          return;
        }
        // Persist for re-render resilience (Plan §3.1).
        localStorage.setItem(
          STORAGE_PREFIX + reportId + ":" + docType,
          JSON.stringify(meta),
        );
        setState({ status: "done", fields: meta.fields, meta });
      } catch {
        setState({ status: "failed", error: "malformed_done_event" });
      }
      es.close();
      esRef.current = null;
    });

    es.addEventListener("error", (ev) => {
      const message =
        (ev as MessageEvent).data && (ev as MessageEvent).data.length > 0
          ? "stream_error"
          : "connection_error";
      setState({ status: "failed", error: message });
      es.close();
      esRef.current = null;
    });
  }, [reportId, docType, state.status]);

  const reset = useCallback(() => {
    setState({ status: "idle" });
    try {
      localStorage.removeItem(STORAGE_PREFIX + reportId + ":" + docType);
    } catch {
      // ignore
    }
  }, [reportId, docType]);

  useEffect(() => () => {
    esRef.current?.close();
  }, []);

  return { state, start, reset };
}
