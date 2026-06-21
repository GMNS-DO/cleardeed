/**
 * ClearDeed — Buyer dashboard.
 *
 * Lists reports owned by the authenticated user. Per-user scoping is
 * enforced server-side via the WHERE user_id = auth.uid() filter. Even
 * though RLS is not enabled on the reports table today, the query itself
 * isolates per-user — defense-in-depth, not a substitute for RLS.
 *
 * Middleware redirects unauthenticated requests to /login?next=/dashboard.
 * If middleware is bypassed (e.g. test environment), this page also calls
 * getUser() and returns a sign-in prompt if no session.
 *
 * Route: /dashboard
 */
import Link from "next/link";
import { getSupabaseServerAuth } from "@/lib/supabase/server";
import { SignOutButton } from "./SignOutButton";
import { createReportViewToken } from "@/lib/report-access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface ReportRow {
  id: string;
  created_at: string;
  gps_lat: number | null;
  gps_lon: number | null;
  claimed_owner_name: string | null;
  plot_description: string | null;
  report_status: string | null;
  expires_at: string | null;
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
    case "complete":
      return "bg-emerald-100 text-emerald-800 border-emerald-300";
    case "generating":
    case "pending":
      return "bg-amber-100 text-amber-900 border-amber-300";
    case "failed":
      return "bg-rose-100 text-rose-900 border-rose-300";
    default:
      return "bg-stone-100 text-stone-700 border-stone-300";
  }
}

function safeFilenamePart(value: string): string {
  return (
    value
      .replace(/[^a-z0-9-]+/gi, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 80) || "report"
  );
}

export default async function BuyerDashboardPage() {
  const supabase = await getSupabaseServerAuth();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <main className="min-h-screen bg-[#f7f7f2] px-5 py-12 text-[#17231d]">
        <div className="mx-auto max-w-md rounded border border-stone-300 bg-white p-6 shadow-sm">
          <h1 className="text-xl font-semibold">Sign in required</h1>
          <p className="mt-3 text-sm text-stone-700">
            You need to sign in with your phone to view your reports.
          </p>
          <Link
            href="/login?next=/dashboard"
            className="mt-4 inline-block rounded bg-[#163d33] px-4 py-2 text-sm font-semibold text-white hover:bg-[#1d6f5b]"
          >
            Sign in
          </Link>
        </div>
      </main>
    );
  }

  const { data: rows, error } = await supabase
    .from("reports")
    .select(
      "id, created_at, gps_lat, gps_lon, claimed_owner_name, plot_description, report_status, expires_at"
    )
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(50);

  const reports: ReportRow[] = (rows ?? []) as ReportRow[];
  const loadError = error?.message ?? null;

  return (
    <main className="min-h-screen bg-[#f7f7f2] text-[#17231d]">
      <header className="border-b border-stone-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-4 md:px-8">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-[#163d33]">Your reports</h1>
            <p className="text-sm text-stone-600">
              Reports you've purchased are listed here. Share the report link with your lawyer or
              family — they don't need an account.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/" className="text-sm font-semibold text-[#1d6f5b] hover:underline">
              New report
            </Link>
            <SignOutButton />
          </div>
        </div>
      </header>

      {loadError ? (
        <div className="mx-auto mt-8 max-w-3xl rounded border border-rose-300 bg-rose-50 p-4 text-sm text-rose-900">
          Failed to load reports: {loadError}
        </div>
      ) : null}

      <section className="mx-auto max-w-5xl px-5 py-6 md:px-8">
        {reports.length === 0 ? (
          <div className="rounded border border-stone-200 bg-white p-8 text-center">
            <p className="text-sm text-stone-600">
              You don't have any reports yet. Buy your first report on the home page.
            </p>
            <Link
              href="/"
              className="mt-4 inline-block rounded bg-[#163d33] px-4 py-2 text-sm font-semibold text-white hover:bg-[#1d6f5b]"
            >
              Generate a report
            </Link>
          </div>
        ) : (
          <ul className="space-y-3">
            {reports.map((report) => {
              const token = createReportViewToken(report.id);
              const href = token
                ? `/report/${encodeURIComponent(report.id)}?token=${encodeURIComponent(token)}`
                : `/report/${encodeURIComponent(report.id)}`;
              const title =
                report.plot_description ||
                (report.gps_lat && report.gps_lon
                  ? `Plot ${report.gps_lat.toFixed(4)}, ${report.gps_lon.toFixed(4)}`
                  : "Report");
              const expired =
                report.expires_at && new Date(report.expires_at).getTime() < Date.now();
              return (
                <li
                  key={report.id}
                  className="rounded border border-stone-200 bg-white p-4 shadow-sm"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-[#13251e]">{title}</p>
                      <p className="mt-1 text-xs text-stone-600">
                        {formatIndianDate(report.created_at)}
                        {report.claimed_owner_name ? ` · ${report.claimed_owner_name}` : ""}
                        {expired ? " · expired" : ""}
                      </p>
                    </div>
                    <span
                      className={`inline-block rounded border px-2 py-1 text-xs font-medium ${statusBadgeClass(report.report_status)}`}
                    >
                      {report.report_status ?? "unknown"}
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Link
                      href={href}
                      className="rounded bg-[#163d33] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#1d6f5b]"
                    >
                      Open
                    </Link>
                    <a
                      href={`/api/report/${encodeURIComponent(report.id)}/pdf?token=${encodeURIComponent(token ?? "")}`}
                      className="rounded border border-stone-300 bg-white px-3 py-1.5 text-xs font-semibold text-[#1d6f5b] hover:bg-[#f7f7f2]"
                    >
                      PDF
                    </a>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}