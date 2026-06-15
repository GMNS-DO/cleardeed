/**
 * Sprint V2 — Fetcher contract barrel.
 *
 * Re-exports the 12 per-fetcher contract schemas so tests can import from a
 * single path:
 *
 *   import { BhulekhContract } from "@/lib/pipeline/contracts";
 *
 * Per CLAUDE.md: keep this file short. The actual schema definitions live in
 * the per-fetcher files; this is just the re-export.
 */
export * from "./types";
export * as Bhulekh from "./bhulekh";
export * as Bhunaksha from "./bhunaksha";
export * as BhunakshaPlotReport from "./bhunaksha-plot-report";
export * as Ecourts from "./ecourts";
export * as IgrEc from "./igr-ec";
export * as IgrSro from "./igr-sro";
export * as Cersai from "./cersai";
export * as Rccms from "./rccms";
export * as CircleRate from "./circle-rate";
export * as BdaZoning from "./bda-zoning";
export * as Nominatim from "./nominatim";
export * as IgrBmv from "./igr-bmv";
export * as StampDuty from "./stamp-duty";
export * as IgrDailyBulletin from "./igr-daily-bulletin";
export * from "./status-bridge";
