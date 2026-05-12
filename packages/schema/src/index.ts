import { z } from "zod";

declare function setTimeout(handler: () => void, timeout?: number): unknown;

export const GPSCoordinates = z.object({
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
});

export type GPSCoordinates = z.infer<typeof GPSCoordinates>;

export const PlotIdentifier = z.object({
  gps: GPSCoordinates,
  village: z.string().min(1),
  tahasil: z.string().min(1),
  district: z.literal("Khordha"),
  riCircle: z.string().optional(),
  source: z.enum(["nominatim", "manual"]),
});

export type PlotIdentifier = z.infer<typeof PlotIdentifier>;

export const OwnerRecord = z.object({
  claimedOwnerName: z.string().min(1),
  fatherHusbandName: z.string().optional(),
  aadhaar: z.string().optional(),
  source: z.enum(["user_claim", "roor_record"]),
});

export type OwnerRecord = z.infer<typeof OwnerRecord>;

export const VerificationStatus = z.enum([
  "verified",
  "unverified",
  "manual_required",
  "error",
]);

export type VerificationStatus = z.infer<typeof VerificationStatus>;

export const SourceInputTried = z.object({
  label: z.string().optional(),
  input: z.record(z.unknown()),
});

export type SourceInputTried = z.infer<typeof SourceInputTried>;

export const SourceWarning = z.object({
  code: z.string().optional(),
  message: z.string(),
});

export type SourceWarning = z.infer<typeof SourceWarning>;

export const SourceValidatorStatus = z.enum([
  "passed",
  "failed",
  "warning",
  "skipped",
]);

export type SourceValidatorStatus = z.infer<typeof SourceValidatorStatus>;

export const SourceValidatorResult = z.object({
  name: z.string(),
  status: SourceValidatorStatus,
  message: z.string().optional(),
  raw: z.record(z.unknown()).optional(),
});

export type SourceValidatorResult = z.infer<typeof SourceValidatorResult>;

export const SourceResultBase = z.object({
  source: z.string(),
  status: z.enum(["success", "failed", "partial", "not_covered"]),
  statusReason: z.string().optional(),
  verification: VerificationStatus,
  fetchedAt: z.string().datetime(),
  attempts: z.number().int().nonnegative().optional(),
  inputsTried: z.array(SourceInputTried).optional(),
  rawArtifactHash: z.string().optional(),
  rawArtifactRef: z.string().optional(),
  parserVersion: z.string().optional(),
  templateHash: z.string().optional(),
  warnings: z.array(SourceWarning).optional(),
  validators: z.array(SourceValidatorResult).optional(),
  retryAttempts: z.array(z.unknown()).optional(),
  rawResponse: z.string().optional(),
  error: z.string().optional(),
});

export type SourceResultBase = z.infer<typeof SourceResultBase>;

export interface RetryAttemptRecord {
  attempt: number;
  startedAt: string;
  completedAt?: string;
  status: "success" | "failed";
  error?: string;
}

export interface RetryOptions {
  maxAttempts?: number;
  baseDelayMs?: number;
  shouldRetry?: (error: unknown, attempt: number) => boolean;
  onAttempt?: (record: RetryAttemptRecord) => void;
}

export interface RetryResult<T> {
  value: T;
  attempts: RetryAttemptRecord[];
}

/**
 * Shared source retry helper. Fetchers use this to record attempt metadata in a
 * consistent shape while keeping source-specific retry decisions local.
 */
export async function runWithRetry<T>(
  fn: (attempt: number) => Promise<T>,
  options: RetryOptions = {}
): Promise<RetryResult<T>> {
  const maxAttempts = Math.max(1, options.maxAttempts ?? 1);
  const baseDelayMs = Math.max(0, options.baseDelayMs ?? 0);
  const shouldRetry = options.shouldRetry ?? (() => true);
  const attempts: RetryAttemptRecord[] = [];

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const record: RetryAttemptRecord = {
      attempt,
      startedAt: new Date().toISOString(),
      status: "failed",
    };
    attempts.push(record);

    try {
      const value = await fn(attempt);
      record.status = "success";
      record.completedAt = new Date().toISOString();
      options.onAttempt?.(record);
      return { value, attempts };
    } catch (error) {
      record.status = "failed";
      record.completedAt = new Date().toISOString();
      record.error = error instanceof Error ? error.message : String(error);
      options.onAttempt?.(record);

      const isLastAttempt = attempt >= maxAttempts;
      if (isLastAttempt || !shouldRetry(error, attempt)) {
        throw Object.assign(error instanceof Error ? error : new Error(String(error)), {
          attempts,
        });
      }

      if (baseDelayMs > 0) {
        await delay(baseDelayMs * 2 ** (attempt - 1));
      }
    }
  }

  throw new Error("retry loop exhausted without returning or throwing");
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Bhulekh RoR (Record of Rights)
export const RoRLandDetail = z.object({
  surveyNo: z.string(),
  area: z.number(),
  unit: z.string().default("acre"),
  areaAcresRaw: z.string().optional(),
  areaDecimalsRaw: z.string().optional(),
  areaHectaresRaw: z.string().optional(),
  areaUnitRaw: z.string().optional(),
  areaComputation: z.string().optional(),
  sourcePlotNo: z.string().optional(),
  sourceRowHash: z.string().optional(),
  landClass: z.string(),
  tenantName: z.string(),
  fatherHusbandName: z.string().optional(),
  share: z.string().optional(),
});

export const RoRMutationReference = z.object({
  caseType: z.string().optional(),
  caseNo: z.string().optional(),
  orderDate: z.string().optional(),
  plotNo: z.string().optional(),
  sourceField: z.string(),
  rawText: z.string(),
});

export type RoRMutationReference = z.infer<typeof RoRMutationReference>;

export const RoRResult = SourceResultBase.extend({
  source: z.literal("bhulekh"),
  data: z
    .object({
      plotNo: z.string(),
      khataNo: z.string().optional(),
      village: z.string(),
      tenants: z.array(RoRLandDetail),
      lastUpdated: z.string().optional(),
      sourceDocument: z.string().optional(),
      mutationReferences: z.array(RoRMutationReference).optional(),
    })
    .optional(), // omitted when status === "failed"
});

export type RoRResult = z.infer<typeof RoRResult>;

const NullableText = z.string().optional().nullable();
const RawCellValue = z.union([z.string(), z.null()]);

export const BhulekhRoRPlotRowV1 = z.object({
  plotNo: NullableText,
  chakNameOdia: NullableText,
  landTypeOdia: NullableText,
  northBoundaryOdia: NullableText,
  southBoundaryOdia: NullableText,
  eastBoundaryOdia: NullableText,
  westBoundaryOdia: NullableText,
  areaAcres: NullableText,
  areaDecimals: NullableText,
  areaHectares: NullableText,
  areaUnitRaw: NullableText,
  areaComputation: NullableText,
  sourceRowHash: NullableText,
  remarksOdia: NullableText,
  raw: z.record(RawCellValue).default({}),
});

export type BhulekhRoRPlotRowV1 = z.infer<typeof BhulekhRoRPlotRowV1>;

export const BhulekhRoRDocumentV1 = z.object({
  schemaVersion: z.literal("bhulekh-ror-v1"),
  source: z.object({
    lookupMode: z.enum(["plot", "khatiyan", "tenant"]),
    finalUrl: z.string().url().optional(),
    fetchedAt: z.string().datetime(),
    artifactType: z.enum(["html", "pdf", "text"]),
    rawArtifactHash: z.string().optional(),
    rawArtifactRef: z.string().optional(),
  }),
  location: z.object({
    mouzaOdia: NullableText,
    tehsilOdia: NullableText,
    thanaOdia: NullableText,
    districtOdia: NullableText,
    tehsilNo: NullableText,
    thanaNo: NullableText,
  }),
  record: z.object({
    khatiyanNo: NullableText,
    zamindarKhewatOdia: NullableText,
    tenantNameOdia: NullableText,
    guardianNameOdia: NullableText,
    guardianRelationOdia: NullableText,
    casteOdia: NullableText,
    residenceOdia: NullableText,
    rightsOdia: NullableText,
    tenantBlockRawOdia: NullableText,
  }),
  dues: z.object({
    jalkar: NullableText,
    khajana: NullableText,
    cess: NullableText,
    otherCess: NullableText,
    total: NullableText,
  }),
  remarks: z.object({
    progressiveRentRawOdia: NullableText,
    specialRemarksRawOdia: NullableText,
    finalPublicationDate: NullableText,
    revenueAssessmentDate: NullableText,
    generatedAtRaw: NullableText,
  }),
  mutationReferences: z.array(RoRMutationReference).default([]),
  plotTable: z.object({
    headersOdia: z.array(z.string()).default([]),
    rows: z.array(BhulekhRoRPlotRowV1).default([]),
    totals: z.object({
      plotCount: NullableText,
      areaAcres: NullableText,
      areaDecimals: NullableText,
      areaHectares: NullableText,
      rawTotalRowOdia: NullableText,
    }),
  }),
  raw: z.object({
    fullTextOdia: NullableText,
    rawHtml: NullableText,
    rawPdfTextOdia: NullableText,
  }),
});

export type BhulekhRoRDocumentV1 = z.infer<typeof BhulekhRoRDocumentV1>;

// Bhunaksha (plot polygon + metadata)
export const PlotPolygon = z.object({
  type: z.literal("Polygon"),
  coordinates: z.array(z.array(z.array(z.number()))),
});

export const BhunakshaResult = SourceResultBase.extend({
  source: z.literal("bhunaksha"),
  data: z
    .object({
      plotNo: z.string(),
      village: z.string(),
      tahasil: z.string(),
      area: z.number().optional(),
      areaUnit: z.literal("sq_km").optional(),
      shapeAreaRaw: z.number().optional(),
      shapeAreaUnit: z.literal("degrees2").optional(),
      crs: z.string().optional(),
      featureId: z.string().optional(),
      layer: z.string().optional(),
      geometryHash: z.string().optional(),
      areaComputation: z.string().optional(),
      polygon: PlotPolygon.optional(),
      classification: z.string().optional(),
      sourceDocument: z.string().optional(),
    })
    .optional(),
});

export type BhunakshaResult = z.infer<typeof BhunakshaResult>;

// eCourts (case search)
export const CaseParty = z.object({
  name: z.string(),
  role: z.enum(["petitioner", "respondent", "other"]),
});

export const CourtCaseResult = SourceResultBase.extend({
  source: z.enum(["ecourts", "high_court", "drt", "larr", "rti", "revenue_odisha_sia"]),
  data: z
    .object({
      cases: z.array(
        z.object({
          caseNo: z.string(),
          caseType: z.string(),
          court: z.string(),
          filingDate: z.string().optional(),
          status: z.string(),
          parties: z.array(CaseParty),
          lastHearingDate: z.string().optional(),
          nextHearingDate: z.string().optional(),
        })
      ),
      total: z.number(),
      searchMetadata: z
        .object({
          districtName: z.string().optional(),
          districtCode: z.string().optional(),
          complexesTried: z.array(z.string()).optional(),
          captchaAcceptedCount: z.number().int().nonnegative().optional(),
          captchaFailedCount: z.number().int().nonnegative().optional(),
          attempts: z
            .array(
              z.object({
                complexName: z.string().optional(),
                complexCode: z.string().optional(),
                ocrText: z.string().optional(),
                ocrConfidence: z.number().optional(),
	                outcome: z.enum([
	                  "captcha_failed",
	                  "no_records",
	                  "cases_found",
	                  "portal_error",
	                  "unknown",
	                  "name_variant",
	                ]),
	                partyNameVariant: z.string().optional(),
	                rawArtifactHash: z.string().optional(),
	                captchaImageHash: z.string().optional(),
	                submittedPayloadHash: z.string().optional(),
	                fullPageHash: z.string().optional(),
	                statusReason: z.string().optional(),
	                captchaAttempts: z.number().int().nonnegative().optional(),
	                doubleFetchAttempt: z.number().int().positive().optional(),
	              })
	            )
	            .optional(),
	          nameVariantsTried: z.array(z.any()).optional(),
	          doubleFetchResults: z.array(z.any()).optional(),
	          negativeResultConfidence: z
	            .enum(["high", "medium", "low", "unconfirmed"])
	            .optional(),
	        })
          .catchall(z.unknown())
	        .optional(),
    })
    .optional(),
});

export type CourtCaseResult = z.infer<typeof CourtCaseResult>;

// KYL (ORSAC)
export const KYLResult = SourceResultBase.extend({
  source: z.literal("kyl"),
  data: z
    .object({
      khataNo: z.string().optional(),
      plotNo: z.string(),
      ownerName: z.string().optional(),
      area: z.number().optional(),
      landType: z.string().optional(),
      sourceDocument: z.string().optional(),
    })
    .optional(),
});

export type KYLResult = z.infer<typeof KYLResult>;

// RCCMS (revenue court)
export const RCCMSResult = SourceResultBase.extend({
  source: z.literal("rccms"),
  data: z
    .object({
      cases: z.array(
        z.object({
          caseNo: z.string(),
          plotNo: z.string().optional(),
          caseType: z.string(),
          filingDate: z.string().optional(),
          status: z.string(),
          court: z.string(),
        })
      ),
      total: z.number(),
    })
    .optional(),
});

export type RCCMSResult = z.infer<typeof RCCMSResult>;

// ── IGR EC (Encumbrance Certificate) ─────────────────────────────────────────

export const EncumbranceEntry = z.object({
  docType: z.string().optional(),
  docNo: z.string().optional(),
  regDate: z.string().optional(),
  party1: z.string().optional(),
  party2: z.string().optional(),
  propertyDesc: z.string().optional(),
  consideration: z.string().optional(),
  marketValue: z.string().optional(),
});

export type EncumbranceEntry = z.infer<typeof EncumbranceEntry>;

export const IGRECResult = SourceResultBase.extend({
  source: z.literal("igr-ec"),
  data: z
    .object({
      ecAvailable: z.boolean(),
      ecDocumentRef: z.string().optional(),
      entries: z.array(EncumbranceEntry).optional(),
      searchPeriod: z
        .object({ from: z.string(), to: z.string() })
        .optional(),
      sro: z.string().optional(),
      district: z.string().optional(),
      fee: z.number().optional(),
      feeCurrency: z.string().optional(),
      instructions: z.string().optional(),
    })
    .optional(),
});

export type IGRECResult = z.infer<typeof IGRECResult>;

// ── CERSAI (Central Registry of Securitisation Asset Reconstruction...) ──────────

export const CERSAICharge = z.object({
  chargeType: z.string().optional(),
  borrowerName: z.string().optional(),
  propertyDesc: z.string().optional(),
  securedCreditor: z.string().optional(),
  chargeCreationDate: z.string().optional(),
  chargeAmount: z.string().optional(),
  chargeStatus: z.enum(["Active", "Satisfied", "Unknown"]).optional(),
  caseRef: z.string().optional(),
});

export type CERSAICharge = z.infer<typeof CERSAICharge>;

export const CERSAIResult = SourceResultBase.extend({
  source: z.literal("cersai"),
  data: z
    .object({
      searchType: z.enum(["borrower", "asset"]).optional(),
      searchName: z.string().optional(),
      charges: z.array(CERSAICharge).optional(),
      totalCharges: z.number().int().nonnegative().optional(),
      activeCharges: z.number().int().nonnegative().optional(),
      satisfiedCharges: z.number().int().nonnegative().optional(),
      searchMetadata: z
        .object({
          nameVariantsTried: z.array(z.string()).optional(),
          searchAttempts: z.number().int().nonnegative().optional(),
        })
        .optional(),
    })
    .optional(),
});

export type CERSAIResult = z.infer<typeof CERSAIResult>;

// Nominatim (geocoder)
export const NominatimResult = SourceResultBase.extend({
  source: z.literal("nominatim"),
  data: z
    .object({
      displayName: z.string(),
      village: z.string().optional(),
      tahasil: z.string().optional(),
      district: z.string().optional(),
      state: z.string().optional(),
      postcode: z.string().optional(),
      category: z.string().optional(),
      sourceFetchedAt: z.string().datetime().optional(),
      cacheServedAt: z.string().datetime().optional(),
    })
    .optional(),
});

export type NominatimResult = z.infer<typeof NominatimResult>;

export const SourceResult = z.discriminatedUnion("source", [
  RoRResult,
  BhunakshaResult,
  CourtCaseResult,
  KYLResult,
  RCCMSResult,
  NominatimResult,
  IGRECResult,
  CERSAIResult,
]);

export type SourceResult = z.infer<typeof SourceResult>;

// IGR deep-link only (V1)
export const IGRLink = z.object({
  url: z.string().url(),
  params: z.record(z.string()),
  instructions: z.string(),
});

export type IGRLink = z.infer<typeof IGRLink>;

// Manual verification checklist item
export const ManualChecklistItem = z.object({
  dimension: z.string(),
  description: z.string(),
  source: z.string(),
  action: z.string(),
});

export type ManualChecklistItem = z.infer<typeof ManualChecklistItem>;

// Full report
export const Report = z.object({
  id: z.string().uuid().optional(),
  plot: PlotIdentifier,
  owner: OwnerRecord,
  sourceResults: z.array(SourceResult),
  igrLink: IGRLink.optional(),
  manualChecklist: z.array(ManualChecklistItem),
  reportGeneratedAt: z.string().datetime(),
  disclaimer: z
    .string()
    .default(
      "This report aggregates public records. It does not certify ownership, guarantee absence of fraud, or recommend transactions. Manual verification of all sources is required."
    ),
});

export type Report = z.infer<typeof Report>;

// API request types
export const CreateReportRequest = z.object({
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
  claimedOwnerName: z.string().min(1),
  fatherHusbandName: z.string().optional(),
  claimedPlotNo: z.string().optional(),
});

export type CreateReportRequest = z.infer<typeof CreateReportRequest>;

// Re-export validation utilities (Phase 1 cross-source consistency checks)
export {
  validateGPSBounds,
  validateKhordhaGPS,
  assertKhordhaGPS,
  GPSValidationError,
  polygonContainsPoint,
  villagesMatch,
  reconcileArea,
  normalizeVillageName,
  containsOdiaChars,
  matchOwnerName,
  diceCoefficient,
  levenshteinDistance,
  ODIA_SURNAME_MAP,
  KHORDHA_BOUNDS,
  KHORDHA_BOUNDARY_METADATA,
  SQKM_TO_ACRES,
  findingsToChecklist,
} from "./validation";
export type {
  ClaimReadiness,
  ClaimState,
  KhordhaGPSStatus,
  KhordhaGPSValidation,
  ValidationFinding,
  ValidationSeverity,
} from "./validation";
