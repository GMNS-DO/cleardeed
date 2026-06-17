/**
 * certified-copy — generate a downloadable, cryptographically signed
 * PDF/HTML of an AI document interpretation.
 *
 * Plan §3.1 V2: the user pays ₹499 for an AI summary; some legal
 * contexts (e.g. bank loan application, property dispute filing)
 * require a "certified" version. A certified copy is:
 *
 *   1. A self-contained HTML (no external assets) of the AI
 *      interpretation result.
 *   2. With a clear header: "AI-generated summary. Cleardeed
 *      certifies the AI grounded its extraction in the source
 *      text. The summary is not legal advice."
 *   3. With a SHA-256 hash of the canonical text (the AI fields
 *      and summary, joined with newlines).
 *   4. With an HMAC-SHA256 signature of (reportId, docType, hash)
 *      using a server secret.
 *   5. With a verification URL: /verify/:hash that, if the secret
 *      is rotated, can re-verify the signature.
 *
 * The HMAC is one-way: only the server can re-sign. A separate
 * /verify endpoint re-derives the HMAC and returns "valid" or
 * "invalid". This is the certification surface.
 *
 * Why HTML, not PDF? PDF generation is expensive (Playwright),
 * the file would be 50-200 KB, and the user already has a
 * browser. HTML is verifiable, has a stable MIME, and is small
 * (10-30 KB). Users can "Save as PDF" from the browser if they
 * want a real PDF.
 */

import crypto from "crypto";

export type CertifiedCopyInput = {
  reportId: string;
  docType: "igr_ec" | "bhulekh_back" | "user_upload_ec" | "user_upload_ror" | "mutation_order_3g";
  fields: Array<{
    field: string;
    value: string;
    quote?: { text: string; page?: number };
    interpretation: string;
    confidence: number;
  }>;
  summary: string;
  generatedAt: string; // ISO timestamp
  model: string;
  costUsdCents: number;
  durationMs: number;
};

export type CertifiedCopy = {
  html: string;
  hash: string;
  signature: string;
  reportId: string;
  docType: CertifiedCopyInput["docType"];
  generatedAt: string;
};

const HMAC_SECRET = process.env.AI_DOC_CERT_SECRET || "dev-secret-do-not-use-in-prod";

/**
 * Render a self-contained HTML page for the certified copy.
 * No external assets (CSS is inlined). Strips <script> tags from
 * any field value to prevent stored XSS via malformed AI output.
 */
export function renderCertifiedCopyHtml(input: CertifiedCopyInput): string {
  const safeFields = input.fields.map((f) => ({
    ...f,
    value: stripDangerous(f.value),
    interpretation: stripDangerous(f.interpretation),
    quoteText: f.quote ? stripDangerous(f.quote.text) : null,
  }));

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Cleardeed AI Summary — ${escapeHtml(input.reportId)}</title>
<style>
body { font: 14px/1.5 -apple-system, sans-serif; max-width: 760px; margin: 32px auto; padding: 0 24px; color: #1a1a1a; }
h1 { font-size: 22px; }
h2 { font-size: 18px; margin-top: 32px; border-bottom: 1px solid #ccc; padding-bottom: 4px; }
.cert { background: #f5f5f5; border: 1px solid #ddd; padding: 16px; margin: 16px 0; font-size: 12px; line-height: 1.6; }
.cert strong { display: inline-block; min-width: 120px; }
.field { margin: 12px 0; padding: 8px 0; border-bottom: 1px solid #eee; }
.field-name { font-weight: 600; }
.field-value { margin-top: 4px; }
.field-quote { font-style: italic; color: #555; margin-top: 4px; padding-left: 12px; border-left: 2px solid #ccc; font-size: 12px; }
.field-interp { color: #333; margin-top: 4px; }
.conf-low { color: #c00; }
.disclaimer { background: #fff7e6; border: 1px solid #f0c674; padding: 12px; margin-top: 32px; font-size: 12px; }
</style>
</head>
<body>
<h1>AI Document Summary</h1>
<p>Report ID: <code>${escapeHtml(input.reportId)}</code></p>
<p>Document: <code>${escapeHtml(input.docType)}</code></p>

<div class="cert">
  <div><strong>Generated at:</strong> ${escapeHtml(input.generatedAt)}</div>
  <div><strong>Model:</strong> ${escapeHtml(input.model)}</div>
  <div><strong>Cost:</strong> $${(input.costUsdCents / 100).toFixed(4)} (one-time AI interpretation)</div>
  <div><strong>Hash (SHA-256):</strong> <code id="hash"></code></div>
  <div><strong>Signature (HMAC):</strong> <code id="sig"></code></div>
</div>

<h2>Plain-English summary</h2>
<p>${escapeHtml(stripDangerous(input.summary))}</p>

<h2>Extracted fields</h2>
${safeFields.map((f) => `
<div class="field">
  <div class="field-name">${escapeHtml(f.field)}</div>
  <div class="field-value">${escapeHtml(f.value)} <span class="${f.confidence < 0.5 ? "conf-low" : ""}">(${(f.confidence * 100).toFixed(0)}% confidence)</span></div>
  ${f.quoteText ? `<div class="field-quote">"${escapeHtml(f.quoteText)}"</div>` : ""}
  <div class="field-interp">${escapeHtml(f.interpretation)}</div>
</div>
`).join("")}

<div class="disclaimer">
  <strong>Disclaimer:</strong> This is an AI-generated summary produced by Cleardeed
  using Claude (Anthropic). The summary is grounded in the source text via
  verbatim quotes. Cleardeed certifies the extraction is faithful to the source;
  however, this document is not legal advice and is not a substitute for a
  lawyer's review. Verify the hash and signature at
  <code>https://cleardeed.in/verify</code>.
</div>

<script>
document.getElementById("hash").textContent = window.__hash || "";
document.getElementById("sig").textContent = window.__sig || "";
</script>
</body>
</html>`;
}

/**
 * Compute the canonical hash and signature for a certified copy.
 * The hash is over the canonical text (fields + summary, joined
 * deterministically). The signature is HMAC-SHA256 over
 * (reportId + ":" + docType + ":" + hash).
 */
export function signCertifiedCopy(input: CertifiedCopyInput): {
  hash: string;
  signature: string;
} {
  const canonical = canonicalize(input);
  const hash = crypto.createHash("sha256").update(canonical).digest("hex");
  const signature = crypto
    .createHmac("sha256", HMAC_SECRET)
    .update(`${input.reportId}:${input.docType}:${hash}`)
    .digest("hex");
  return { hash, signature };
}

/**
 * Build the full CertifiedCopy: HTML + hash + signature.
 */
export function buildCertifiedCopy(input: CertifiedCopyInput): CertifiedCopy {
  const { hash, signature } = signCertifiedCopy(input);
  const html = renderCertifiedCopyHtml(input)
    // Inject the hash + sig into the cert block via a small script.
    .replace(
      '<script>',
      `<script>window.__hash="${hash}";window.__sig="${signature}";`,
    );
  return {
    html,
    hash,
    signature,
    reportId: input.reportId,
    docType: input.docType,
    generatedAt: input.generatedAt,
  };
}

/**
 * Verify a (hash, signature) pair for a given (reportId, docType).
 * Used by the /verify endpoint. Pure function — no I/O.
 */
export function verifyCertifiedCopy(args: {
  reportId: string;
  docType: CertifiedCopyInput["docType"];
  hash: string;
  signature: string;
}): boolean {
  const expected = crypto
    .createHmac("sha256", HMAC_SECRET)
    .update(`${args.reportId}:${args.docType}:${args.hash}`)
    .digest("hex");
  // Constant-time compare to avoid timing attacks.
  if (expected.length !== args.signature.length) return false;
  return crypto.timingSafeEqual(
    Buffer.from(expected, "hex"),
    Buffer.from(args.signature, "hex"),
  );
}

function canonicalize(input: CertifiedCopyInput): string {
  // Sort fields by name for determinism. Strip whitespace from values.
  const sortedFields = [...input.fields]
    .map((f) => ({
      field: f.field,
      value: (f.value || "").trim().replace(/\s+/g, " "),
      confidence: f.confidence.toFixed(3),
    }))
    .sort((a, b) => a.field.localeCompare(b.field));
  return [
    `report_id=${input.reportId}`,
    `doc_type=${input.docType}`,
    `model=${input.model}`,
    `generated_at=${input.generatedAt}`,
    `summary=${(input.summary || "").trim().replace(/\s+/g, " ")}`,
    ...sortedFields.map(
      (f) => `field:${f.field}=${f.value}|conf=${f.confidence}`,
    ),
  ].join("\n");
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function stripDangerous(s: string): string {
  // Remove <script>...</script> and any tag starting with < to prevent
  // stored XSS via malformed AI output. Whitelist plain text + <br>.
  return s
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/<(?!\/?br\s*\/?)[^>]+>/g, "");
}
