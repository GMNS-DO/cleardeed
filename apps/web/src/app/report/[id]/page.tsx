/**
 * ClearDeed — Consumer Report Page
 *
 * Route: /report/[id]
 * Renders a consumer-facing property due-diligence report.
 *
 * Demo mode: renders A10 with the golden-path fixture instantly.
 * Live mode: delegates to ReportShell, which owns all report-lifecycle branches
 * (unauthorized/unavailable/expired/live) and the layer toggle.
 *
 * This file is intentionally thin — all styling lives in the wrapper components
 * (ReportShell, ReportToolbarClient, ReportUnavailable, ReportExpired) so the
 * CRED `<style>` block inside the report blob wins the cascade (REPORT-SHELL-
 * REDESIGN-PI / PR 1 fix).
 */

import { CONSUMER_REPORT_FIXTURE } from "@cleardeed/consumer-report-writer/fixtures/golden-path";
import { getReport } from "@/lib/db";
import { PipelineFailedBanner } from "@/components/PipelineFailedBanner";
import {
  isReportViewAuthorized,
} from "@/lib/report-access";
import ReportShell from "./ReportShell";
import ReportUnavailable from "./ReportUnavailable";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ demo?: string; token?: string }>;
}

export default async function ReportPage({ params, searchParams }: PageProps) {
  const { id: reportId } = await params;
  const { demo: demoFlag, token } = await searchParams;
  const isDemoMode = demoFlag === "true" || reportId.startsWith("CLD-DEMO");

  if (isDemoMode) {
    return <DemoReport />;
  }

  if (!isReportViewAuthorized(reportId, token)) {
    return <ReportUnavailable reportId={reportId} status="unauthorized" message="This report link is missing or has an invalid access token." />;
  }

  // Delegate all live-report rendering (lifecycle, layer toggle, toolbar, etc.)
  // to ReportShell. ReportShell handles unavailable/expired branches and the
  // lawyer layer fallback. It passes pdfHref + bundleHref to ReportToolbarClient,
  // which owns the toolbar actions.
  return <LiveReport reportId={reportId} token={token} />;
}

// ── Live report ────────────────────────────────────────────────────────────────

async function LiveReport({ reportId, token }: { reportId: string; token: string | undefined }) {
  const { report } = await getReport(reportId);
  const pipelineStatus = report?.pipeline_status as string | undefined;
  const pipelineError = (report?.pipeline_error as string | undefined) ?? null;
  const bhulekhStatus = (report?.bhulekh_status as string | undefined) ?? null;
  const showPipelineFailedBanner =
    pipelineStatus === "failed" || pipelineStatus === "generated_with_error";

  return (
    <>
      {showPipelineFailedBanner && (
        <PipelineFailedBanner
          reportId={reportId}
          statusReason={pipelineError}
          bhulekhStatus={bhulekhStatus}
        />
      )}
      <ReportShell reportId={reportId} token={token} currentLayer="buyer" />
    </>
  );
}

// ── Demo report ───────────────────────────────────────────────────────────────

async function DemoReport() {
  const { generateBuyerLayerReport } = await import("@cleardeed/consumer-report-writer");

  const fixtureInput = {
    ...CONSUMER_REPORT_FIXTURE,
    gpsCoordinates: { latitude: 20.272688, longitude: 85.701271 },
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { html } = generateBuyerLayerReport(fixtureInput as any);

  return <div dangerouslySetInnerHTML={{ __html: html }} />;
}
