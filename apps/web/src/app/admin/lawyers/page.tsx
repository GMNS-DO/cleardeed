/**
 * Admin: Advocate management page.
 *
 * Protected by ADMIN_VIEW_TOKEN. Fails closed when the token env var is unset.
 *
 * Route: /admin/lawyers?token=<ADMIN_VIEW_TOKEN>
 */
import { redirect } from "next/navigation";
import Link from "next/link";
import { listLawyers } from "@/lib/db";
import { isDashboardAuthorized } from "@/lib/dashboard-auth";
import { AdminLawyerForm } from "./AdminLawyerForm";
import { AdminLawyerActions } from "./AdminLawyerActions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ token?: string }>;
}

export default async function AdminLawyersPage({ searchParams }: PageProps) {
  const { token } = await searchParams;
  if (!isDashboardAuthorized(token)) {
    redirect("/admin/dashboard");
  }

  let lawyers: Awaited<ReturnType<typeof listLawyers>> = [];
  let loadError: string | null = null;
  try {
    lawyers = await listLawyers();
  } catch (err) {
    loadError = err instanceof Error ? err.message : String(err);
  }

  return (
    <main className="min-h-screen bg-[#f7f7f2] text-[#17231d]">
      <header className="border-b border-stone-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 md:px-8">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-[#163d33]">
              ClearDeed · Panel advocates
            </h1>
            <p className="text-sm text-stone-600">
              Manage advocates available for Guaranteed-tier co-sign.
            </p>
          </div>
          <Link
            href={`/admin/dashboard?token=${encodeURIComponent(token!)}`}
            className="text-sm font-semibold text-[#1d6f5b] hover:underline"
          >
            Back to dashboard
          </Link>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-5 py-6 md:px-8">
        {loadError ? (
          <div className="rounded border border-rose-300 bg-rose-50 p-4 text-sm text-rose-900">
            Failed to load advocates: {loadError}
          </div>
        ) : null}

        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-lg font-semibold">
            Advocates ({lawyers.length})
          </h2>
          <AdminLawyerForm token={token!} />
        </div>

        {lawyers.length === 0 ? (
          <div className="rounded border border-stone-200 bg-white p-6 text-sm text-stone-600">
            No advocates yet. Use the form above to add a panel advocate.
          </div>
        ) : (
          <div className="overflow-x-auto rounded border border-stone-200 bg-white shadow-sm">
            <table className="min-w-full divide-y divide-stone-200 text-sm">
              <thead className="bg-stone-50 text-left text-xs font-semibold uppercase tracking-wide text-stone-600">
                <tr>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Firm</th>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Phone</th>
                  <th className="px-4 py-3">License #</th>
                  <th className="px-4 py-3">Panel</th>
                  <th className="px-4 py-3">Created</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {lawyers.map((lawyer) => (
                  <tr key={lawyer.id} className="align-top">
                    <td className="px-4 py-3 font-medium">{lawyer.name}</td>
                    <td className="px-4 py-3 text-stone-700">
                      {lawyer.firm ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-stone-700">{lawyer.email}</td>
                    <td className="px-4 py-3 text-stone-700">
                      {lawyer.phone ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-stone-700">
                      {lawyer.license_number ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      {lawyer.is_panel ? (
                        <span className="rounded bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-800">
                          Panel
                        </span>
                      ) : (
                        <span className="rounded bg-stone-100 px-2 py-0.5 text-xs text-stone-600">
                          External
                        </span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-stone-700">
                      {new Date(lawyer.created_at).toLocaleDateString("en-IN")}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right">
                      <AdminLawyerActions
                        id={lawyer.id}
                        name={lawyer.name}
                        token={token!}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
