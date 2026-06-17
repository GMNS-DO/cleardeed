/**
 * Typed "fire" gate per source.
 *
 * Replaces scattered `source.status === "success"` checks across the
 * consumer-report-writer and output-auditor with a single source-of-truth
 * predicate: `isSourceFired(sourceId, envelope)`.
 *
 * A source "fires" when:
 *   1. The envelope's `status` field is `"ok"`.
 *   2. The envelope's `source` field matches the requested SourceId.
 *   3. The envelope's `data` field passes the per-source liveness check
 *      (e.g., tenants for bhulekh, village for nominatim).
 */
import type { NominatimData } from "./nominatim";
import type { BhunakshaData } from "./bhunaksha";
import type { BhulekhData } from "./bhulekh";
import type { BhunakshaPlotReportData } from "./bhunaksha-plot-report";
import type { EcourtsData } from "./ecourts";
import type { RccmsData } from "./rccms";
import type { IgrEcData } from "./igr-ec";
import type { IgrSroData } from "./igr-sro";
import type { CersaiData } from "./cersai";
import type { CircleRateData } from "./circle-rate";
import type { BdaZoningData } from "./bda-zoning";
import type { IgrBmvData } from "./igr-bmv";
import type { StampDutyData } from "./stamp-duty";
import type { IgrDailyBulletinData } from "./igr-daily-bulletin";
import type { PublicDashboardData } from "./public-dashboard";
import type { GovtFeeData } from "./govt-fee";
import type { CertifiedCopyData } from "./igr-certified-copy";

export const ALL_SOURCE_IDS = [
  "nominatim",
  "bhunaksha",
  "bhulekh",
  "bhunaksha-plot-report",
  "ecourts",
  "rccms",
  "igr-ec",
  "igr-sro",
  "cersai",
  "circle-rate",
  "bda-zoning",
  "igr-bmv",
  "stamp-duty",
  "igr-daily-bulletin",
  "public-dashboard",
  "govt-fee",
  "igr-certified-copy",
] as const;

export type SourceId = (typeof ALL_SOURCE_IDS)[number];

/**
 * Per-source mapping from SourceId → typed data shape.
 *
 * Each contract file exports a `*Data` type inferred from its Zod schema.
 * The map below is the typed canonical source for `FireEnvelope.data`.
 * If a new source is added, add it here AND to ALL_SOURCE_IDS.
 */
export interface SourceDataMap {
  "nominatim": NominatimData;
  "bhunaksha": BhunakshaData;
  "bhulekh": BhulekhData;
  "bhunaksha-plot-report": BhunakshaPlotReportData;
  "ecourts": EcourtsData;
  "rccms": RccmsData;
  "igr-ec": IgrEcData;
  "igr-sro": IgrSroData;
  "cersai": CersaiData;
  "circle-rate": CircleRateData;
  "bda-zoning": BdaZoningData;
  "igr-bmv": IgrBmvData;
  "stamp-duty": StampDutyData;
  "igr-daily-bulletin": IgrDailyBulletinData;
  "public-dashboard": PublicDashboardData;
  "govt-fee": GovtFeeData;
  "igr-certified-copy": CertifiedCopyData;
}

export interface FireEnvelope<S extends SourceId> {
  readonly source: S;
  readonly data: SourceDataMap[S];
}

export type FireResult<S extends SourceId = SourceId> =
  | { fired: true; source: S; envelope: FireEnvelope<S>; reason: undefined }
  | { fired: false; source: S; envelope: undefined; reason: string };

const noFire = <S extends SourceId>(source: S, reason: string): FireResult<S> => ({
  fired: false,
  source,
  envelope: undefined,
  reason,
});

export function isSourceFired<S extends SourceId>(
  source: S,
  result: unknown,
): FireResult<S> {
  if (!result || typeof result !== "object") {
    return noFire(source, "result is null or not an object");
  }
  const r = result as Record<string, unknown>;
  if (r.source !== source) {
    return noFire(source, `envelope source mismatch: expected ${source}, got ${String(r.source)}`);
  }
  if (r.status !== "ok") {
    return noFire(source, `status is ${String(r.status)}`);
  }
  if (!r.data || typeof r.data !== "object") {
    return noFire(source, "data is missing");
  }
  const dataCheck = livenessCheck(source, r.data as Record<string, unknown>);
  if (!dataCheck.ok) {
    return noFire(source, dataCheck.reason);
  }
  return {
    fired: true,
    source,
    envelope: { source, data: r.data as SourceDataMap[S] },
    reason: undefined,
  };
}

function livenessCheck(source: SourceId, data: Record<string, unknown>): { ok: true } | { ok: false; reason: string } {
  switch (source) {
    case "nominatim": {
      if (typeof data.village !== "string" || data.village.length === 0) {
        return { ok: false, reason: "nominatim.data.village missing" };
      }
      return { ok: true };
    }
    case "bhunaksha": {
      if (typeof data.plotNo !== "string" || data.plotNo.length === 0) {
        return { ok: false, reason: "bhunaksha.data.plotNo missing" };
      }
      return { ok: true };
    }
    case "bhulekh": {
      if (!Array.isArray(data.tenants) || data.tenants.length === 0) {
        return { ok: false, reason: "bhulekh.data.tenants empty" };
      }
      return { ok: true };
    }
    case "bhunaksha-plot-report": {
      if (typeof data.khataNo !== "string" && typeof data.plotNo !== "string") {
        return { ok: false, reason: "bhunaksha-plot-report.data missing plot/khata identifier" };
      }
      return { ok: true };
    }
    case "ecourts":
    case "rccms": {
      if (!Array.isArray(data.cases)) {
        return { ok: false, reason: `${source}.data.cases missing` };
      }
      return { ok: true };
    }
    case "igr-ec": {
      if (typeof data.sro !== "string" || data.sro.length === 0) {
        return { ok: false, reason: "igr-ec.data.sro missing" };
      }
      return { ok: true };
    }
    case "igr-sro": {
      if (typeof data.sroName !== "string" || data.sroName.length === 0) {
        return { ok: false, reason: "igr-sro.data.sroName missing" };
      }
      return { ok: true };
    }
    case "cersai": {
      if (!Array.isArray(data.charges)) {
        return { ok: false, reason: "cersai.data.charges missing" };
      }
      return { ok: true };
    }
    case "circle-rate": {
      if (typeof data.ratePerSqft !== "number" || data.ratePerSqft <= 0) {
        return { ok: false, reason: "circle-rate.data.ratePerSqft missing or non-positive" };
      }
      return { ok: true };
    }
    case "bda-zoning": {
      if (typeof data.zone !== "string" || data.zone.length === 0) {
        return { ok: false, reason: "bda-zoning.data.zone missing" };
      }
      return { ok: true };
    }
    case "igr-bmv": {
      if (typeof data.benchmarkValue !== "number" || data.benchmarkValue <= 0) {
        return { ok: false, reason: "igr-bmv.data.benchmarkValue missing or non-positive" };
      }
      return { ok: true };
    }
    case "stamp-duty": {
      if (typeof data.totalPayable !== "number" || data.totalPayable < 0) {
        return { ok: false, reason: "stamp-duty.data.totalPayable missing" };
      }
      return { ok: true };
    }
    case "igr-daily-bulletin": {
      if (!Array.isArray(data.deeds) && typeof data.totalDeeds !== "number") {
        return { ok: false, reason: "igr-daily-bulletin.data missing deeds or total" };
      }
      return { ok: true };
    }
    case "public-dashboard": {
      if (typeof data.url !== "string" || data.url.length === 0) {
        return { ok: false, reason: "public-dashboard.data.url missing" };
      }
      return { ok: true };
    }
    case "govt-fee": {
      if (!data.schedule || typeof data.schedule !== "object") {
        return { ok: false, reason: "govt-fee.data.schedule missing" };
      }
      return { ok: true };
    }
    case "igr-certified-copy": {
      if (typeof data.url !== "string" || data.url.length === 0) {
        return { ok: false, reason: "igr-certified-copy.data.url missing" };
      }
      return { ok: true };
    }
    default: {
      const _exhaustive: never = source;
      return { ok: false, reason: `unknown source: ${String(_exhaustive)}` };
    }
  }
}
