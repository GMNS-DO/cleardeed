/**
 * ClearDeed — Consumer Report Page
 *
 * Route: /report/[id]
 * Renders a consumer-facing property due-diligence report.
 *
 * Demo mode: renders A10 with the golden-path fixture instantly.
 * Live mode: calls the pipeline directly with fixture coordinates.
 */

import { CONSUMER_REPORT_FIXTURE } from "@cleardeed/consumer-report-writer/fixtures/golden-path";
import { getReport } from "@/lib/db";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ demo?: string }>;
}

export default async function ReportPage({ params, searchParams }: PageProps) {
  const { id: reportId } = await params;
  const { demo: demoFlag } = await searchParams;
  const isDemoMode = demoFlag === "true" || reportId.startsWith("CLD-DEMO");

  if (isDemoMode) {
    return <DemoReport />;
  }

  return <LiveReport reportId={reportId} />;
}

// ── Live report ────────────────────────────────────────────────────────────────

async function LiveReport({ reportId }: { reportId: string }) {
  try {
    const { report } = await getReport(reportId) as {
      report?: {
        html?: string | null;
        status?: string | null;
        title?: string | null;
        errorMessage?: string | null;
      } | null;
    };

    if (!report?.html) {
      return <ReportUnavailable reportId={reportId} status={report?.status ?? "not_found"} />;
    }

    return <div dangerouslySetInnerHTML={{ __html: report.html }} />;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load report.";
    return <ReportUnavailable reportId={reportId} status="error" message={message} />;
  }
}

// ── Demo report ───────────────────────────────────────────────────────────────

async function DemoReport() {
  const { generateConsumerReport } = await import("@cleardeed/consumer-report-writer");

  const fixtureInput = {
    ...CONSUMER_REPORT_FIXTURE,
    gpsCoordinates: { latitude: 20.272688, longitude: 85.701271 },
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { html } = generateConsumerReport(fixtureInput as any);

  return (
    <div dangerouslySetInnerHTML={{ __html: html }} />
  );
}

function ReportUnavailable({
  reportId,
  status,
  message,
}: {
  reportId: string;
  status: string;
  message?: string;
}) {
  return (
    <main style={{
      minHeight: "100vh",
      background: "#f7f7f2",
      color: "#17231d",
      fontFamily: "system-ui, sans-serif",
      padding: "32px 20px",
    }}>
      <section style={{
        maxWidth: "720px",
        margin: "0 auto",
        background: "#fff",
        border: "1px solid #d9ddd4",
        padding: "24px",
      }}>
        <p style={{ color: "#8a5f1d", fontWeight: 700, textTransform: "uppercase", fontSize: "13px" }}>
          ClearDeed report
        </p>
        <h1 style={{ fontSize: "28px", margin: "8px 0 12px" }}>Report not available yet</h1>
        <p>
          Report <strong>{reportId}</strong> is currently <strong>{status}</strong>. It may still be generating,
          held for review, or unavailable because report persistence is not configured.
        </p>
        {message ? (
          <pre style={{
            whiteSpace: "pre-wrap",
            background: "#f7f7f2",
            border: "1px solid #d9ddd4",
            padding: "12px",
            marginTop: "16px",
          }}>{message}</pre>
        ) : null}
      </section>
    </main>
  );
}
