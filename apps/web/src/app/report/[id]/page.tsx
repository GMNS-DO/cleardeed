/**
 * ClearDeed — Consumer Report Page
 *
 * Route: /report/[id]
 * Renders a consumer-facing property due-diligence report.
 *
 * Demo mode: renders A10 with the golden-path fixture instantly.
 * Live mode: calls the pipeline directly with fixture coordinates.
 *
 * Sprint 5: server-side expiry gate. If a paid report is past its expires_at
 * (or has been revoked), the page renders an "expired" view with a
 * "Pay ₹299 to refresh" button instead of the cached report body. The
 * refresh is handled by POST /api/reports/:id/refresh and the webhook
 * bumps expires_at without re-running the pipeline.
 */

import { CONSUMER_REPORT_FIXTURE } from "@cleardeed/consumer-report-writer/fixtures/golden-path";
import { getReport, isReportExpired } from "@/lib/db";
import {
  addReportAccessTokensToHtml,
  injectReportExpiryIntoHtml,
  isReportViewAuthorized,
  buildReportUrl,
} from "@/lib/report-access";
import { FunnelTracker } from "@/components/FunnelTracker";
import RefreshButtonClient from "./RefreshButtonClient";

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
        expiresAt?: string | null;
        revokedAt?: string | null;
      } | null;
    };

    if (!report?.html) {
      return <ReportUnavailable reportId={reportId} status={report?.status ?? "not_found"} />;
    }

    // Sprint 5: server-side expiry gate.
    if (isReportExpired({
      expires_at: report.expiresAt ?? null,
      revoked_at: report.revokedAt ?? null,
    })) {
      return <ReportExpired reportId={reportId} expiresAt={report.expiresAt ?? null} revokedAt={report.revokedAt ?? null} />;
    }

    const htmlWithTokens = addReportAccessTokensToHtml(report.html, reportId);
    const htmlWithExpiry = injectReportExpiryIntoHtml(htmlWithTokens, report.expiresAt ?? null);

    return (
      <>
        <FunnelTracker event="report_delivered" reportId={reportId} />
        <div dangerouslySetInnerHTML={{ __html: htmlWithExpiry }} />
      </>
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load report.";
    return <ReportUnavailable reportId={reportId} status="error" message={message} />;
  }
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
    <main
      style={{
        minHeight: "100vh",
        background: "#f7f7f2",
        color: "#17231d",
        fontFamily: "system-ui, sans-serif",
        padding: "32px 20px",
      }}
    >
      <section
        style={{
          maxWidth: "720px",
          margin: "0 auto",
          background: "#fff",
          border: "1px solid #d9ddd4",
          padding: "24px",
        }}
      >
        <p
          style={{
            color: "#8a5f1d",
            fontWeight: 700,
            textTransform: "uppercase",
            fontSize: "13px",
          }}
        >
          ClearDeed report
        </p>
        <h1 style={{ fontSize: "28px", margin: "8px 0 12px" }}>
          Report not available yet
        </h1>
        <p>
          Report <strong>{reportId}</strong> is currently <strong>{status}</strong>. It
          may still be generating, held for review, or unavailable because report
          persistence is not configured.
        </p>
        {message ? (
          <pre
            style={{
              whiteSpace: "pre-wrap",
              background: "#f7f7f2",
              border: "1px solid #d9ddd4",
              padding: "12px",
              marginTop: "16px",
            }}
          >
            {message}
          </pre>
        ) : null}
      </section>
    </main>
  );
}

// ── Expired report view (Sprint 5) ─────────────────────────────────────────────

const REFRESH_PRICE_INR = 299;
const REFRESH_WINDOW_DAYS = 60;

function ReportExpired({
  reportId,
  expiresAt,
  revokedAt,
}: {
  reportId: string;
  expiresAt: string | null;
  revokedAt: string | null;
}) {
  const isRevoked = Boolean(revokedAt);
  const expiredOnLabel = isRevoked ? formatIndianDate(revokedAt) : formatIndianDate(expiresAt);
  const refreshUrl = `/api/reports/${encodeURIComponent(reportId)}/refresh`;

  return (
    <main
      data-testid="report-expired"
      style={{
        minHeight: "100vh",
        background: "#f7f7f2",
        color: "#17231d",
        fontFamily: "system-ui, sans-serif",
        padding: "32px 20px",
      }}
    >
      <section
        style={{
          maxWidth: "640px",
          margin: "0 auto",
          background: "#fff",
          border: "1px solid #d9ddd4",
          padding: "28px 24px",
        }}
      >
        <p
          style={{
            color: "#8a5f1d",
            fontWeight: 700,
            textTransform: "uppercase",
            fontSize: "13px",
            margin: 0,
          }}
        >
          ClearDeed report
        </p>
        <h1 style={{ fontSize: "26px", margin: "8px 0 12px", lineHeight: 1.2 }}>
          Your 60-day report access has ended
        </h1>
        <p style={{ marginTop: 0, color: "#3b4a3f" }}>
          {isRevoked ? (
            <>
              This report was revoked on <strong>{expiredOnLabel}</strong>. The
              underlying cached report body is no longer served. If you believe this
              is a mistake, contact support.
            </>
          ) : (
            <>
              This report was paid for and its {REFRESH_WINDOW_DAYS}-day access window
              ended on <strong>{expiredOnLabel}</strong>. Government records change
              — to keep using this report, refresh it for another {` ${REFRESH_WINDOW_DAYS} `}
              days.
            </>
          )}
        </p>

        <div
          style={{
            background: "#f7f7f2",
            border: "1px solid #d9ddd4",
            padding: "16px",
            margin: "20px 0",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "baseline",
              marginBottom: "8px",
            }}
          >
            <strong style={{ fontSize: "15px" }}>Refresh this report</strong>
            <span style={{ fontSize: "22px", fontWeight: 700 }}>₹{REFRESH_PRICE_INR}</span>
          </div>
          <p style={{ margin: 0, color: "#3b4a3f", fontSize: "14px" }}>
            Re-runs the same checks against current public records and re-validates
            ownership, encumbrance, and zoning signals.
          </p>
          <p style={{ margin: "8px 0 0", color: "#3b4a3f", fontSize: "13px" }}>
            Report ID:{" "}
            <code
              style={{
                background: "#fff",
                padding: "0 4px",
                border: "1px solid #d9ddd4",
              }}
            >
              {reportId}
            </code>
          </p>
        </div>

        <RefreshButtonClient reportId={reportId} refreshUrl={refreshUrl} />

        <p style={{ marginTop: "20px", color: "#6b7770", fontSize: "12px" }}>
          Already paid? Hard-refresh this page (Cmd/Ctrl + Shift + R) after
          payment — your access window resets the moment the webhook fires.
        </p>
        <p style={{ marginTop: "12px", color: "#6b7770", fontSize: "12px" }}>
          Direct link: <code>{buildReportUrl(reportId)}</code>
        </p>
      </section>
    </main>
  );
}

function formatIndianDate(iso: string | null): string {
  if (!iso || iso === "—") return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}