import { z } from "zod";

export const RegulationEnum = z.enum([
  "CRZ", // Coastal Regulation Zone
  "PESA", // Panchayats (Extension to Scheduled Areas) Act
  "FOREST",
  "ARCHAEOLOGICAL",
  "AIRPORT_FUNNEL",
  "FLOOD_ZONE",
]);

export const RegulatoryFlagSchema = z.object({
  regulation: RegulationEnum,
  severity: z.enum(["warning", "info"]),
  message: z.string(),
  source: z.string(),
});

export const RegulatoryScreenerResultSchema = z.object({
  flags: z.array(RegulatoryFlagSchema),
});

export type RegulatoryFlag = z.infer<typeof RegulatoryFlagSchema>;
export type RegulatoryScreenerResult = z.infer<
  typeof RegulatoryScreenerResultSchema
>;