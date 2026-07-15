/**
 * ClearDeed — Supabase DB client
 *
 * Connection via environment variables:
 *   NEXT_PUBLIC_SUPABASE_URL   — e.g. https://xxx.supabase.co
 *   NEXT_PUBLIC_SUPABASE_ANON_KEY — anon key (public, RLS-gated)
 *   SUPABASE_SERVICE_ROLE_KEY  — service role (server-side only, bypasses RLS)
 *
 * The anon key is safe for client-side use. RLS policies enforce access control.
 * Use the service role only in API routes where you need to bypass RLS.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// ── Client-side (browser) ─────────────────────────────────────────────────────

let _client: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient {
  if (_client) return _client;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      "Missing Supabase environment variables. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY."
    );
  }

  _client = createClient(url, anonKey, {
    auth: { persistSession: false },
  });

  return _client;
}

// ── Server-side (API routes) ──────────────────────────────────────────────────

let _serverClient: SupabaseClient | null = null;

export function getSupabaseServerClient(): SupabaseClient {
  if (_serverClient) return _serverClient;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      "Missing Supabase environment variables. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY."
    );
  }

  _serverClient = createClient(url, serviceRoleKey, {
    auth: { persistSession: false },
  });

  return _serverClient;
}

// ── Convenience wrappers for common operations ───────────────────────────────────

/**
 * Server-side admin client (bypasses RLS). Use in API routes only.
 * Shorthand for getSupabaseServerClient().
 */
export function supabaseAdmin(): SupabaseClient {
  return getSupabaseServerClient();
}

export interface DbReport {
  id: string;
  user_id: string | null;
  userId?: string | null;
  created_at: string;
  updated_at: string;
  gps_lat: number;
  gps_lon: number;
  claimed_owner_name: string;
  father_husband_name: string | null;
  plot_description: string | null;
  report_html: string | null;
  html?: string | null;
  report_html_lawyer: string | null;
  htmlLawyer?: string | null;
  report_title: string | null;
  title?: string | null;
  report_status: string;
  status?: string | null;
  nominatim_status: string | null;
  nominatimStatus?: string | null;
  bhunaksha_status: string | null;
  bhunakshaStatus?: string | null;
  bhulekh_status: string | null;
  bhulekhStatus?: string | null;
  ecourts_status: string | null;
  ecourtsStatus?: string | null;
  rccms_status: string | null;
  rccmsStatus?: string | null;
  validation_findings: unknown[];
  validationFindings?: unknown[];
  error_message: string | null;
  errorMessage?: string | null;
  source_summary: Record<string, unknown>;
  sourceSummary?: Record<string, unknown>;
  expires_at: string | null;
  expiresAt?: string | null;
  revoked_at: string | null;
  revokedAt?: string | null;
  // Migration 019: paid tier
  paid_tier: string | null;
  paidTier?: string | null;
  paid_order_id: string | null;
  paidOrderId?: string | null;
  price_paid_paise: number | null;
  pricePaidPaise?: number | null;
  paid_at: string | null;
  paidAt?: string | null;
  // Migration 020: V1.1 dropdown inputs
  tehsil: string | null;
  tehsil_code: string | null;
  village: string | null;
  village_code: string | null;
  plot_no: string | null;
  search_mode: string | null;
  v11Inputs?: {
    tehsil?: string | null;
    tehsilCode?: string | null;
    village?: string | null;
    villageCode?: string | null;
    plotNo?: string | null;
    searchMode?: string | null;
    pdpdAccepted?: boolean | null;
  } | null;
  // Migration 025: pipeline outcome for consumer-facing error UX
  pipeline_status?: "queued" | "running" | "success" | "failed" | "generated_with_error" | null;
  pipelineStatus?: "queued" | "running" | "success" | "failed" | "generated_with_error" | null;
  pipeline_error?: string | null;
  pipelineError?: string | null;
  pipeline_completed_at?: string | null;
  pipelineCompletedAt?: string | null;
}

/**
 * Pure helper: is this report past its paid validity window?
 * - revokedAt set → expired (admin revoked)
 * - expiresAt NULL → never expires (legacy / pre-Sprint 5 reports)
 * - expiresAt in the past → expired
 */
export function isReportExpired(report: { expires_at: string | null; revoked_at: string | null }, now: Date = new Date()): boolean {
  if (report.revoked_at) return true;
  if (!report.expires_at) return false;
  return new Date(report.expires_at).getTime() <= now.getTime();
}

export type ReportLike = Partial<DbReport> | null | undefined;

function nullableString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

export function getReportHtml(report: ReportLike): string | null {
  return nullableString(report?.html) ?? nullableString(report?.report_html);
}

export function getReportTitle(report: ReportLike): string | null {
  return nullableString(report?.title) ?? nullableString(report?.report_title);
}

export function getReportStatus(report: ReportLike): string | null {
  return nullableString(report?.status) ?? nullableString(report?.report_status);
}

export function getReportErrorMessage(report: ReportLike): string | null {
  return nullableString(report?.errorMessage) ?? nullableString(report?.error_message);
}

export function getReportBhulekhStatus(report: ReportLike): string | null {
  return nullableString(report?.bhulekhStatus) ?? nullableString(report?.bhulekh_status);
}

export function getReportSourceSummary(report: ReportLike): Record<string, unknown> | null {
  const camel = report?.sourceSummary;
  if (camel && typeof camel === "object" && !Array.isArray(camel)) return camel as Record<string, unknown>;
  const snake = report?.source_summary;
  if (snake && typeof snake === "object" && !Array.isArray(snake)) return snake as Record<string, unknown>;
  return null;
}

export function getReportExpiresAt(report: ReportLike): string | null {
  return nullableString(report?.expiresAt) ?? nullableString(report?.expires_at);
}

export function getReportRevokedAt(report: ReportLike): string | null {
  return nullableString(report?.revokedAt) ?? nullableString(report?.revoked_at);
}

export function getReportExpiryFields(report: ReportLike): { expires_at: string | null; revoked_at: string | null } {
  return {
    expires_at: getReportExpiresAt(report),
    revoked_at: getReportRevokedAt(report),
  };
}

/** Read the pipeline outcome flag. Null / missing means not yet completed. */
export function getPipelineStatus(report: ReportLike): string | null {
  const raw = report?.pipelineStatus ?? report?.pipeline_status ?? null;
  if (raw && ["queued","running","success","failed","generated_with_error"].includes(raw)) return raw;
  return null;
}

/** Pipeline error string, only meaningful when getPipelineStatus is "failed" or "generated_with_error". */
export function getPipelineError(report: ReportLike): string | null {
  return typeof report?.pipeline_error === "string" && report.pipeline_error.length > 0
    ? report.pipeline_error
    : typeof report?.pipelineError === "string" && report.pipelineError.length > 0
      ? report.pipelineError
      : null;
}
export function getReportOwnerId(report: ReportLike): string | null {
  return nullableString(report?.userId) ?? nullableString(report?.user_id);
}

export interface CreateReportParams {
  gpsLat: number;
  gpsLon: number;
  claimedOwnerName: string;
  fatherHusbandName?: string;
  plotDescription?: string;
  /** T-013: optional auth.uid() — null means anonymous purchase (legacy). */
  userId?: string | null;
}

export interface SourceResultParams {
  reportId: string;
  sourceName: string;
  status: "success" | "partial" | "failed" | "error" | "not_covered";
  fetchedAt: string;
  parsedData?: Record<string, unknown>;
  rawResponse?: string;
  errorMessage?: string;
  durationMs?: number;
}

export interface UpdateReportParams {
  reportId: string;
  reportHtml: string;
  reportHtmlLawyer?: string | null;
  reportTitle: string;
  nominatimStatus?: string;
  bhunakshaStatus?: string;
  bhulekhStatus?: string;
  ecourtsStatus?: string;
  rccmsStatus?: string;
  validationFindings?: unknown[];
  sourceSummary?: Record<string, unknown>;
  errorMessage?: string;
}

export interface CreateLeadRequestParams {
  buyerName: string;
  phone: string;
  userType: string;
  locationText?: string;
  gpsLat?: number;
  gpsLon?: number;
  claimedOwnerName?: string;
  plotDescription?: string;
  notes?: string;
  source?: string;
  utm?: Record<string, unknown>;
}

export interface DbLeadRequest {
  id: string;
  created_at: string;
  updated_at: string;
  buyer_name: string;
  phone: string;
  user_type: string;
  location_text: string | null;
  gps_lat: number | null;
  gps_lon: number | null;
  claimed_owner_name: string | null;
  plot_description: string | null;
  notes: string | null;
  status: string;
  source: string;
  utm: Record<string, unknown>;
}

/**
 * Create a new report record. Returns the report ID.
 */
export async function createReport(params: CreateReportParams): Promise<{ reportId: string; status: string }> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase.rpc("create_report", {
    p_gps_lat: params.gpsLat,
    p_gps_lon: params.gpsLon,
    p_claimed_owner_name: params.claimedOwnerName,
    p_father_husband_name: params.fatherHusbandName ?? null,
    p_plot_description: params.plotDescription ?? null,
    p_user_id: params.userId ?? null,
  });

  if (error) throw new Error(`create_report failed: ${error.message}`);
  return data as { reportId: string; status: string };
}

/**
 * Persist V1.1 dropdown inputs on a report row so the lawyer dashboard rerun
 * button can replay the exact tehsil/village/identifier the user picked.
 *
 * Migration 020 introduced these columns + the set_v11_inputs RPC. Without
 * persistence, the rerun route reads the report, sees null tehsil/village, and
 * returns V11_RERUN_UNSUPPORTED.
 */
export async function setReportV11Inputs(params: {
  reportId: string;
  tehsil?: string;
  tehsilCode?: string;
  village?: string;
  villageCode?: string;
  plotNo?: string;
  searchMode?: string;
  tier?: string;
}): Promise<void> {
  const supabase = getSupabaseServerClient();
  const { error } = await supabase.rpc("set_v11_inputs", {
    p_report_id: params.reportId,
    p_tehsil: params.tehsil ?? null,
    p_tehsil_code: params.tehsilCode ?? null,
    p_village: params.village ?? null,
    p_village_code: params.villageCode ?? null,
    p_plot_no: params.plotNo ?? null,
    p_search_mode: params.searchMode ?? null,
    p_tier: params.tier ?? null,
  });

  if (error) throw new Error(`set_v11_inputs failed: ${error.message}`);
}

/**
 * Upsert a source result for a report.
 */
export async function upsertSourceResult(params: SourceResultParams): Promise<void> {
  const supabase = getSupabaseServerClient();
  const { error } = await supabase.rpc("upsert_source_result", {
    p_report_id: params.reportId,
    p_source_name: params.sourceName,
    p_status: params.status,
    p_fetched_at: params.fetchedAt,
    p_parsed_data: params.parsedData ?? null,
    p_raw_response: params.rawResponse ?? null,
    p_error_message: params.errorMessage ?? null,
    p_duration_ms: params.durationMs ?? null,
  });

  if (error) throw new Error(`upsert_source_result failed: ${error.message}`);
}

/**
 * Update report with pipeline results (HTML, status, source summaries).
 */
export async function updateReportResults(params: UpdateReportParams): Promise<void> {
  const supabase = getSupabaseServerClient();
  // Supabase types `rpc` with two overloads (10-param and 11-param). The
  // 11-param overload is required because the production DB schema includes
  // `p_report_html_lawyer`. We always supply it (empty string when absent)
  // so the runtime call always matches the 11-param shape; the TS cast
  // forces TypeScript to pick that overload.
  const rpcArgs: {
    p_report_id: string;
    p_report_html: string;
    p_report_title: string;
    p_nominatim_status: string | null;
    p_bhunaksha_status: string | null;
    p_bhulekh_status: string | null;
    p_ecourts_status: string | null;
    p_rccms_status: string | null;
    p_validation_findings: unknown[];
    p_source_summary: Record<string, unknown>;
    p_error_message: string | null;
    p_report_html_lawyer: string;
  } = {
    p_report_id: params.reportId,
    p_report_html: params.reportHtml,
    p_report_title: params.reportTitle,
    p_nominatim_status: params.nominatimStatus ?? null,
    p_bhunaksha_status: params.bhunakshaStatus ?? null,
    p_bhulekh_status: params.bhulekhStatus ?? null,
    p_ecourts_status: params.ecourtsStatus ?? null,
    p_rccms_status: params.rccmsStatus ?? null,
    p_validation_findings: params.validationFindings ?? [],
    p_source_summary: params.sourceSummary ?? {},
    p_error_message: params.errorMessage ?? null,
    p_report_html_lawyer: params.reportHtmlLawyer ?? "",  // always present — uniform signature for overload resolution
  };

  const { error } = await supabase.rpc("update_report_results", rpcArgs);

  if (error) throw new Error(`update_report_results failed: ${error.message}`);
}

/**
 * Fetch a report by ID (with all source results).
 */
export async function getReport(reportId: string): Promise<{ report: DbReport | null; sources: unknown[] }> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase.rpc("get_report", { p_report_id: reportId });

  if (error) throw new Error(`get_report failed: ${error.message}`);
  return data as { report: DbReport | null; sources: unknown[] };
}

/**
 * Bump a report's expires_at by 60 days. Used by the pay-to-refresh flow.
 * Does NOT re-run the fetcher pipeline — just refreshes the timestamp so the
 * cached report body stays valid.
 *
 * The update is best-effort; if it fails (table column missing, no row, etc.)
 * we still want the webhook to return 200 so Razorpay doesn't retry forever.
 */
export async function bumpReportExpiry(reportId: string): Promise<{ expiresAt: string | null }> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("reports")
    .update({ expires_at: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString() })
    .eq("id", reportId)
    .select("expires_at")
    .single();

  if (error) {
    console.warn(`[bumpReportExpiry] ${reportId}: ${error.message}`);
    return { expiresAt: null };
  }
  return { expiresAt: (data as { expires_at?: string } | null)?.expires_at ?? null };
}

/**
 * Update the pipeline_status column on a report row. Idempotent — callers
 * can overwrite a previous status (e.g. queued → running → success).
 */
export async function setPipelineStatus(params: {
  reportId: string;
  pipelineStatus: "queued" | "running" | "success" | "failed" | "generated_with_error";
  pipelineError?: string | null;
}): Promise<void> {
  const supabase = getSupabaseServerClient();
  const { error } = await supabase
    .from("reports")
    .update({
      pipeline_status: params.pipelineStatus,
      pipeline_error: params.pipelineError ?? null,
      pipeline_completed_at: new Date().toISOString(),
    })
    .eq("id", params.reportId);
  if (error) throw new Error(`setPipelineStatus failed: ${error.message}`);
}

/**
 * T-014: Mark a report as paid. Called from the Razorpay webhook after
 * payment.captured is verified. Wraps the mark_report_paid() RPC defined
 * in migration 019 — the RPC enforces idempotency (refuses to downgrade
 * an already-paid tier or change price).
 *
 * Errors are surfaced so the webhook handler can decide whether to retry.
 * Never silently no-ops on RPC failure.
 */
export async function markReportPaid(params: {
  reportId: string;
  paidTier: string;
  pricePaidPaise: number;
  paidAt: string;
  paidOrderId: string;
}): Promise<void> {
  const supabase = getSupabaseServerClient();
  const { error } = await supabase.rpc("mark_report_paid", {
    p_report_id: params.reportId,
    p_paid_tier: params.paidTier,
    p_price_paid_paise: params.pricePaidPaise,
    p_paid_at: params.paidAt,
    p_paid_order_id: params.paidOrderId,
  });

  if (error) {
    throw new Error(`mark_report_paid failed for ${params.reportId}: ${error.message}`);
  }
}

/**
 * Look up the lawyer record attached to a report. Used by the lawyer co-sign
 * UI in ReportShell. Returns null when no lawyer is attached — the UI renders
 * a "no lawyer on file" state in that case.
 */
export async function getLawyer(reportId: string): Promise<{
  lawyerName: string;
  lawyerFirm: string;
  licenseNumber?: string | null;
  email?: string | null;
  photoUrl?: string | null;
  signedAt: string | null;
}> | null {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("reports")
    .select("lawyer_name, lawyer_firm, lawyer_signed_at")
    .eq("id", reportId)
    .maybeSingle();
  if (error || !data) return null;
  const row = data as Record<string, unknown>;
  return {
    lawyerName: (row.lawyer_name as string) ?? "",
    lawyerFirm: (row.lawyer_firm as string) ?? "",
    licenseNumber: (row.lawyer_license_number as string | undefined) ?? null,
    email: (row.lawyer_email as string | undefined) ?? null,
    photoUrl: (row.lawyer_photo_url as string | undefined) ?? null,
    lawyerSignedAt: (row.lawyer_signed_at as string | null) ?? null,
  };
}

/**
 * T-014: Count paid reports for a user. Wraps the count_user_paid_reports()
 * RPC defined in migration 019. Used by decideMetering() in the /api/report/create
 * gate to enforce FREE_PREVIEW_LIMIT_PER_USER.
 *
 * Returns 0 if userId is null (anonymous requests get the default free preview
 * without metering). Returns 0 if the RPC errors — best-effort, never blocks
 * report creation on a count failure.
 */
export async function countUserPaidReports(userId: string | null): Promise<number> {
  if (!userId) return 0;
  try {
    const supabase = getSupabaseServerClient();
    const { data, error } = await supabase.rpc("count_user_paid_reports", {
      p_user_id: userId,
    });
    if (error) {
      console.warn(`[countUserPaidReports] ${userId}: ${error.message} — returning 0`);
      return 0;
    }
    return typeof data === "number" ? data : 0;
  } catch (err) {
    console.warn(`[countUserPaidReports] threw for ${userId}:`, err);
    return 0;
  }
}

/**
 * Save a concierge-launch intake request.
 */
export async function createLeadRequest(params: CreateLeadRequestParams): Promise<{ id: string }> {
  const supabase = getSupabaseServerClient();
  const leadPayload = {
    buyer_name: params.buyerName,
    phone: params.phone,
    user_type: params.userType,
    location_text: params.locationText ?? null,
    gps_lat: params.gpsLat ?? null,
    gps_lon: params.gpsLon ?? null,
    claimed_owner_name: params.claimedOwnerName ?? null,
    plot_description: params.plotDescription ?? null,
    notes: params.notes ?? null,
    source: params.source ?? "website",
    utm: params.utm ?? {},
  };

  const { data, error } = await supabase
    .from("lead_requests")
    .insert(leadPayload)
    .select("id")
    .single();

  if (error) {
    const { data: fallbackData, error: fallbackError } = await supabase
      .from("audit_log")
      .insert({
        event_type: "lead_request",
        event_data: leadPayload,
      })
      .select("id")
      .single();

    if (fallbackError) {
      throw new Error(`createLeadRequest failed: ${error.message}; fallback failed: ${fallbackError.message}`);
    }

    return fallbackData as { id: string };
  }

  return data as { id: string };
}

/**
 * Concierge admin: latest intake requests.
 */
export async function listLeadRequests(limit = 50): Promise<DbLeadRequest[]> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("lead_requests")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(`listLeadRequests failed: ${error.message}`);
  return (data ?? []) as DbLeadRequest[];
}

/**
 * Concierge admin: latest generated reports.
 */
export async function listRecentReports(limit = 50): Promise<DbReport[]> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("reports")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(`listRecentReports failed: ${error.message}`);
  return (data ?? []) as DbReport[];
}
