import { z } from "zod";

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

export const SourceResultBase = z.object({
  source: z.string(),
  status: z.enum(["success", "failed", "partial"]),
  verification: VerificationStatus,
  fetchedAt: z.string().datetime(),
  rawResponse: z.string().optional(),
  error: z.string().optional(),
});

export type SourceResultBase = z.infer<typeof SourceResultBase>;

// Bhulekh RoR (Record of Rights)
export const RoRLandDetail = z.object({
  surveyNo: z.string(),
  area: z.number(),
  unit: z.string().default("acre"),
  landClass: z.string(),
  tenantName: z.string(),
  fatherHusbandName: z.string().optional(),
  share: z.string().optional(),
});

export const RoRResult = SourceResultBase.extend({
  source: z.literal("bhulekh"),
  data: z.object({
    plotNo: z.string(),
    khataNo: z.string().optional(),
    village: z.string(),
    tenants: z.array(RoRLandDetail),
    lastUpdated: z.string().optional(),
    sourceDocument: z.string().optional(),
  }),
});

export type RoRResult = z.infer<typeof RoRResult>;

// Bhunaksha (plot polygon + metadata)
export const PlotPolygon = z.object({
  type: z.literal("Polygon"),
  coordinates: z.array(z.array(z.array(z.number()))),
});

export const BhunakshaResult = SourceResultBase.extend({
  source: z.literal("bhunaksha"),
  data: z.object({
    plotNo: z.string(),
    village: z.string(),
    tahasil: z.string(),
    area: z.number().optional(),
    polygon: PlotPolygon.optional(),
    classification: z.string().optional(),
    sourceDocument: z.string().optional(),
  }),
});

export type BhunakshaResult = z.infer<typeof BhunakshaResult>;

// eCourts (case search)
export const CaseParty = z.object({
  name: z.string(),
  role: z.enum(["petitioner", "respondent", "other"]),
});

export const CourtCaseResult = SourceResultBase.extend({
  source: z.literal("ecourts"),
  data: z.object({
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
  }),
});

export type CourtCaseResult = z.infer<typeof CourtCaseResult>;

// KYL (ORSAC)
export const KYLResult = SourceResultBase.extend({
  source: z.literal("kyl"),
  data: z.object({
    khataNo: z.string().optional(),
    plotNo: z.string(),
    ownerName: z.string().optional(),
    area: z.number().optional(),
    landType: z.string().optional(),
    sourceDocument: z.string().optional(),
  }),
});

export type KYLResult = z.infer<typeof KYLResult>;

// RCCMS (revenue court)
export const RCCMSResult = SourceResultBase.extend({
  source: z.literal("rccms"),
  data: z.object({
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
  }),
});

export type RCCMSResult = z.infer<typeof RCCMSResult>;

// Nominatim (geocoder)
export const NominatimResult = SourceResultBase.extend({
  source: z.literal("nominatim"),
  data: z.object({
    displayName: z.string(),
    village: z.string().optional(),
    tahasil: z.string().optional(),
    district: z.string().optional(),
    state: z.string().optional(),
    postcode: z.string().optional(),
    category: z.string().optional(),
  }),
});

export type NominatimResult = z.infer<typeof NominatimResult>;

export const SourceResult = z.discriminatedUnion("source", [
  RoRResult,
  BhunakshaResult,
  CourtCaseResult,
  KYLResult,
  RCCMSResult,
  NominatimResult,
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