/**
 * ClearDeed — ReportShell
 *
 * Server component wrapper for /report/[id]. Owns the report-lifecycle
 * branches (unauthorized / unavailable / expired / live) and the layer
 * toggle (buyer | lawyer). The route entry `page.tsx` only handles auth
 * gating + demo-mode routing — every other concern lives here.
 *
 * Layer toggle semantics:
 *   - `layer=buyer`  → React-native BuyerLayer.tsx component tree (V1.1+)
 *     for now the page.tsx LiveReport path renders the existing HTML blob
 *     for backward compatibility; the buyer React tree is the eventual
 *     target. The toggle still flips the ?layer= query so bookmarks persist.
 *   - `layer=lawyer` → `report.htmlLawyer` (or `report.report_html_lawyer`)
 *     raw HTML. Falls back to the buyer HTML with a yellow banner if the
 *     lawyer render isn't ready for this report (pre-V1.1 reports).
 *
 * Sprint 1 / PI-0 T5: replaces the prior inline LiveReport switch in
 * page.tsx with this component, then splits the inline-styled fallback
 * views into their own Tailwind components (ReportUnavailable.tsx,
 * ReportExpired.tsx).
 */

import { getReport, getReportExpiryFields, getReportHtml, getReportStatus, getReportLawyerId, getReportLawyerSignatureUrl, getReportSignedAt, isReportExpired } from "@/lib/db";
import {
  addReportAccessTokensToHtml,
  buildReportUrl,
  injectReportExpiryIntoHtml,
  injectLawyerSignatureBlock,
} from "@/lib/report-access";
import { FunnelTracker } from "@/components/FunnelTracker";
import ReportToolbarClient from "./ReportToolbarClient";
import ReportUnavailable from "./ReportUnavailable";
import ReportExpired from "./ReportExpired";

export const dynamic = "force-dynamic";

export type ReportLayer = "buyer" | "lawyer";

export interface ReportShellProps {
  reportId: string;
  token: string | undefined;
  currentLayer: ReportLayer;
}

export default async function ReportShell({
  reportId,
  token,
  currentLayer,
}: ReportShellProps) {
  try {
    const { report } = await getReport(reportId);

    // Layer selection: lawyer drill-down HTML wins on ?layer=lawyer when
    // available. Pre-v1.1 reports fall back to the buyer layer with a clear
    // banner so the link never 404s on old reports.
    let reportHtml: string | null;
    let renderedLayer: ReportLayer = currentLayer;
    if (currentLayer === "lawyer") {
      const lawyerHtml =
        typeof report?.htmlLawyer === "string"
          ? report.htmlLawyer
          : typeof report?.report_html_lawyer === "string"
            ? report.report_html_lawyer
            : null;
      if (lawyerHtml) {
        reportHtml = lawyerHtml;
      } else {
        reportHtml = getReportHtml(report);
        renderedLayer = "buyer";
      }
    } else {
      reportHtml = getReportHtml(report);
    }

    const expiry = getReportExpiryFields(report);

    if (!reportHtml) {
      return <ReportUnavailable reportId={reportId} status={getReportStatus(report) ?? "not_found"} />;
    }

    if (isReportExpired(expiry)) {
      return <ReportExpired reportId={reportId} expiresAt={expiry.expires_at} revokedAt={expiry.revoked_at} />;
    }

    const htmlWithTokens = addReportAccessTokensToHtml(reportHtml, reportId);
    const htmlWithExpiry = injectReportExpiryIntoHtml(htmlWithTokens, expiry.expires_at);

    // Inject lawyer-co-sign signature block if the report is Guaranteed-tier
    // and the advocate has already signed and uploaded a PDF.
    const lawyerId = getReportLawyerId(report);
    const signedAt = getReportSignedAt(report);
    const lawyerSignatureUrl = getReportLawyerSignatureUrl(report);
    let htmlWithSignature = htmlWithExpiry;
    if (lawyerId && signedAt && lawyerSignatureUrl) {
      // Fetch advocate details to render name, firm, license, photo.
      try {
        const { getLawyer } = await import("@/lib/db");
        const lawyer = await getLawyer(lawyerId);
        htmlWithSignature = injectLawyerSignatureBlock(htmlWithExpiry, {
          lawyerName: lawyer?.name ?? null,
          lawyerFirm: lawyer?.firm ?? null,
          lawyerLicense: lawyer?.license_number ?? null,
          lawyerEmail: lawyer?.email ?? null,
          lawyerPhotoUrl: lawyer?.photo_url ?? null,
          signedAt,
          signatureUrl: lawyerSignatureUrl,
        });
      } catch {
        // DB fetch for lawyer details is best-effort — the report renders
        // even if we can't load the advocate's profile.
      }
    }

    const tokenQuery = token ? `?token=${encodeURIComponent(token)}` : "";
    const layerQuery = currentLayer === "lawyer" ? (token ? `&layer=lawyer` : `?layer=lawyer`) : "";
    const pdfHref = `/api/report/${encodeURIComponent(reportId)}/pdf${tokenQuery}${layerQuery}`;
    const bundleHref = `/api/report/${encodeURIComponent(reportId)}/bundle${tokenQuery}`;

    return (
      <>
        <FunnelTracker event="report_delivered" reportId={reportId} />
        <ReportToolbarClient
          reportId={reportId}
          pdfHref={pdfHref}
          bundleHref={bundleHref}
          currentLayer={renderedLayer}
        />
        <style>{`@media print { [data-testid="report-toolbar"] { display: none !important; } }`}</style>
        {renderedLayer !== currentLayer && (
          <div
            data-testid="layer-fallback-banner"
            role="status"
            className="mx-auto my-3 max-w-[720px] rounded border border-[#f1c40f] bg-[#fff8e1] px-4 py-2.5 font-[system-ui,sans-serif] text-[13px] text-[#5c4a00]"
          >
            The lawyer drill-down is not yet available for this report. Showing the buyer's read instead.
          </div>
        )}
        <div dangerouslySetInnerHTML={{ __html: htmlWithSignature }} />
        {/* Direct-link helper shown only when the buyer is on the expired/unavailable path.
            Not rendered here — ReportExpired surfaces it on its own branch. */}
        {renderedLayer === "buyer" ? (
          <span data-testid="report-direct-link" className="hidden">
            {buildReportUrl(reportId)}
          </span>
        ) : null}
      </>
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load report.";
    return <ReportUnavailable reportId={reportId} status="error" message={message} />;
  }
}