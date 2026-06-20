/**
 * Typed "fire" gate per source.
 *
 * Replaces scattered `source.status === "success"` string checks across A10,
 * A11, and the orchestrator with a single source-of-truth predicate:
 * `isSourceFired(sourceId, envelope)`.
 *
 * The public surface (per the binding brief) is a discriminated union of
 * per-source envelope shapes. Each fired variant carries the *named* fields
 * the downstream consumer needs (e.g. `plotNo`, `khataNo`, `caseCount`) on
 * the envelope itself — not nested in a generic `data` property.
 *
 * A source "fires" when:
 *   1. The envelope's `status` field is `"ok"`.
 *   2. The envelope's `source` field matches the requested SourceId.
 *   3. The envelope's `data` field passes the per-source Zod contract schema
 *      AND a per-source liveness check (e.g. tenants for bhulekh, cases for
 *      ecourts, plotNo for bhunaksha).
 *
 * If any of those fail, the gate returns `{ fired: false, reason }` where
 * `reason` is one of the brief's five literal values:
 *   "no_data" | "source_down" | "invalid_input" | "parse_error" | "skipped_dormant"
 */
import { z } from "zod";

// ── Per-source Zod contract schemas (the canonical source of truth) ─────────
// These are the existing V2 contract schemas. Per the brief, we read them —
// not re-define them — so the gate stays in lockstep with the V2 contract.
import { BhulekhContract, BhulekhDataSchema } from "./bhulekh";
import { EcourtsContract, EcourtsDataSchema } from "./ecourts";
import { RccmsContract, RccmsDataSchema } from "./rccms";
import { IgrEcContract, IgrEcDataSchema } from "./igr-ec";
import { CersaiContract, CersaiDataSchema } from "./cersai";
import { IgrSroContract, IgrSroDataSchema } from "./igr-sro";
import { CircleRateContract, CircleRateDataSchema } from "./circle-rate";
import { BdaZoningContract, BdaZoningDataSchema } from "./bda-zoning";
import { IgrBmvContract, IgrBmvDataSchema } from "./igr-bmv";
import { StampDutyContract, StampDutyDataSchema } from "./stamp-duty";
import { IgrDailyBulletinContract, IgrDailyBulletinDataSchema } from "./igr-daily-bulletin";
import { PublicDashboardDataSchema } from "./public-dashboard";
import { GovtFeeDataSchema } from "./govt-fee";
import { CertifiedCopyDataSchema } from "./igr-certified-copy";
import { NominatimDataSchema } from "./nominatim";
import { BhunakshaDataSchema } from "./bhunaksha";
import { BhunakshaPlotReportDataSchema } from "./bhunaksha-plot-report";

// ── Source id union (21 entries per the brief) ──────────────────────────────
export const ALL_SOURCE_IDS = [
  "bhulekh",
  "ecourts",
  "rccms",
  "igr-ec",
  "rera",
  "cersai",
  "high-court",
  "drt",
  "bhunaksha",
  "nominatim",
  "bda-zoning",
  "circle-rate",
  "stamp-duty",
  "igr-bmv",
  "igr-daily-bulletin",
  "public-dashboard",
  "govt-fee",
  "igr-certified-copy",
  "igr-sro",
  "larr",
  "bhunaksha-plot-report",
  "bhuvan-flood",
  "eow",
] as const;
export type SourceId = (typeof ALL_SOURCE_IDS)[number];

// ── Reason literal union (per the brief) ────────────────────────────────────
export type FireReason =
  | "no_data"
  | "source_down"
  | "invalid_input"
  | "parse_error"
  | "skipped_dormant"
  | "no_schema";

// ── Public FireEnvelope (per the brief: discriminated union over `source`) ──
// Every variant is `fired: true` and carries the *named* fields the
// downstream consumer needs. No nested `data` wrapper.
export type FireEnvelope =
  | { source: "bhulekh"; fired: true; plotNo: string | null; khataNo: string | null }
  | { source: "ecourts"; fired: true; caseCount: number }
  | { source: "rccms"; fired: true; caseCount: number }
  | { source: "igr-ec"; fired: true; ecReference: string | null; certifiedCopyAvailable: boolean }
  | { source: "rera"; fired: true; projectName: string | null; registrationNo: string | null }
  | { source: "cersai"; fired: true; chargeCount: number }
  | { source: "high-court"; fired: true; caseCount: number }
  | { source: "drt"; fired: true; caseCount: number }
  | { source: "bhunaksha"; fired: true; plotNo: string | null; villageName: string | null }
  | { source: "nominatim"; fired: true; district: string | null; tahasil: string | null; village: string | null }
  | { source: "bda-zoning"; fired: true; zone: string | null; inIndustrialZone: boolean }
  | { source: "circle-rate"; fired: true; benchmarkPerAcre: number | null; sourceVintage: string | null }
  | { source: "stamp-duty"; fired: true; ratePct: number | null; expectedAmount: number | null }
  | { source: "igr-bmv"; fired: true; guidelineValue: number | null; villageName: string | null }
  | { source: "igr-daily-bulletin"; fired: true; bulletinDate: string | null; deedCount: number }
  | { source: "public-dashboard"; fired: true; scannedPageUrl: string | null }
  | { source: "govt-fee"; fired: true; category: string; minStampINR: number }
  | { source: "igr-certified-copy"; fired: true; certifiedCopyUrl: string | null }
  | { source: "igr-sro"; fired: true; sroName: string | null; sroAddress: string | null }
  | { source: "larr"; fired: true; notificationId: string | null; notificationDate: string | null }
  | { source: "bhunaksha-plot-report"; fired: true; plotAreaSqm: number | null; perimeterM: number | null }
  | { source: "eow"; fired: true; matched: boolean; overallSeverity: "critical" | "high_watch_out" | null; entryCount: number };

// ── Public FireResult (per the brief) ───────────────────────────────────────
export type FireResult =
  | { fired: true; envelope: FireEnvelope }
  | { fired: false; reason: FireReason };

// ── Internal SourceDataMap (not exported) ───────────────────────────────────
// The gate reads each per-source contract schema to Zod-parse the input.
// This map keeps the per-source dispatch in one place.
type SourceDataMap = {
  bhulekh: z.infer<typeof BhulekhDataSchema>;
  ecourts: z.infer<typeof EcourtsDataSchema>;
  rccms: z.infer<typeof RccmsDataSchema>;
  "igr-ec": z.infer<typeof IgrEcDataSchema>;
  rera: { projectName: string | null; registrationNo: string | null };
  cersai: z.infer<typeof CersaiDataSchema>;
  "high-court": { cases: ReadonlyArray<unknown> };
  drt: { cases: ReadonlyArray<unknown> };
  bhunaksha: z.infer<typeof BhunakshaDataSchema>;
  nominatim: z.infer<typeof NominatimDataSchema>;
  "bda-zoning": z.infer<typeof BdaZoningDataSchema>;
  "circle-rate": z.infer<typeof CircleRateDataSchema>;
  "stamp-duty": z.infer<typeof StampDutyDataSchema>;
  "igr-bmv": z.infer<typeof IgrBmvDataSchema>;
  "igr-daily-bulletin": z.infer<typeof IgrDailyBulletinDataSchema>;
  "public-dashboard": z.infer<typeof PublicDashboardDataSchema>;
  "govt-fee": z.infer<typeof GovtFeeDataSchema>;
  "igr-certified-copy": z.infer<typeof CertifiedCopyDataSchema>;
  "igr-sro": z.infer<typeof IgrSroDataSchema>;
  larr: { notificationId: string | null; notificationDate: string | null };
  "bhunaksha-plot-report": z.infer<typeof BhunakshaPlotReportDataSchema>;
  eow: { matched?: boolean; overallSeverity?: "critical" | "high_watch_out" | null; entryCount?: number };
};

/**
 * Sources whose fetcher currently has no Zod contract schema. For these
 * four the gate does a structural type cast rather than `XxxDataSchema.parse()`.
 * If a new source is added to `SourceId` without a contract, this set must be
 * updated so the gate returns `no_schema` rather than silently producing a
 * `parse_error` from the fallback `default` arm.
 */
export const NO_SCHEMA_SOURCES: ReadonlySet<SourceId> = new Set<SourceId>([
  "rera",
  "high-court",
  "drt",
  "larr",
  "eow",
]);

/**
 * Sentinel type used by the wire step to mark a V1.1-DORMANT source. When the
 * pipeline calls isSourceFired for a dormant source, the wire code passes an
 * object with this sentinel so the gate produces `skipped_dormant` rather
 * than guessing `no_data`.
 */
export const V11_DORMANT_MARKER = "__v11_dormant__" as const;

/**
 * Public entry point: returns the typed FireResult.
 *
 * The wire step (apps/web/src/lib/pipeline/index.ts) calls this for every
 * source. For V1.1-DORMANT sources, the wire code passes
 * `{ source: V11_DORMANT_MARKER, dormant: true }` and we return
 * `{ fired: false, reason: "skipped_dormant" }`.
 */
export function isSourceFired(source: SourceId, result: unknown): FireResult {
  // V1.1-DORMANT short-circuit (per brief finding 3).
  if (
    result !== null &&
    typeof result === "object" &&
    (result as { source?: unknown }).source === V11_DORMANT_MARKER
  ) {
    return { fired: false, reason: "skipped_dormant" };
  }

  if (!result || typeof result !== "object") {
    return { fired: false, reason: "parse_error" };
  }
  const r = result as Record<string, unknown>;
  if (r.source !== source) {
    return { fired: false, reason: "parse_error" };
  }

  // Map the status field to the brief's reason vocabulary.
  const status = r.status;
  if (status !== "ok") {
    return { fired: false, reason: mapStatusToReason(status) };
  }

  if (!r.data || typeof r.data !== "object") {
    // For NO_SCHEMA_SOURCES (rera/high-court/drt/larr), missing/null data
    // means the contract isn't established yet — surface that explicitly
    // as `no_schema` rather than collapsing to `no_data`. For all other
    // sources, the data is genuinely missing.
    if (NO_SCHEMA_SOURCES.has(source)) {
      return { fired: false, reason: "no_schema" };
    }
    return { fired: false, reason: "no_data" };
  }

  return buildEnvelope(source, r.data as Record<string, unknown>);
}

function mapStatusToReason(status: unknown): FireReason {
  if (status === "no_data") return "no_data";
  if (status === "source_down") return "source_down";
  if (status === "invalid_input") return "invalid_input";
  if (status === "parse_error") return "parse_error";
  // Anything else (e.g. the legacy SourceResultBase statuses
  // "success" | "partial" | "failed" | "error" | "not_covered") is treated
  // as the nearest contract equivalent. The wire step is responsible for
  // mapping legacy statuses to the contract status before calling the gate.
  return "parse_error";
}

/**
 * Zod-parses the data field against the per-source contract schema, then
 * dispatches to a per-source envelope builder. Throws on exhaustiveness
 * violation (caught by the inner try/catch and returned as parse_error).
 */
function buildEnvelope(source: SourceId, data: Record<string, unknown>): FireResult {
  try {
    switch (source) {
      case "bhulekh":
        return fireBhulekh(BhulekhDataSchema.parse(data));
      case "ecourts":
        return fireEcourts(EcourtsDataSchema.parse(data));
      case "rccms":
        return fireRccms(RccmsDataSchema.parse(data));
      case "igr-ec":
        return fireIgrEc(IgrEcDataSchema.parse(data));
      case "rera":
        return fireRera(data as SourceDataMap["rera"]);
      case "cersai":
        return fireCersai(CersaiDataSchema.parse(data));
      case "high-court":
        return fireCourtCases(data as SourceDataMap["high-court"], "high-court");
      case "drt":
        return fireCourtCases(data as SourceDataMap["drt"], "drt");
      case "bhunaksha":
        return fireBhunaksha(BhunakshaDataSchema.parse(data));
      case "nominatim":
        return fireNominatim(NominatimDataSchema.parse(data));
      case "bda-zoning":
        return fireBdaZoning(BdaZoningDataSchema.parse(data));
      case "circle-rate":
        return fireCircleRate(CircleRateDataSchema.parse(data));
      case "stamp-duty":
        return fireStampDuty(StampDutyDataSchema.parse(data));
      case "igr-bmv":
        return fireIgrBmv(IgrBmvDataSchema.parse(data));
      case "igr-daily-bulletin":
        return fireIgrDailyBulletin(IgrDailyBulletinDataSchema.parse(data));
      case "public-dashboard":
        return firePublicDashboard(PublicDashboardDataSchema.parse(data));
      case "govt-fee":
        return fireGovtFee(GovtFeeDataSchema.parse(data));
      case "igr-certified-copy":
        return fireIgrCertifiedCopy(CertifiedCopyDataSchema.parse(data));
      case "igr-sro":
        return fireIgrSro(IgrSroDataSchema.parse(data));
      case "larr":
        return fireLarr(data as SourceDataMap["larr"]);
      case "bhunaksha-plot-report":
        return fireBhunakshaPlotReport(BhunakshaPlotReportDataSchema.parse(data));
      case "eow":
        return fireEow(data as SourceDataMap["eow"]);
      default: {
        // Unreachable for the closed SourceId union, but kept as a
        // forward-compatibility net: if a new source id is added without
        // a per-source Zod contract, surface that explicitly as
        // `no_schema` rather than collapsing to `parse_error`.
        const _exhaustive: never = source;
        void _exhaustive;
        return { fired: false, reason: "no_schema" };
      }
    }
  } catch {
    return { fired: false, reason: "parse_error" };
  }
}

// ── Per-source envelope builders ────────────────────────────────────────────
// Each builder runs the per-source *liveness* check (does the data actually
// contain the fact the report needs to surface?) and returns the typed
// FireEnvelope. If the liveness check fails, returns fired=false with a
// appropriate reason.

function fireBhulekh(d: SourceDataMap["bhulekh"]): FireResult {
  // Per the brief: bhulekh fires when the parsed plot/khata is present.
  // Empty tenants are not a no-data signal — that's a separate concern.
  if (!d.plotNo) {
    return { fired: false, reason: "no_data" };
  }
  return {
    fired: true,
    envelope: {
      source: "bhulekh",
      fired: true,
      plotNo: d.plotNo ?? null,
      khataNo: d.khataNo ?? null,
    },
  };
}

function fireEcourts(d: SourceDataMap["ecourts"]): FireResult {
  if (!Array.isArray(d.cases)) {
    return { fired: false, reason: "no_data" };
  }
  return {
    fired: true,
    envelope: { source: "ecourts", fired: true, caseCount: d.cases.length },
  };
}

function fireRccms(d: SourceDataMap["rccms"]): FireResult {
  if (!Array.isArray(d.cases)) {
    return { fired: false, reason: "no_data" };
  }
  return {
    fired: true,
    envelope: { source: "rccms", fired: true, caseCount: d.cases.length },
  };
}

function fireIgrEc(d: SourceDataMap["igr-ec"]): FireResult {
  if (!d.ecAvailable) {
    return { fired: false, reason: "no_data" };
  }
  return {
    fired: true,
    envelope: {
      source: "igr-ec",
      fired: true,
      ecReference: d.ecDocumentRef ?? null,
      certifiedCopyAvailable: d.ecAvailable,
    },
  };
}

function fireRera(d: SourceDataMap["rera"]): FireResult {
  // RERA has no Zod contract yet (per I4). The data shape is
  // `{ projectName, registrationNo }`. A hand-rolled payload with no
  // fields is treated as `no_schema` — the contract is missing, so we
  // cannot validate the shape beyond the type cast.
  const data = d as { projectName?: string | null; registrationNo?: string | null };
  if (data === null || (data.projectName === undefined && data.registrationNo === undefined)) {
    return { fired: false, reason: "no_schema" };
  }
  return {
    fired: true,
    envelope: {
      source: "rera",
      fired: true,
      projectName: data.projectName ?? null,
      registrationNo: data.registrationNo ?? null,
    },
  };
}

function fireCersai(d: SourceDataMap["cersai"]): FireResult {
  const charges = d.charges ?? [];
  return {
    fired: true,
    envelope: { source: "cersai", fired: true, chargeCount: charges.length },
  };
}

function fireCourtCases(
  d: SourceDataMap["high-court"],
  source: "high-court" | "drt",
): FireResult {
  // High Court and DRT have no Zod contract yet (per I4). The expected
  // shape is `{ cases: ReadonlyArray<unknown> }`. If the data is null or
  // completely missing, treat as `no_schema`; if `cases` is present but
  // not an array, treat as `parse_error` (the shape was wrong, not missing).
  if (d === null || d === undefined) {
    return { fired: false, reason: "no_schema" };
  }
  if (!Array.isArray(d.cases)) {
    return { fired: false, reason: "parse_error" };
  }
  return {
    fired: true,
    envelope: { source, fired: true, caseCount: d.cases.length },
  };
}

function fireBhunaksha(d: SourceDataMap["bhunaksha"]): FireResult {
  if (!d.plotNo) {
    return { fired: false, reason: "no_data" };
  }
  return {
    fired: true,
    envelope: {
      source: "bhunaksha",
      fired: true,
      plotNo: d.plotNo,
      villageName: d.village ?? null,
    },
  };
}

function fireNominatim(d: SourceDataMap["nominatim"]): FireResult {
  if (!d.village && !d.district && !d.tahasil) {
    return { fired: false, reason: "no_data" };
  }
  return {
    fired: true,
    envelope: {
      source: "nominatim",
      fired: true,
      district: d.district ?? null,
      tahasil: d.tahasil ?? null,
      village: d.village ?? null,
    },
  };
}

function fireBdaZoning(d: SourceDataMap["bda-zoning"]): FireResult {
  const firstRow = d.rows?.[0];
  if (!firstRow) {
    return { fired: false, reason: "no_data" };
  }
  const zoneId = firstRow.zone?.id ?? null;
  if (!zoneId) {
    return { fired: false, reason: "no_data" };
  }
  return {
    fired: true,
    envelope: {
      source: "bda-zoning",
      fired: true,
      zone: zoneId,
      inIndustrialZone: zoneId === "industrial",
    },
  };
}

function fireCircleRate(d: SourceDataMap["circle-rate"]): FireResult {
  const firstRow = d.rows?.[0];
  if (!firstRow) {
    return { fired: false, reason: "no_data" };
  }
  return {
    fired: true,
    envelope: {
      source: "circle-rate",
      fired: true,
      benchmarkPerAcre: firstRow.ratePerAcre ?? null,
      sourceVintage: firstRow.lastUpdated ?? null,
    },
  };
}

function fireStampDuty(d: SourceDataMap["stamp-duty"]): FireResult {
  // Stamp duty contract payload shape: see stamp-duty.ts. The breakup is a
  // single object (not an array) — see StampDutyDataSchema.
  const breakup = d.breakup;
  if (!breakup) {
    return { fired: false, reason: "no_data" };
  }
  const ratePct =
    breakup.appliedMarketValue > 0
      ? (breakup.stampDuty / breakup.appliedMarketValue) * 100
      : null;
  return {
    fired: true,
    envelope: {
      source: "stamp-duty",
      fired: true,
      ratePct,
      expectedAmount: breakup.totalPayable ?? null,
    },
  };
}

function fireIgrBmv(d: SourceDataMap["igr-bmv"]): FireResult {
  const firstRow = d.rows?.[0];
  if (!firstRow) {
    return { fired: false, reason: "no_data" };
  }
  return {
    fired: true,
    envelope: {
      source: "igr-bmv",
      fired: true,
      guidelineValue: firstRow.ratePerAcre ?? null,
      villageName: firstRow.mouza ?? null,
    },
  };
}

function fireIgrDailyBulletin(d: SourceDataMap["igr-daily-bulletin"]): FireResult {
  const days = d.days ?? [];
  if (days.length === 0) {
    return { fired: false, reason: "no_data" };
  }
  const totalDeeds = days.reduce((acc, day) => acc + (day.count ?? 0), 0);
  return {
    fired: true,
    envelope: {
      source: "igr-daily-bulletin",
      fired: true,
      bulletinDate: days[days.length - 1]?.date ?? null,
      deedCount: totalDeeds,
    },
  };
}

function firePublicDashboard(d: SourceDataMap["public-dashboard"]): FireResult {
  if (!d.pageUrl) {
    return { fired: false, reason: "no_data" };
  }
  return {
    fired: true,
    envelope: { source: "public-dashboard", fired: true, scannedPageUrl: d.pageUrl },
  };
}

function fireGovtFee(d: SourceDataMap["govt-fee"]): FireResult {
  // The GovtFee contract schema (as of the binding brief) does not surface a
  // top-level conversion fee — it lives in the per-plot schedule. We fire
  // only when a `matchedDeedFee` is present (the buyer's quoted deed has a
  // government-expected fee). If the schema later adds a dedicated
  // conversion field, swap this check.
  if (d.matchedDeedFee == null) {
    return { fired: false, reason: "no_data" };
  }
  return {
    fired: true,
    envelope: {
      source: "govt-fee",
      fired: true,
      category: d.matchedDeedFee.category,
      minStampINR: d.matchedDeedFee.minStampINR,
    },
  };
}

function fireIgrCertifiedCopy(d: SourceDataMap["igr-certified-copy"]): FireResult {
  if (!d.pageUrl) {
    return { fired: false, reason: "no_data" };
  }
  return {
    fired: true,
    envelope: { source: "igr-certified-copy", fired: true, certifiedCopyUrl: d.pageUrl },
  };
}

function fireIgrSro(d: SourceDataMap["igr-sro"]): FireResult {
  if (!d.sro) {
    return { fired: false, reason: "no_data" };
  }
  return {
    fired: true,
    envelope: {
      source: "igr-sro",
      fired: true,
      sroName: d.sro ?? null,
      sroAddress: d.address ?? null,
    },
  };
}

function fireLarr(d: SourceDataMap["larr"]): FireResult {
  // LARR contract file does not exist yet (per brief finding 9). Treat
  // any call as `skipped_dormant` until the contract is built.
  void d;
  return { fired: false, reason: "skipped_dormant" };
}

function fireBhunakshaPlotReport(d: SourceDataMap["bhunaksha-plot-report"]): FireResult {
  // plotAreaSqm and perimeterM aren't fields in the current contract —
  // they're computed downstream. The wire step will pass them in the
  // envelope. For now, fire if the contract parsed and has any data.
  if (!d || typeof d !== "object") {
    return { fired: false, reason: "no_data" };
  }
  return {
    fired: true,
    envelope: {
      source: "bhunaksha-plot-report",
      fired: true,
      plotAreaSqm: null,
      perimeterM: null,
    },
  };
}

function fireEow(d: SourceDataMap["eow"]): FireResult {
  // Query-side check: wire step calls matchBlacklist() against the static
  // khordha_eow_blacklist.json and surfaces the result here. Firing is gated
  // on a positive match so the consumer report only renders EOW insights
  // when the queried plot or owner appears in the blacklist.
  if (!d || d.matched !== true) {
    return { fired: false, reason: "no_data" };
  }
  return {
    fired: true,
    envelope: {
      source: "eow",
      fired: true,
      matched: true,
      overallSeverity: d.overallSeverity ?? null,
      entryCount: d.entryCount ?? 0,
    },
  };
}

// ── Internal exports for the wire step ──────────────────────────────────────
// The wire step needs to know which sources are V1.1-DORMANT. Exposed as a
// runtime constant so the wire step can build the map uniformly.
export const V11_DORMANT_SOURCES: ReadonlySet<SourceId> = new Set<SourceId>([
  "high-court",
  "drt",
  "rera",
  "larr",
]);

/**
 * Build the wire-step input for V1.1-DORMANT sources. The wire step calls
 * this for every dormant source and feeds the result into isSourceFired.
 */
export function dormantEnvelope(source: SourceId): unknown {
  return { source: V11_DORMANT_MARKER, dormant: true, dormantSource: source };
}

// Touch unused imports so the per-source Zod schemas stay referenced even
// if a particular builder inlines the type cast.
void BhulekhContract;
void EcourtsContract;
void RccmsContract;
void IgrEcContract;
void CersaiContract;
void IgrSroContract;
void CircleRateContract;
void BdaZoningContract;
void IgrBmvContract;
void StampDutyContract;
void IgrDailyBulletinContract;
