/**
 * Fetch the IGR EC document input for the AI interpreter.
 *
 * The igr-ec fetcher (packages/fetchers/igr-ec) returns parsed JSON
 * entries — not raw HTML — so we cannot hand a pre-rendered page to
 * the Sonnet call. Instead we:
 *
 *   1. Read source_results where source_name = 'igr-ec' for the report
 *   2. Pull `data.entries[]` (the parsed EncumbranceEntry[] shape)
 *   3. Render those entries to a stable, deterministic HTML table
 *   4. Return a DocumentInput of kind "html"
 *
 * Rendering JSON to HTML on the way in gives the model a single
 * document format, makes quote-grounding trivial (substring match
 * against a row is reliable), and stays inside plan §3.5's spirit
 * (auto-fetched doc type) even though the upstream is JSON, not HTML.
 *
 * Plan §3.5: "igrSroData is HTML. A12 ingests HTML directly" was an
 * early assumption; the actual igr-ec fetcher returns parsed JSON.
 * The fix preserves the same DocumentInput contract.
 */
import { interpretDocument, type DocumentInput, type InterpretationResult } from "@cleardeed/document-interpreter";
import { getSupabaseServerClient } from "@/lib/db";

type IgrEcEntries = Array<{
  docNo?: string;
  docType?: string;
  executionDate?: string;
  presentationDate?: string;
  parties?: { name: string; role?: string }[];
  amount?: string | number;
  consideration?: string;
  sro?: string;
}>;

type SourceResult = {
  source: string;
  status: string;
  data?: {
    ecAvailable?: boolean;
    entries?: IgrEcEntries;
    searchPeriod?: { from: string; to: string };
    sro?: string;
    district?: string;
    applicationNo?: string;
    pageContent?: string;
  } | null;
};

/**
 * Read the igr-ec source result for a report and render it to a
 * self-contained HTML string that the AI interpreter can ground in.
 *
 * Returns null if the report has no IGR EC data (either the source
 * wasn't run, or it failed). Callers should treat null as "AI summary
 * not available for this report" and show the upsell gate.
 */
export async function fetchIgrEcInput(reportId: string): Promise<DocumentInput | null> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("source_results")
    .select("source_name,status,parsed_data")
    .eq("report_id", reportId)
    .eq("source_name", "igr-ec")
    .maybeSingle();

  if (error) {
    console.warn(`[fetchIgrEcInput] ${reportId}: ${error.message}`);
    return null;
  }
  if (!data) return null;

  const row = data as { source_name: string; status: string; parsed_data: SourceResult["data"] | null };

  if (row.status !== "success" || !row.parsed_data) {
    // Source ran but failed (e.g. captcha wall, no entries). We still
    // return null — the AI summary has nothing to interpret.
    return null;
  }

  const html = renderIgrEcToHtml(row.parsed_data);
  return { kind: "html", content: html };
}

/**
 * Render parsed IGR EC entries to an HTML table the model can quote.
 *
 * The structure is stable so the quote-validator's substring check
 * has predictable anchor text. We include the same fields the existing
 * consumer-report-writer's IGR EC block surfaces, so what the user
 * sees in the report body matches what the AI claims to be quoting.
 */
export function renderIgrEcToHtml(data: NonNullable<SourceResult["data"]>): string {
  const entries = Array.isArray(data.entries) ? data.entries : [];
  const period =
    data.searchPeriod && data.searchPeriod.from && data.searchPeriod.to
      ? `${data.searchPeriod.from} → ${data.searchPeriod.to}`
      : "Period not recorded";

  const rows = entries
    .map((e, i) => {
      const docNo = e.docNo ?? "—";
      const exec = e.executionDate ?? "—";
      const pres = e.presentationDate ?? "—";
      const docType = e.docType ?? "—";
      const parties = Array.isArray(e.parties)
        ? e.parties.map((p) => `${p.name}${p.role ? ` (${p.role})` : ""}`).join("; ") || "—"
        : "—";
      const amount = e.amount != null ? String(e.amount) : e.consideration ?? "—";
      const sro = e.sro ?? data.sro ?? "—";
      return `
        <tr>
          <td>${i + 1}</td>
          <td>${escapeHtml(docNo)}</td>
          <td>${escapeHtml(docType)}</td>
          <td>${escapeHtml(exec)}</td>
          <td>${escapeHtml(pres)}</td>
          <td>${escapeHtml(parties)}</td>
          <td>${escapeHtml(amount)}</td>
          <td>${escapeHtml(sro)}</td>
        </tr>`;
    })
    .join("");

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>IGR Encumbrance Certificate — ${escapeHtml(data.district ?? "")}</title>
</head>
<body>
  <h1>IGR Encumbrance Certificate</h1>
  <p>
    <strong>District:</strong> ${escapeHtml(data.district ?? "—")} ·
    <strong>SRO:</strong> ${escapeHtml(data.sro ?? "—")} ·
    <strong>Application No:</strong> ${escapeHtml(data.applicationNo ?? "—")} ·
    <strong>Search period:</strong> ${escapeHtml(period)}
  </p>
  <table border="1" cellspacing="0" cellpadding="4">
    <thead>
      <tr>
        <th>#</th>
        <th>Document No</th>
        <th>Type</th>
        <th>Execution Date</th>
        <th>Presentation Date</th>
        <th>Parties</th>
        <th>Amount / Consideration</th>
        <th>SRO</th>
      </tr>
    </thead>
    <tbody>${rows || `<tr><td colspan="8">No entries recorded for the search period.</td></tr>`}</tbody>
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
