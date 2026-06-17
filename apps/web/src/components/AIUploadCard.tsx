"use client";

/**
 * AIUploadCard — lets a user upload their own EC / RoR / mutation-order
 * document for AI interpretation.
 *
 * Plan §3.1 V2: a user who couldn't get a clean Bhulekh/IGR fetch can
 * still get an AI summary by uploading their own file. The file goes
 * to the `user-uploads` Supabase Storage bucket, and a row is written
 * to `user_uploads`. The user must then pay the ₹499 unlock before
 * the SSE route accepts the AI call.
 *
 * Flow:
 *   1. User picks a file (PDF/PNG/JPEG, ≤ 10 MB).
 *   2. We POST it to /api/reports/:id/upload-doc?docType=<type>.
 *   3. On success, we show "Upload ready — pay ₹499 to interpret".
 *   4. The user clicks "Unlock AI summary" — uses the standard
 *      AIDocUpsellGate flow from V1.
 *   5. After payment + unlock, the SSE route reads the upload and
 *      interprets it.
 *
 * This component does NOT itself call SSE — it just persists the
 * upload so that the SSE route (which already gates on
 * isUnlocked()) can pick it up.
 */

import { useState, useCallback, useRef } from "react";
import { AIDocUpsellGate } from "./AIDocUpsellGate";

type UploadDocType =
  | "user_upload_ec"
  | "user_upload_ror"
  | "mutation_order_3g";

type Props = {
  reportId: string;
  docType: UploadDocType;
};

type UploadState =
  | { kind: "idle" }
  | { kind: "uploading"; fileName: string }
  | {
      kind: "uploaded";
      fileName: string;
      byteSize: number;
      sha256: string;
    }
  | { kind: "failed"; reason: string };

const ALLOWED_LABELS: Record<UploadDocType, string> = {
  user_upload_ec: "Encumbrance Certificate (EC)",
  user_upload_ror: "Record of Rights (RoR) — single generation",
  mutation_order_3g: "RoR with 3+ generations of mutation history",
};

const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED_MIME = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
]);

export function AIUploadCard({ reportId, docType }: Props) {
  const [state, setState] = useState<UploadState>({ kind: "idle" });
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleFile = useCallback(
    async (file: File) => {
      if (file.size > MAX_BYTES) {
        setState({ kind: "failed", reason: "File is over 10 MB." });
        return;
      }
      if (!ALLOWED_MIME.has(file.type)) {
        setState({
          kind: "failed",
          reason: "Only PDF, PNG, or JPEG files are accepted.",
        });
        return;
      }
      setState({ kind: "uploading", fileName: file.name });
      try {
        const fd = new FormData();
        fd.append("file", file);
        const res = await fetch(
          `/api/reports/${reportId}/upload-doc?docType=${docType}`,
          { method: "POST", body: fd },
        );
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          setState({
            kind: "failed",
            reason:
              typeof body?.error === "string"
                ? body.error
                : `Upload failed (HTTP ${res.status})`,
          });
          return;
        }
        const json = (await res.json()) as {
          byteSize: number;
          sha256: string;
        };
        setState({
          kind: "uploaded",
          fileName: file.name,
          byteSize: json.byteSize,
          sha256: json.sha256,
        });
      } catch (err) {
        setState({
          kind: "failed",
          reason: err instanceof Error ? err.message : "Network error",
        });
      }
    },
    [reportId, docType],
  );

  const onPick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const onChange = useCallback(
    (ev: React.ChangeEvent<HTMLInputElement>) => {
      const file = ev.target.files?.[0];
      if (file) void handleFile(file);
    },
    [handleFile],
  );

  const onReset = useCallback(() => {
    setState({ kind: "idle" });
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);

  return (
    <section
      aria-label={`Upload ${ALLOWED_LABELS[docType]}`}
      data-state={state.kind}
      className="ai-upload-card"
    >
      <h3>Upload your own document</h3>
      <p className="ai-upload-card__hint">
        {ALLOWED_LABELS[docType]} — PDF, PNG, or JPEG (≤ 10 MB). Use this
        when the auto-fetch from IGR/Bhulekh didn't produce a clean copy.
      </p>

      <input
        ref={fileInputRef}
        type="file"
        accept="application/pdf,image/png,image/jpeg"
        onChange={onChange}
        aria-label="Choose file to upload"
        className="ai-upload-card__file-input"
      />

      {state.kind === "idle" && (
        <button
          type="button"
          onClick={onPick}
          className="ai-upload-card__cta"
        >
          Choose file
        </button>
      )}

      {state.kind === "uploading" && (
        <p aria-busy="true" className="ai-upload-card__status">
          Uploading {state.fileName}…
        </p>
      )}

      {state.kind === "uploaded" && (
        <div className="ai-upload-card__success">
          <p>
            <strong>{state.fileName}</strong> uploaded ({formatBytes(state.byteSize)}).
          </p>
          <p>
            Pay ₹499 to unlock the AI summary of this upload. The file is
            saved to your report and stays private.
          </p>
          <AIDocUpsellGate
            reportId={reportId}
            docType={docType}
            reason="ai_not_purchased"
            onReset={onReset}
          />
        </div>
      )}

      {state.kind === "failed" && (
        <div className="ai-upload-card__error" role="alert">
          <p>{state.reason}</p>
          <button type="button" onClick={onReset}>
            Try again
          </button>
        </div>
      )}
    </section>
  );
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}
