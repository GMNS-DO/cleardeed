/**
 * Fetch the Bhulekh back-page document input for the AI interpreter.
 *
 * The Bhulekh back page is the second half of the RoR Khatiyan that
 * records mutation history, encumbrance entries, and any court-case /
 * bank-charge remarks. It is parsed into structured JSON by the Bhulekh
 * fetcher (`packages/fetchers/bhulekh`), then stored as
 * `source_results.parsed_data` for the report.
 *
 * Plan §3.1 (V1.5): this adapter is the mirror of `igr-ec-input.ts`.
 * We:
 *
 *   1. Read source_results where source_name = 'bhulekh' for the report
 *   2. Pull `parsed_data.backPage` (BhulekhBackPageResult) if status=success
 *   3. Render the mutations / encumbrances / remarks to a stable HTML
 *      table so the model has a single document format and the
 *      quote-validator's substring check has predictable anchor text.
 *   4. Return a DocumentInput of kind "html" — modelForDocType("bhulekh_back")
 *      will route to Haiku.
 *
 * Why HTML not the raw screenshot (base64 PNG)?
 *   - V1.5: HTML is parsed + structured, gives Haiku reliable quote
 *     grounding (substring match against a row).
 *   - V2: we may switch to the screenshot for documents where the
 *     parsed_data is missing (failed parse, captcha wall, etc.), or
 *     where the HTML is empty but the screenshot is legible.
 *
 * The renderer (AIDocSummaryCard) treats `bhulekh_back` as a separate
 * summary card from `igr_ec` — they each render their own upsell gate.
 */

import type { DocumentInput, InterpretationResult } from "@cleardeed/document-interpreter";
import { interpretDocument } from "@cleardeed/document-interpreter";
import { getSupabaseServerClient } from "@/lib/db";

type BhulekhMutationEntry = {
  mutationNumber?: string | null;
  mutationDate?: string | null;
  orderNumber?: string | null;
  fromKhatiyan?: string | null;
  toKhatiyan?: string | null;
  plotNo?: string | null;
  rawText?: string;
};

type BhulekhEncumbranceEntry = {
  type?: string | null;
  propertyDescription?: string | null;
  partyName?: string | null;
  amount?: string | null;
  period?: string | null;
  docNo?: string | null;
  date?: string | null;
  registrationYear?: string | null;
  fromKhatiyan?: string | null;
  toKhatiyan?: string | null;
  rawText?: string;
};

type BhulekhBackPageRemark = {
  category?: "court_case" | "bank_charge" | "govt_restriction" | "other" | "unknown" | string;
  rawText?: string;
};

type BhulekhBackPage = {
  status?: string;
  mutationHistory?: BhulekhMutationEntry[];
  encumbranceEntries?: BhulekhEncumbranceEntry[];
  backPageRemarks?: BhulekhBackPageRemark[];
  backPageBlank?: boolean;
  fetchedAt?: string;
};

type SourceResult = {
  source_name: string;
  status: string;
  parsed_data?: {
    backPage?: BhulekhBackPage | null;
    khataNo?: string | null;
    district?: string | null;
    tehsil?: string | null;
    village?: string | null;
  } | null;
};

/**
 * Read the bhulekh source result for a report and render the back-page
 * to a self-contained HTML string that the AI interpreter can ground in.
 *
 * Returns null when:
 *   - the source result row doesn't exist (Bhulekh was not run for
 *     this report — typically GPS-mode legacy)
 *   - the source status is not "success" (captcha wall, network error,
 *     parse failure)
 *   - backPage is null/missing (front page only, no back page to render)
 *   - backPage.status !== "success" (back page fetch failed)
 *   - backPage is blank (backPageBlank === true) and has zero
 *     mutations, encumbrances, and remarks
 *
 * Callers treat null as "AI summary not available for this report" and
 * show the upsell gate.
 */
export async function fetchBhulekhBackInput(reportId: string): Promise<DocumentInput | null> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("source_results")
    .select("source_name,status,parsed_data")
    .eq("report_id", reportId)
    .eq("source_name", "bhulekh")
    .maybeSingle();

  if (error) {
    console.warn(`[fetchBhulekhBackInput] ${reportId}: ${error.message}`);
    return null;
  }
  if (!data) return null;

  const row = data as { source_name: string; status: string; parsed_data: SourceResult["parsed_data"] | null };

  if (row.status !== "success" || !row.parsed_data) {
    return null;
  }

  const backPage = row.parsed_data.backPage ?? null;
  if (!backPage || backPage.status !== "success") {
    return null;
  }

  // Skip if the back page is structurally blank (Bhulekh returned 200 OK
  // but the page contained no rows). V1 doesn't show "AI summary" for
  // a blank page — the user just sees the source screenshot in the
  // report and no AI card. This avoids charging ₹499 for nothing.
  const hasContent =
    (backPage.mutationHistory?.length ?? 0) > 0 ||
    (backPage.encumbranceEntries?.length ?? 0) > 0 ||
    (backPage.backPageRemarks?.length ?? 0) > 0;
  if (!hasContent) {
    return null;
  }

  const html = renderBhulekhBackToHtml(row.parsed_data, backPage);
  return { kind: "html", content: html };
}

/**
 * Render a parsed Bhulekh back-page to an HTML document the model can
 * quote. The structure is stable: three sections (mutations,
 * encumbrances, remarks), each with predictable row layouts.
 *
 * Quote-validator behaviour: the validator normalises whitespace and
 * does a substring check. As long as the table cells contain the
 * verbatim text that the model quotes, grounding passes.
 */
export function renderBhulekhBackToHtml(
  data: NonNullable<SourceResult["parsed_data"]>,
  backPage: BhulekhBackPage,
): string {
  const mutations = Array.isArray(backPage.mutationHistory) ? backPage.mutationHistory : [];
  const encumbrances = Array.isArray(backPage.encumbranceEntries) ? backPage.encumbranceEntries : [];
  const remarks = Array.isArray(backPage.backPageRemarks) ? backPage.backPageRemarks : [];

  const mutationRows = mutations
    .map((m, i) => `
      <tr>
        <td>${i + 1}</td>
        <td>${escapeHtml(m.mutationNumber ?? "—")}</td>
        <td>${escapeHtml(m.mutationDate ?? "—")}</td>
        <td>${escapeHtml(m.orderNumber ?? "—")}</td>
        <td>${escapeHtml(m.fromKhatiyan ?? "—")}</td>
        <td>${escapeHtml(m.toKhatiyan ?? "—")}</td>
        <td>${escapeHtml(m.plotNo ?? "—")}</td>
      </tr>`)
    .join("");

  const encumbranceRows = encumbrances
    .map((e, i) => `
      <tr>
        <td>${i + 1}</td>
        <td>${escapeHtml(e.type ?? "—")}</td>
        <td>${escapeHtml(e.partyName ?? "—")}</td>
        <td>${escapeHtml(e.amount ?? "—")}</td>
        <td>${escapeHtml(e.docNo ?? "—")}</td>
        <td>${escapeHtml(e.date ?? "—")}</td>
        <td>${escapeHtml(e.period ?? "—")}</td>
        <td>${escapeHtml(e.fromKhatiyan ?? "—")}</td>
        <td>${escapeHtml(e.toKhatiyan ?? "—")}</td>
      </tr>`)
    .join("");

  const remarkRows = remarks
    .map((r, i) => `
      <tr>
        <td>${i + 1}</td>
        <td>${escapeHtml(r.category ?? "unknown")}</td>
        <td>${escapeHtml(r.rawText ?? "—")}</td>
      </tr>`)
    .join("");

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Bhulekh Back Page — ${escapeHtml(data.khataNo ?? "")}</title>
</head>
<body>
  <h1>Bhulekh Back Page (Khatiyan)</h1>
  <p>
    <strong>District:</strong> ${escapeHtml(data.district ?? "—")} ·
    <strong>Tehsil:</strong> ${escapeHtml(data.tehsil ?? "—")} ·
    <strong>Village:</strong> ${escapeHtml(data.village ?? "—")} ·
    <strong>Khatiyan:</strong> ${escapeHtml(data.khataNo ?? "—")} ·
    <strong>Fetched at:</strong> ${escapeHtml(backPage.fetchedAt ?? "—")}
  </p>

  <h2>Mutation history (${mutations.length})</h2>
  <table border="1" cellspacing="0" cellpadding="4">
    <thead>
      <tr>
        <th>#</th>
        <th>Mutation No</th>
        <th>Date</th>
        <th>Order No</th>
        <th>From Khatiyan</th>
        <th>To Khatiyan</th>
        <th>Plot No</th>
      </tr>
    </thead>
    <tbody>${mutationRows || `<tr><td colspan="7">No mutation entries recorded.</td></tr>`}</tbody>
  </table>

  <h2>Encumbrance entries (${encumbrances.length})</h2>
  <table border="1" cellspacing="0" cellpadding="4">
    <thead>
      <tr>
        <th>#</th>
        <th>Type</th>
        <th>Party</th>
        <th>Amount</th>
        <th>Doc No</th>
        <th>Date</th>
        <th>Period</th>
        <th>From Khatiyan</th>
        <th>To Khatiyan</th>
      </tr>
    </thead>
    <tbody>${encumbranceRows || `<tr><td colspan="9">No encumbrance entries recorded.</td></tr>`}</tbody>
  </table>

  <h2>Back-page remarks (${remarks.length})</h2>
  <table border="1" cellspacing="0" cellpadding="4">
    <thead>
      <tr>
        <th>#</th>
        <th>Category</th>
        <th>Raw text</th>
      </tr>
    </thead>
    <tbody>${remarkRows || `<tr><td colspan="3">No remarks recorded.</td></tr>`}</tbody>
  </table>
</body>
</html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export { interpretDocument };
export type { DocumentInput, InterpretationResult };
