/**
 * Lawyer dashboard — list of past reports with re-run and export-to-PDF actions.
 *
 * Protected by ADMIN_VIEW_TOKEN. Fails closed when the token env var is unset.
 *
 * Route: /admin/dashboard?token=<ADMIN_VIEW_TOKEN>
 */
import { redirect } from "next/navigation";
import Link from "next/link";
import { listRecentReports, type DbReport } from "@/lib/db";
import { isDashboardAuthorized } from "@/lib/dashboard-auth";
import { ReportRowActions } from "@/components/ReportRowActions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ token?: string }>;
}

function safeFilenamePart(value: string): string {
  return value.replace(/[^a-z0-9-]+/gi, "-").replace(/-+/g, "-").replace(/^-|-$/g, "").slice(0, 80) || "report";
}

function formatIndianDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function statusBadgeClass(status: string | null | undefined): string {
  switch (status) {
    case "success":
      return "bg-emerald-100 text-emerald-800 border-emerald-300";
    case "partial":
      return "bg-amber-100 text-amber-900 border-amber-300";
    case "failed":
    case "error":
      return "bg-rose-100 text-rose-900 border-rose-300";
    default:
      return "bg-stone-100 text-stone-700 border-stone-300";
  }
}

interface SourceCounts {
  verified: number;
  partial: number;
  failed: number;
  dormant: number;
}

function summarizeSources(report: DbReport): SourceCounts {
  const sources = [
    { name: "nominatim", status: report.nominatim_status },
    { name: "bhunaksha", status: report.bhunaksha_status },
    { name: "bhulekh", status: report.bhulekh_status },
    { name: "ecourts", status: report.ecourts_status },
    { name: "rccms", status: report.rccms_status },
  ];

  const counts: SourceCounts = { verified: 0, partial: 0, failed: 0, dormant: 0 };
  for (const s of sources) {
    if (!s.status) {
      counts.dormant += 1;
      continue;
    }
    if (s.status === "success") counts.verified += 1;
    else if (s.status === "partial") counts.partial += 1;
    else if (s.status === "failed" || s.status === "error") counts.failed += 1;
    else counts.dormant += 1;
  }
  return counts;
}

interface InsightCounts {
  redFlag: number;
  watchOut: number;
  positive: number;
}

function extractInsightCounts(report: DbReport): InsightCounts {
  const summary = (report.source_summary ?? {}) as Record<string, unknown>;
  const counts: InsightCounts = { redFlag: 0, watchOut: 0, positive: 0 };

  const candidates = [
    summary.insightCounts,
    summary.insights,
    summary.highlightCounts,
    (summary.report as Record<string, unknown> | undefined)?.insightCounts,
  ];
  for (const c of candidates) {
    if (c && typeof c === "object") {
      const obj = c as Record<string, unknown>;
      if (typeof obj.redFlag === "number") counts.redFlag = obj.redFlag;
      if (typeof obj.watchOut === "number") counts.watchOut = obj.watchOut;
      if (typeof obj.positive === "number") counts.positive = obj.positive;
      if (typeof obj.red_flags === "number") counts.redFlag = obj.red_flags;
      if (typeof obj.watch_outs === "number") counts.watchOut = obj.watch_outs;
      if (typeof obj.positives === "number") counts.positive = obj.positives;
      break;
    }
  }
  return counts;
}

export default async function DashboardPage({ searchParams }: PageProps) {
  const { token } = await searchParams;

  if (!isDashboardAuthorized(token)) {
    return (
      <main className="min-h-screen bg-[#f7f7f2] px-5 py-12 text-[#17231d]">
        <div className="mx-auto max-w-md rounded border border-stone-300 bg-white p-6 shadow-sm">
          <h1 className="text-xl font-semibold">Dashboard access denied</h1>
          <p className="mt-3 text-sm text-stone-700">
            The dashboard requires the <code>ADMIN_VIEW_TOKEN</code> query parameter and
            matching environment variable. The route fails closed when the token is unset
            in the deployment environment.
          </p>
        </div>
      </main>
    );
  }

  let reports: DbReport[] = [];
  let loadError: string | null = null;
  try {
    reports = await listRecentReports(50);
  } catch (err) {
    loadError = err instanceof Error ? err.message : String(err);
  }

  return (
    <main className="min-h-screen bg-[#f7f7f2] text-[#17231d]">
      <header className="border-b border-stone-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 md:px-8">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-[#163d33]">
              ClearDeed · Lawyer dashboard
            </h1>
            <p className="text-sm text-stone-600">
              Recent reports — re-run fetchers or export a fresh PDF for a buyer.
            </p>
          </div>
          <Link
            href={`/dashboard?token=${encodeURIComponent(token!)}`}
            className="text-sm font-semibold text-[#1d6f5b] hover:underline"
          >
            Refresh
          </Link>
        </div>
      </header>

      {loadError ? (
        <div className="mx-auto mt-8 max-w-3xl rounded border border-rose-300 bg-rose-50 p-4 text-sm text-rose-900">
          Failed to load reports: {loadError}
        </div>
      ) : null}

      <section className="mx-auto max-w-7xl px-5 py-6 md:px-8">
        {reports.length === 0 ? (
          <p className="rounded border border-stone-200 bg-white p-6 text-sm text-stone-600">
            No reports yet. Once a report is generated, it will appear here.
          </p>
        ) : (
          <div className="overflow-x-auto rounded border border-stone-200 bg-white shadow-sm">
            <table className="min-w-full divide-y divide-stone-200 text-sm">
              <thead className="bg-stone-50 text-left text-xs font-semibold uppercase tracking-wide text-stone-600">
                <tr>
                  <th className="px-4 py-3">Created</th>
                  <th className="px-4 py-3">Title / Plot</th>
                  <th className="px-4 py-3">Owner</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Sources</th>
                  <th className="px-4 py-3">Flags</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {reports.map((report) => {
                  const sources = summarizeSources(report);
                  const insights = extractInsightCounts(report);
                  const filename = `ClearDeed-${safeFilenamePart(
                    report.report_title ?? report.claimed_owner_name ?? report.id
                  )}.pdf`;
                  const isV11 =
                    !report.gps_lat &&
                    !report.gps_lon &&
                    (report.plot_description ?? "").length > 0;
                  return (
                    <tr key={report.id} className="align-top">
                      <td className="whitespace-nowrap px-4 py-3 text-stone-700">
                        {formatIndianDate(report.created_at)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-semibold text-[#17231d]">
                          {report.report_title ?? "Untitled report"}
                        </div>
                        <div className="text-xs text-stone-500">
                          {isV11
                            ? report.plot_description
                            : `${report.gps_lat.toFixed(4)}, ${report.gps_lon.toFixed(4)}`}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium">{report.claimed_owner_name}</div>
                        {report.father_husband_name ? (
                          <div className="text-xs text-stone-500">
                            s/o {report.father_husband_name}
                          </div>
                        ) : null}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center rounded border px-2 py-0.5 text-xs font-semibold ${statusBadgeClass(
                            report.report_status
                          )}`}
                        >
                          {report.report_status ?? "unknown"}
                        </span>
                        {report.error_message ? (
                          <div
                            className="mt-1 max-w-[16rem] truncate text-xs text-rose-700"
                            title={report.error_message}
                          >
                            {report.error_message}
                          </div>
                        ) : null}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1 text-xs">
                          <span className="rounded bg-emerald-50 px-2 py-0.5 text-emerald-800">
                            ✓ {sources.verified}
                          </span>
                          <span className="rounded bg-amber-50 px-2 py-0.5 text-amber-800">
                            ~ {sources.partial}
                          </span>
                          <span className="rounded bg-rose-50 px-2 py-0.5 text-rose-800">
                            ✗ {sources.failed}
                          </span>
                          {sources.dormant ? (
                            <span className="rounded bg-stone-100 px-2 py-0.5 text-stone-600">
                              — {sources.dormant}
                            </span>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs">
                        <div className="flex flex-wrap gap-1">
                          {insights.redFlag > 0 ? (
                            <span className="rounded bg-rose-100 px-2 py-0.5 text-rose-900">
                              {insights.redFlag} red
                            </span>
                          ) : null}
                          {insights.watchOut > 0 ? (
                            <span className="rounded bg-amber-100 px-2 py-0.5 text-amber-900">
                              {insights.watchOut} watch
                            </span>
                          ) : null}
                          {insights.positive > 0 ? (
                            <span className="rounded bg-emerald-100 px-2 py-0.5 text-emerald-900">
                              {insights.positive} ok
                            </span>
                          ) : null}
                          {insights.redFlag === 0 &&
                          insights.watchOut === 0 &&
                          insights.positive === 0 ? (
                            <span className="text-stone-500">—</span>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <ReportRowActions
                          reportId={report.id}
                          token={token!}
                          filename={filename}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
