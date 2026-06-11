import crypto from "node:crypto";

const TOKEN_VERSION = "v1";

function getReportAccessSecret(): string | null {
  return (
    process.env.REPORT_VIEW_SECRET ||
    process.env.REPORT_CREATE_TOKEN ||
    process.env.ADMIN_VIEW_TOKEN ||
    process.env.RAZORPAY_WEBHOOK_SECRET ||
    process.env.RAZORPAY_KEY_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    null
  );
}

function shouldRequireToken(): boolean {
  return Boolean(process.env.VERCEL || process.env.NODE_ENV === "production");
}

function timingSafeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

export function createReportViewToken(reportId: string): string | null {
  const secret = getReportAccessSecret();
  if (!secret) return null;

  const digest = crypto
    .createHmac("sha256", secret)
    .update(reportId)
    .digest("base64url");

  return `${TOKEN_VERSION}.${digest}`;
}

export function isReportViewAuthorized(reportId: string, token?: string | null): boolean {
  if (reportId.startsWith("CLD-DEMO")) return true;

  const expected = createReportViewToken(reportId);
  if (!expected) return !shouldRequireToken();
  if (!token) return false;
  return timingSafeEqual(token, expected);
}

export function buildReportUrl(reportId: string, baseUrl = ""): string {
  const normalizedBaseUrl = baseUrl.replace(/\/+$/, "");
  const path = `/report/${encodeURIComponent(reportId)}`;
  const token = createReportViewToken(reportId);
  const query = token ? `?token=${encodeURIComponent(token)}` : "";
  return `${normalizedBaseUrl}${path}${query}`;
}

export function addReportAccessTokensToHtml(html: string, reportId: string): string {
  const token = createReportViewToken(reportId);
  if (!token) return html;

  const encodedToken = encodeURIComponent(token);
  const encodedReportId = reportId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  return html.replace(
    new RegExp(`href="/api/report/${encodedReportId}/pdf"`, "g"),
    `href="/api/report/${reportId}/pdf?token=${encodedToken}"`
  );
}
