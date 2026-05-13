import Link from "next/link";
import { listLeadRequests, listRecentReports, type DbLeadRequest, type DbReport } from "@/lib/db";

export const dynamic = "force-dynamic";

interface AdminPageProps {
  searchParams: Promise<{ token?: string }>;
}

export default async function AdminPage({ searchParams }: AdminPageProps) {
  const { token } = await searchParams;
  const expectedToken = process.env.ADMIN_VIEW_TOKEN;

  if (!expectedToken) {
    return <Locked message="ADMIN_VIEW_TOKEN is not configured." />;
  }

  if (token !== expectedToken) {
    return <Locked message="Open this page with the founder admin token." />;
  }

  let leads: DbLeadRequest[] = [];
  let reports: DbReport[] = [];
  let error: string | null = null;

  try {
    [leads, reports] = await Promise.all([
      listLeadRequests(50),
      listRecentReports(50),
    ]);
  } catch (err) {
    error = err instanceof Error ? err.message : "Unable to load admin data.";
  }

  return (
    <main className="min-h-screen bg-[#f7f7f2] px-5 py-6 text-[#17231d] md:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="flex flex-wrap items-end justify-between gap-4 border-b border-[#d9ddd4] pb-5">
          <div>
            <p className="text-sm font-semibold uppercase text-[#8a5f1d]">Concierge Ops</p>
            <h1 className="mt-1 text-3xl font-bold">ClearDeed admin</h1>
          </div>
          <Link href="/" className="border border-[#b7c0b6] px-3 py-2 text-sm font-semibold text-[#1d6f5b]">
            Public site
          </Link>
        </header>

        {error ? (
          <div className="mt-5 border border-[#e8a29a] bg-[#fff0ee] p-4 text-sm text-[#8d2118]">
            {error}
          </div>
        ) : null}

        <section className="mt-6">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-xl font-bold">Lead requests</h2>
            <span className="text-sm text-[#5b665f]">{leads.length} latest</span>
          </div>
          <div className="overflow-x-auto border border-[#d9ddd4] bg-white">
            <table className="min-w-full border-collapse text-left text-sm">
              <thead className="bg-[#eef1ea] text-xs uppercase text-[#4b5b52]">
                <tr>
                  <th className="px-3 py-2">Created</th>
                  <th className="px-3 py-2">Buyer</th>
                  <th className="px-3 py-2">Phone</th>
                  <th className="px-3 py-2">Type</th>
                  <th className="px-3 py-2">Location</th>
                  <th className="px-3 py-2">Owner</th>
                  <th className="px-3 py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {leads.length === 0 ? (
                  <tr><td className="px-3 py-4 text-[#5b665f]" colSpan={7}>No lead requests found.</td></tr>
                ) : leads.map((lead) => (
                  <tr key={lead.id} className="border-t border-[#edf0e8] align-top">
                    <td className="whitespace-nowrap px-3 py-2">{formatDate(lead.created_at)}</td>
                    <td className="px-3 py-2 font-semibold">{lead.buyer_name}</td>
                    <td className="whitespace-nowrap px-3 py-2">{lead.phone}</td>
                    <td className="px-3 py-2">{lead.user_type}</td>
                    <td className="max-w-xs px-3 py-2">{lead.location_text ?? formatGps(lead.gps_lat, lead.gps_lon) ?? "—"}</td>
                    <td className="px-3 py-2">{lead.claimed_owner_name ?? "—"}</td>
                    <td className="px-3 py-2">{lead.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="mt-8">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-xl font-bold">Recent reports</h2>
            <span className="text-sm text-[#5b665f]">{reports.length} latest</span>
          </div>
          <div className="overflow-x-auto border border-[#d9ddd4] bg-white">
            <table className="min-w-full border-collapse text-left text-sm">
              <thead className="bg-[#eef1ea] text-xs uppercase text-[#4b5b52]">
                <tr>
                  <th className="px-3 py-2">Created</th>
                  <th className="px-3 py-2">Report</th>
                  <th className="px-3 py-2">Owner</th>
                  <th className="px-3 py-2">GPS</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Sources</th>
                </tr>
              </thead>
              <tbody>
                {reports.length === 0 ? (
                  <tr><td className="px-3 py-4 text-[#5b665f]" colSpan={6}>No reports found.</td></tr>
                ) : reports.map((report) => (
                  <tr key={report.id} className="border-t border-[#edf0e8] align-top">
                    <td className="whitespace-nowrap px-3 py-2">{formatDate(report.created_at)}</td>
                    <td className="px-3 py-2">
                      <Link className="font-semibold text-[#1d6f5b]" href={`/report/${report.id}`}>
                        {report.id.slice(0, 8)}
                      </Link>
                    </td>
                    <td className="px-3 py-2">{report.claimed_owner_name}</td>
                    <td className="whitespace-nowrap px-3 py-2">{formatGps(report.gps_lat, report.gps_lon)}</td>
                    <td className="px-3 py-2">{report.report_status}</td>
                    <td className="max-w-md px-3 py-2 text-xs leading-5 text-[#5b665f]">
                      {[
                        ["Nominatim", report.nominatim_status],
                        ["Bhunaksha", report.bhunaksha_status],
                        ["Bhulekh", report.bhulekh_status],
                        ["eCourts", report.ecourts_status],
                        ["RCCMS", report.rccms_status],
                      ].map(([label, status]) => `${label}: ${status ?? "—"}`).join(" | ")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}

function Locked({ message }: { message: string }) {
  return (
    <main className="min-h-screen bg-[#f7f7f2] px-5 py-10 text-[#17231d]">
      <section className="mx-auto max-w-xl border border-[#d9ddd4] bg-white p-6">
        <p className="text-sm font-semibold uppercase text-[#8a5f1d]">Admin</p>
        <h1 className="mt-1 text-2xl font-bold">Access token required</h1>
        <p className="mt-3 text-[#4b5b52]">{message}</p>
      </section>
    </main>
  );
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kolkata",
  }).format(new Date(value));
}

function formatGps(lat: number | null, lon: number | null): string | null {
  if (lat == null || lon == null) return null;
  return `${Number(lat).toFixed(6)}, ${Number(lon).toFixed(6)}`;
}
