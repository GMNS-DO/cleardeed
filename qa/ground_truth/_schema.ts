/**
 * qa/ground_truth/_schema.ts — TypeScript interface for ground-truth manifest.json
 *
 * The per-fetcher slice in each manifest IS the data object (not the full
 * contract envelope). This matches what the V2 contract tests
 * (`qa/fetcher_tests/_helper.ts`) expect: `fetcherSlice(manifest, "bhulekh")`
 * returns the slice, and `assertStructuralCorrectness(slice, fieldSchemas)`
 * walks the slice's direct properties looking for the documented fields
 * (`plotNo`, `village`, `tenants`, etc.).
 *
 * The full contract envelope (status, fetchedAt, sourceUrl, latencyMs, etc.)
 * is preserved as a `__contract` sub-object on each slice for documentation
 * and audit, but is *not* what the V2 tests look at.
 *
 * For V1 scaffolds (P006-P050), each fetcher slice is `null` (not yet
 * verified by the founder).
 */

export type ContractStatus =
  | "ok"
  | "no_data"
  | "source_down"
  | "invalid_input"
  | "parse_error";

export type PatternCategory = "numeric" | "d_prefix" | "fraction" | "alphanumeric";

export type KisamClass = "residential" | "agricultural" | "industrial" | "commercial";
export type BdaZoneId = "residential" | "commercial" | "industrial" | "green_belt" | "special" | "mixed_use" | "institutional";

/** Audit metadata attached to each populated slice. Not used by V2 contract tests. */
export interface ContractMeta {
  source: string;
  status: ContractStatus;
  fetchedAt: string;
  sourceUrl: string;
  latencyMs: number;
}

// ─── Per-fetcher data shapes (match V2 contract schemas) ────────────────────

export interface BhulekhLandDetail {
  surveyNo: string;
  area: number;
  unit: string;
  landClass: string;
  tenantName: string;
  fatherHusbandName?: string;
  share?: string;
}

export interface BhulekhData {
  plotNo: string;
  khataNo?: string;
  village: string;
  tenants: BhulekhLandDetail[];
  lastUpdated?: string;
}

export interface BhunakshaData {
  plotNo: string;
  village: string;
  tahasil: string;
  area?: number;
  areaUnit?: "sq_km";
}

export interface CourtCase {
  caseNo: string;
  caseType: string;
  court: string;
  status: string;
}

export interface EcourtsData { cases: CourtCase[]; total: number; }

export interface IgrEcEntry {
  docType?: string;
  docNo?: string;
  regDate?: string;
  party1?: string;
  party2?: string;
  propertyDesc?: string;
  consideration?: string;
}

export interface IgrEcData {
  ecAvailable: boolean;
  entries: IgrEcEntry[];
  sro?: string;
  district?: string;
}

export interface CersaiData {
  searchBy: "party" | "asset";
  partyName?: string;
  result: string;
  outcome: "clear" | "encumbered";
}

export interface RccmsData { cases: CourtCase[]; total: number; }

export interface CircleRateRow {
  mouza: string;
  tehsil: string;
  kisam: string;
  ratePerAcre: number;
  ratePerSqft: number;
  sourceUrl: string;
  lastUpdated: string;
  rateType: "rural" | "urban" | "peri-urban";
}

export interface CircleRateData { rows: CircleRateRow[]; }

export interface BdaZoneInfo {
  id: BdaZoneId;
  name: string;
  description: string;
  permittedUses: string[];
  restrictions: string[];
  zoneCode: string;
}

export interface BdaZoneRow {
  tehsil: string;
  village: string;
  locality?: string;
  zone: BdaZoneInfo;
  centroid: { latitude: number; longitude: number };
}

export interface BdaZoneData { rows: BdaZoneRow[]; }

export interface NominatimData {
  displayName: string;
  village?: string;
  tahasil?: string;
  district?: string;
  state?: string;
  postcode?: string;
  latitude: number;
  longitude: number;
}

// ─── Top-level manifest shape ───────────────────────────────────────────────

/**
 * The full ground-truth manifest. Each fetcher slice is a ContractEnvelope
 * (status: "ok" with typed data, OR a non-ok status with structured error).
 * For V1 scaffolds, fetcher slices are `null` (not yet verified).
 */
export interface GroundTruthManifest {
  plot_id: string;                                  // e.g. "P001"
  description: string;
  added_at: string;                                 // ISO 8601 date
  verified_by: "founder" | "pending";
  location: { latitude: number; longitude: number };

  /** Coverage tag used by the corpus matrix */
  coverage: {
    tahasil: string;
    tahasil_code: string;                           // Bhulekh code (1-10)
    village: string;
    pattern_category: PatternCategory;
    plot_no: string;
    bda_zone: BdaZoneId;
    kisam_class: KisamClass;
  };

  /**
   * Per-fetcher slices. Each is the *data* object (matching the V2 contract
   * data schema) with an optional `__contract` audit sub-object. `null` means
   * "not yet verified by founder".
   */
  fetchers: {
    bhulekh: (BhulekhData & { __contract?: ContractMeta }) | null;
    bhunaksha: (BhunakshaData & { __contract?: ContractMeta }) | null;
    ecourts: (EcourtsData & { __contract?: ContractMeta }) | null;
    "igr-ec": (IgrEcData & { __contract?: ContractMeta }) | null;
    cersai: (CersaiData & { __contract?: ContractMeta }) | null;
    rccms: (RccmsData & { __contract?: ContractMeta }) | null;
    "circle-rate": (CircleRateData & { __contract?: ContractMeta }) | null;
    "bda-zoning": (BdaZoneData & { __contract?: ContractMeta }) | null;
    nominatim: (NominatimData & { __contract?: ContractMeta }) | null;
  };

  /** Optional: what the report should produce for this plot. Filled in when founder verifies. */
  expected_outcomes?: {
    watch_outs: Array<{ flag: string; severity: "low" | "medium" | "high"; description: string }>;
    summary: { owner_name: string; land_class: string; area_acres: number; is_buildable: boolean; is_encumbered: boolean };
  } | null;

  /** URLs the founder visited during manual verification */
  sources_visited: string[];

  /** Path to transcript.md (relative to manifest directory) */
  transcript_path: string;
}
