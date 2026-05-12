/**
 * LandClassifier (A6) — Input/Output Zod schemas
 *
 * Based on Odisha's 22 standardized Kisam (Land Use) categories (2024-2026 rationalization):
 *   SAFE/READY: Gharabari, Byabasaika, Unnayana jogya
 *   CONVERSION REQUIRED: Anajalasechita, Bagayat, Patita, Jalasechita (single/double crop)
 *   PROHIBITED/HIGH RISK: Jalasaya, Jungle, Gochar, Smasana, Nala/Nadi
 */
import { z } from "zod";

// Standardized Odisha Kisam categories (2024-2026 rationalization)
export const OdishaKisamSchema = z.enum([
  // Category 1: SAFE/READY
  "gharabari",         // ଗୃହ ବାଡ଼ି — Homestead
  "byabasaika",        // ବ୍ୟବସାୟିକ — Commercial
  "unnayana_jogya",    // ଉନ୍ନୟନ ଯୋଗ୍ୟ — Developmental
  // Category 2: CONVERSION REQUIRED
  "anajalasechita",    // ଆନଜାଳ ସେଚିତ — Rain-fed
  "bagayat",           // ବାଗାତ — Orchard/Plantation
  "patita",            // ପତିତ — Fallow
  "jalasechita_single",// ଜଳ ସେଚିତ (Single crop)
  "jalasechita_double",// ଜଳ ସେଚିତ (Double crop) — high difficulty
  // Category 3: PROHIBITED/HIGH RISK
  "jalasaya",          // ଜଳାଶୟ — Water body/Pond
  "jungle",            // ଜଙ୍ଗଲ — Forest
  "gochar",            // ଗୋଚର — Grazing land
  "smasana",           // ସ୍ମଶନ — Cremation ground
  "nadi",              // ନଦୀ — River/Waterway
  // Legacy Odia land classes (mapped to standardized)
  "agricultural",      // ସ୍ଥିତିବାନ
  "danda",             // ଦଣ୍ଡା (irrigated single crop)
  "godanda",           // ଗୋଦଣ୍ଡା (irrigated — private irrigation)
  "khalsa",            // ଖାସର (government land)
  "pathra",            // ପାଥର (stony)
  "banjara",           // ବନ୍ଜାର (forest/waste)
  "neya_niyogita",    // ନୟନଯୋରୀ — Neyanjori / notified govt. land
  "other",             // unknown
]);

export const KisamCategorySchema = z.enum(["safe", "conversion_required", "prohibited", "unknown"]);

export const RestrictionTypeSchema = z.enum([
  "pessa",             // PESA — Fifth Schedule tribal area
  "forest",            // Forest Conservation Act land
  "crz",               // Coastal Regulation Zone
  "tribal_subplan",    // TSP — Tribal Sub Plan area
  "buffer_zone",       // Within 500m of protected area
  "wetland",           // Wetland Rules 2017
  "agricultural_zone",// State agriculture zone — non-agricultural conversion required
  "heritage",          // Archaeological/heritage zone
  "defence",           // Defence/airport zone
  "flood_plain",       // Flood plain — construction restrictions
  "land_ceiling",      // Beyond ceiling — surplus land acquisition
  "clu_required",       // Change of Land Use certificate required
  "conversion_high_difficulty", // Double-crop land — food security protection
  "prohibited_construction",   // Construction strictly prohibited
]);

export const LandRestrictionSchema = z.object({
  type: RestrictionTypeSchema,
  severity: z.enum(["critical", "warning", "info"]),
  description: z.string(),
  citation: z.string().optional(),
  action: z.string().optional(),
  source: z.string().optional(),
});

export type LandRestriction = z.infer<typeof LandRestrictionSchema>;

export const LandClassifierInputSchema = z.object({
  plots: z.array(z.object({
    plotNo: z.string(),
    areaAcres: z.number(),
    landClassOdia: z.string().optional(),
    landClassEnglish: z.string().optional(), // may already be standardized
  })),
  gpsCoordinates: z.object({ lat: z.number(), lng: z.number() }),
  village: z.string().optional(),
  district: z.string().optional(),
  overlayFlags: z.record(z.boolean()).optional(),
  // Location context for fee estimation
  proximityTo: z.enum(["municipality", "nh_500m", "state_hwy_250m", "planned_area", "rural"]).optional(),
});

export type OdishaKisam = z.infer<typeof OdishaKisamSchema>;
export type KisamCategory = z.infer<typeof KisamCategorySchema>;
export type RestrictionType = z.infer<typeof RestrictionTypeSchema>;
export type LandClassifierInput = z.infer<typeof LandClassifierInputSchema>;

export const LandClassifierResultSchema = z.object({
  primaryKisam: OdishaKisamSchema,
  primaryCategory: KisamCategorySchema,
  classificationExplanation: z.string(),
  restrictions: z.array(LandRestrictionSchema),
  conversionRequired: z.boolean(),
  cluFeeEstimate: z.string().optional(),
  conversionNote: z.string().optional(),
  plotClassifications: z.array(z.object({
    plotNo: z.string(),
    kisam: OdishaKisamSchema,
    category: KisamCategorySchema,
    kisamEnglish: z.string(),
    areaAcres: z.number(),
  })),
  overallRestrictionCount: z.number(),
  hasCriticalRestriction: z.boolean(),
  prohibitedPlotCount: z.number(),
});

export type LandClassifierResult = z.infer<typeof LandClassifierResultSchema>;