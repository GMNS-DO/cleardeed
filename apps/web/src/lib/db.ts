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

export interface DbReport {
  id: string;
  user_id: string | null;
  created_at: string;
  updated_at: string;
  gps_lat: number;
  gps_lon: number;
  claimed_owner_name: string;
  father_husband_name: string | null;
  plot_description: string | null;
  report_html: string | null;
  report_title: string | null;
  report_status: string;
  nominatim_status: string | null;
  bhunaksha_status: string | null;
  bhulekh_status: string | null;
  ecourts_status: string | null;
  rccms_status: string | null;
  validation_findings: unknown[];
  error_message: string | null;
  source_summary: Record<string, unknown>;
}

export interface CreateReportParams {
  gpsLat: number;
  gpsLon: number;
  claimedOwnerName: string;
  fatherHusbandName?: string;
  plotDescription?: string;
  userId?: string;
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
  const { error } = await supabase.rpc("update_report_results", {
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
  });

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
