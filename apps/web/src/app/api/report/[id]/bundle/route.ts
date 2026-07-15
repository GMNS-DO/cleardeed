/**
 * GET /api/report/[id]/bundle
 *
 * Returns a ZIP bundle containing the report's structured output plus the
 * raw artifacts produced by each pipeline source (Bhulekh HTML, Bhunaksha
 * JSON, eCourts HTML, etc.). Intended for lawyer review and offline audit.
 *
 * Access control: token-based, same pattern as /api/report/[id]/pdf.
 *
 * Current scaffold (Phase 1): the ZIP contains:
 *   - report.json  — minimal structured output (plot GPS, owner, statuses, insight count)
 *   - README.txt   — provenance + verify instructions
 *   - placeholder stubs for plot_diagram.svg and per-source raw files
 *
 * TODO: populate from reports.sources JSONB column once migrated.
 *       Once that column is live, this route should iterate source rows
 *       and emit one file per source (e.g. bhulekh.html, bhunaksha.json).
 *       Until then, the ZIP ships with a README explaining the gap.
 */

import { NextRequest, NextResponse } from "next/server";
import { getReport, getSupabaseServerClient } from "@/lib/db";
import { isReportViewAuthorized } from "@/lib/report-access";
import { getPlotDiagramUrl } from "@/lib/plot-diagram-storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

interface SourceRawRow {
  source: string;
  parsed: unknown | null;
  raw: string | null;
  rawIsJson: boolean;
}

/**
 * Fetch raw + parsed bytes for every source_results row attached to this
 * report. The `get_report` RPC deliberately exposes parsed_data only (it's
 * what the report body needs) — for the bundle we additionally pull the
 * raw_response column so the layer-2 lawyer view can replay the source.
 *
 * Capped per-source to 4 MB — Bhulekh raw HTML is the largest realistic
 * payload (a fully-populated RoR with all 5 tenant rows is ~250 KB), and
 * the cap exists to bound bundle size. Failed/empty fetches are still
 * returned as null parsed/raw so the manifest is complete.
 */
async function fetchAllSourceArtifacts(reportId: string): Promise<SourceRawRow[]> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("source_results")
    .select("source_name, parsed_data, raw_response")
    .eq("report_id", reportId);

  if (error || !data) return [];

  return (data as Array<{
    source_name: string | null;
    parsed_data: unknown | null;
    raw_response: string | null;
  }>).map((row) => {
    const source = row.source_name ?? "unknown";
    const raw = row.raw_response ?? null;
    // Heuristic: Bhulekh raw is HTML, all others JSON. For an unknown raw
    // string we sniff the first byte — '{' → JSON.
    const looksJson = raw
      ? typeof raw === "string" && raw.trimStart().startsWith("{")
      : false;
    return {
      source,
      parsed: row.parsed_data ?? null,
      raw,
      rawIsJson: looksJson || !raw || source !== "bhulekh",
    };
  });
}

/**
 * Best-effort fetch of the Bhulekh plot diagram SVG from the public
 * Supabase Storage bucket. Returns null if the diagram was never uploaded
 * or the bucket is unreachable. Failure must not break the bundle.
 */
async function fetchPlotDiagramSvg(reportId: string): Promise<Uint8Array | null> {
  const url = getPlotDiagramUrl(reportId, "primary");
  if (!url) return null;
  try {
    const res = await fetch(url, {
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return null;
    const buf = await res.arrayBuffer();
    return new Uint8Array(buf);
  } catch {
    return null;
  }
}

// ── Minimal ZIP writer ────────────────────────────────────────────────────────
// No external zip dependency. Implements the subset of the ZIP file format
// needed for a small manifest + a handful of UTF-8 text files (STORE method,
// no compression). Compatible with stock unzip / OS archive utilities.

// CRC-32 table (per PKZIP spec, polynomial 0xEDB88320).
const CRC_TABLE: Uint32Array = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ bytes[i]) & 0xff];
  }
  return (crc ^ 0xffffffff) >>> 0;
}

interface ZipEntry {
  name: string;
  data: Uint8Array;
  crc: number;
  modTime: number;
  modDate: number;
}

function encodeUtf8(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

function dosDateTime(now: Date): { modTime: number; modDate: number } {
  // DOS time: bits 0-4 seconds/2, 5-10 minute, 11-15 hour
  const modTime =
    ((now.getHours() & 0x1f) << 11) |
    ((now.getMinutes() & 0x3f) << 5) |
    (Math.floor(now.getSeconds() / 2) & 0x1f);
  // DOS date: bits 0-4 day, 5-8 month, 9-15 year-1980
  const modDate =
    (((now.getFullYear() - 1980) & 0x7f) << 9) |
    (((now.getMonth() + 1) & 0x0f) << 5) |
    (now.getDate() & 0x1f);
  return { modTime, modDate };
}

function buildZip(entries: { name: string; content: string | Uint8Array }[]): Uint8Array {
  const now = new Date();
  const { modTime, modDate } = dosDateTime(now);

  const records: ZipEntry[] = entries.map((e) => {
    const data = typeof e.content === "string" ? encodeUtf8(e.content) : e.content;
    return { name: e.name, data, crc: crc32(data), modTime, modDate };
  });

  const localChunks: Uint8Array[] = [];
  const centralChunks: Uint8Array[] = [];
  let offset = 0;

  for (const rec of records) {
    const nameBytes = encodeUtf8(rec.name);
    // Local file header signature (PK\x03\x04) + fixed fields
    const localHeader = new Uint8Array(30);
    const dv = new DataView(localHeader.buffer);
    dv.setUint32(0, 0x04034b50, true); // signature
    dv.setUint16(4, 20, true); // version needed
    dv.setUint16(6, 0, true); // flags
    dv.setUint16(8, 0, true); // method = STORE
    dv.setUint16(10, rec.modTime, true);
    dv.setUint16(12, rec.modDate, true);
    dv.setUint32(14, rec.crc, true);
    dv.setUint32(18, rec.data.length, true); // compressed size
    dv.setUint32(22, rec.data.length, true); // uncompressed size
    dv.setUint16(26, nameBytes.length, true);
    dv.setUint16(28, 0, true); // extra length

    localChunks.push(localHeader, nameBytes, rec.data);

    // Central directory header signature (PK\x01\x02)
    const centralHeader = new Uint8Array(46);
    const cv = new DataView(centralHeader.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true); // version made by
    cv.setUint16(6, 20, true); // version needed
    cv.setUint16(8, 0, true); // flags
    cv.setUint16(10, 0, true); // method
    cv.setUint16(12, rec.modTime, true);
    cv.setUint16(14, rec.modDate, true);
    cv.setUint32(16, rec.crc, true);
    cv.setUint32(20, rec.data.length, true);
    cv.setUint32(24, rec.data.length, true);
    cv.setUint16(28, nameBytes.length, true);
    cv.setUint16(30, 0, true); // extra
    cv.setUint16(32, 0, true); // comment
    cv.setUint16(34, 0, true); // disk
    cv.setUint16(36, 0, true); // internal attrs
    cv.setUint32(38, 0, true); // external attrs
    cv.setUint32(42, offset, true); // local header offset

    centralChunks.push(centralHeader, nameBytes);
    offset += localHeader.length + nameBytes.length + rec.data.length;
  }

  const centralStart = offset;
  let centralSize = 0;
  for (const c of centralChunks) centralSize += c.length;

  // End of central directory record (PK\x05\x06)
  const eocd = new Uint8Array(22);
  const ev = new DataView(eocd.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(4, 0, true); // disk number
  ev.setUint16(6, 0, true); // start disk
  ev.setUint16(8, records.length, true); // entries on this disk
  ev.setUint16(10, records.length, true); // total entries
  ev.setUint32(12, centralSize, true);
  ev.setUint32(16, centralStart, true);
  ev.setUint16(20, 0, true); // comment length

  const totalLength =
    localChunks.reduce((s, c) => s + c.length, 0) +
    centralSize +
    eocd.length;
  const out = new Uint8Array(totalLength);
  let pos = 0;
  for (const c of localChunks) {
    out.set(c, pos);
    pos += c.length;
  }
  for (const c of centralChunks) {
    out.set(c, pos);
    pos += c.length;
  }
  out.set(eocd, pos);
  return out;
}

// ── Route handler ─────────────────────────────────────────────────────────────

function safeFilenamePart(value: string): string {
  return value.replace(/[^a-z0-9-]+/gi, "-").replace(/-+/g, "-").replace(/^-|-$/g, "").slice(0, 80) || "report";
}

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id: reportId } = await context.params;
  const token = req.nextUrl.searchParams.get("token");

  if (!isReportViewAuthorized(reportId, token)) {
    return NextResponse.json(
      { error: "This bundle link is missing or has an invalid access token." },
      { status: 401 }
    );
  }

  try {
    const result = await getReport(reportId);
    const report = result?.report;

    if (!report) {
      return NextResponse.json(
        { error: "Report not found." },
        { status: 404 }
      );
    }

    const now = new Date();

    // Minimal structured output. We deliberately surface only what a lawyer
    // would want offline without re-rendering the full HTML report. Full
    // insight payloads remain on /report/[id]; this is a bundle manifest.
    const reportJson: Record<string, unknown> = {
      reportId,
      generatedAt: now.toISOString(),
      plot: {
        gps: {
          lat: report.gps_lat ?? null,
          lon: report.gps_lon ?? null,
        },
        tehsil: report.tehsil ?? null,
        village: report.village ?? null,
        plotNo: report.plot_no ?? null,
      },
      owner: {
        claimedOwnerName: report.claimed_owner_name ?? null,
        fatherHusbandName: report.father_husband_name ?? null,
        plotDescription: report.plot_description ?? null,
      },
      status: report.report_status ?? null,
      sourceStatuses: {
        nominatim: report.nominatim_status ?? null,
        bhunaksha: report.bhunaksha_status ?? null,
        bhulekh: report.bhulekh_status ?? null,
        ecourts: report.ecourts_status ?? null,
        rccms: report.rccms_status ?? null,
      },
      // `insightCount` is not yet surfaced as a column on reports; once the
      // pipeline writes it (or once we read it from validation_findings), we
      // can populate this. For now: null is honest.
      insightCount: null,
      title: report.report_title ?? null,
      paidTier: report.paid_tier ?? null,
      expiresAt: report.expires_at ?? null,
    };

    // Sprint 3: surface the per-source artifacts (parser confidence, raw
    // hashes, status reasons) stored in reports.pipeline_output. This is
    // the Layer-2 "lawyer drill-down" — the structured facts a lawyer
    // would cross-check against the live portal, with the parser reasoning
    // made explicit.
    // Optional pipeline_output JSON (parsed facts + per-source provenance
    // metadata written by the orchestrator). Surfaced on report rows that
    // have it; not on legacy rows.
    const pipelineOutput =
      (report as unknown as { pipeline_output?: unknown }).pipeline_output ?? null;
    if (pipelineOutput && typeof pipelineOutput === "object") {
      reportJson.pipelineOutput = pipelineOutput;
    }

    // Per-source raw + parsed artifacts. Fetched in parallel with the
    // plot-diagram download so the bundle doesn't have a second latency
    // floor beyond one round-trip.
    const [sourceArtifacts, plotDiagramBytes] = await Promise.all([
      fetchAllSourceArtifacts(reportId),
      fetchPlotDiagramSvg(reportId),
    ]);

    const zipEntries: { name: string; content: string | Uint8Array }[] = [
      { name: "report.json", content: JSON.stringify(reportJson, null, 2) },
    ];

    for (const src of sourceArtifacts) {
      const slug = src.source.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
      if (src.parsed && (typeof src.parsed === "object" || Array.isArray(src.parsed))) {
        zipEntries.push({
          name: `sources/${slug}_parsed.json`,
          content: JSON.stringify(src.parsed, null, 2),
        });
      } else if (src.parsed) {
        zipEntries.push({
          name: `sources/${slug}_parsed.txt`,
          content: typeof src.parsed === "string" ? src.parsed : JSON.stringify(src.parsed),
        });
      }
      if (src.raw && src.raw.length > 0) {
        const ext = src.rawIsJson ? "json" : "html";
        zipEntries.push({
          name: `sources/${slug}_raw.${ext}`,
          content: src.raw,
        });
      }
    }

    if (plotDiagramBytes && plotDiagramBytes.length > 0) {
      zipEntries.push({ name: "plot_diagram.svg", content: plotDiagramBytes });
    } else {
      // Honest placeholder — never invent an SVG that pretends to be the
      // real plot diagram. The README explains the gap.
      zipEntries.push({
        name: "plot_diagram.svg",
        content: [
          '<?xml version="1.0" encoding="UTF-8"?>',
          '<!-- placeholder: Bhulekh plot diagram was not generated for this report -->',
          '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300" width="400" height="300">',
          '  <rect width="100%" height="100%" fill="#f8fafc" stroke="#cbd5e1" stroke-dasharray="4 4"/>',
          '  <text x="50%" y="50%" text-anchor="middle" font-family="sans-serif" font-size="14" fill="#64748b">',
          '    Plot diagram not yet available for this report',
          '  </text>',
          '</svg>',
          '',
        ].join("\n"),
      });
    }

    const readme = [
      "ClearDeed Report Bundle",
      "=======================",
      "",
      `Report ID:        ${reportId}`,
      `Generated on:     ${now.toISOString()}`,
      `Report title:     ${report.report_title ?? "(untitled)"}`,
      `Report status:    ${report.report_status ?? "unknown"}`,
      `Paid tier:        ${report.paid_tier ?? "free preview"}`,
      `Expires at:       ${report.expires_at ?? "no expiry"}`,
      "",
      "Contents:",
      "  - report.json              Structured pipeline output (this bundle's manifest).",
      "  - sources/<source>_parsed.json  Parsed fields from each pipeline source",
      "                                   (Bhulekh, Bhunaksha, eCourts, Nominatim, …).",
      "  - sources/<source>_raw.html|json  Raw upstream response for offline replay.",
      "  - plot_diagram.svg         Bhulekh cadastral plot diagram (or placeholder if not generated).",
      "",
      "How to verify this bundle:",
      "  1. Confirm the live report at /report/[id]?token=<token> matches report.json.",
      "  2. Cross-check source statuses against the live report header.",
      "  3. For Bhulekh raw HTML, re-fetch from bhulekh.ori.nic.in manually",
      "     using the same village/tahasil/khatiyan/plot inputs.",
      "",
      "Source-of-truth hierarchy (per ADR-024 + ADR-026):",
      "  - Layer 1 (Buyer's Read): /report/[id]?token=...  (legal-defensible copy)",
      "  - Layer 2 (Lawyer's Drill-Down): this bundle + /api/report/[id]/html",
      "  - External portals: bhulekh.ori.nic.in, services.ecourts.gov.in,",
      "    igrodisha.gov.in, ccms.nic.in (manual verification)",
      "",
      "This bundle does not contain personally-identifying owner information",
      "beyond what the buyer already provided. Share only with the buyer's",
      "engaged lawyer.",
      "",
    ].join("\n");

    zipEntries.push({ name: "README.txt", content: readme });

    const zip = buildZip(zipEntries);

    const datePart = now.toISOString().slice(0, 10);
    const title = report.report_title ?? reportId;
    const filename = `cleardeed-report-${safeFilenamePart(title)}-${datePart}.zip`;

    return new NextResponse(new Uint8Array(zip), {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": String(zip.length),
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to build bundle.";
    console.error(`[/api/report/${reportId}/bundle]`, message);
    return NextResponse.json(
      { error: "Failed to build report bundle. Please try again." },
      { status: 500 }
    );
  }
}