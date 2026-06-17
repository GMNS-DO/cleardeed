/**
 * P3 V1 schema — Ownership Lineage Graph (A13).
 *
 * Plan §4.4: summary text is RESTRICTED to a count-regex. No prose,
 * no verdicts. A11 verdict-language allowlist changes are deleted.
 *
 * Plan §4.2: layout.mode enum drives the renderer choice. The agent
 * never produces SVG; it only returns data. The renderer in V2
 * (post-sprint) will pick "svg" / "timeline" / "list" based on the
 * mode and the user's viewport.
 */

import { z } from "zod";

/** A single ownership lineage event (e.g. a sale, mortgage, partition). */
export const LineageEventSchema = z.object({
  id: z.string(),
  /** ISO 8601 date or YYYY/MM/DD as available */
  date: z.string(),
  /** "sale" | "mortgage" | "release" | "partition" | "inheritance" | "lease" */
  kind: z.enum(["sale", "mortgage", "release", "partition", "inheritance", "lease", "other"]),
  /** Document number (mutation number, deed number, etc.) */
  docNo: z.string().optional(),
  /** Plot identifier */
  plotNo: z.string().optional(),
  /** Seller / mortgagor / transferor name (free text) */
  fromParty: z.string().optional(),
  /** Buyer / mortgagee / transferee name (free text) */
  toParty: z.string().optional(),
  /** Display title for the event bullet (e.g. "Sale from X to Y") */
  displayName: z.string(),
  /** Optional raw text from the source document (for the legal review UI) */
  rawText: z.string().optional(),
});
export type LineageEvent = z.infer<typeof LineageEventSchema>;

/** A directed edge in the lineage graph. */
export const LineageEdgeSchema = z.object({
  fromNodeId: z.string(),
  toNodeId: z.string(),
  /** "owned_by" | "sold_to" | "mortgaged_to" | "released_by" | "inherited_by" */
  relationship: z.enum(["owned_by", "sold_to", "mortgaged_to", "released_by", "inherited_by"]),
  /** Reference to the source event(s) */
  eventIds: z.array(z.string()),
  /** Document type that established this edge */
  documentType: z.string().optional(),
});
export type LineageEdge = z.infer<typeof LineageEdgeSchema>;

/** A node in the lineage graph (a person or entity). */
export const LineageNodeSchema = z.object({
  id: z.string(),
  /** Display name shown in the UI */
  displayName: z.string(),
  /** "person" | "entity" | "unknown" */
  kind: z.enum(["person", "entity", "unknown"]),
  /** Role context — owner, witness, bank, etc. */
  role: z.string().optional(),
  /** When this node first appears in the lineage */
  firstSeen: z.string().optional(),
  /** When this node last appears in the lineage */
  lastSeen: z.string().optional(),
});
export type LineageNode = z.infer<typeof LineageNodeSchema>;

/** Red-flag codes — match exactly the keys in red-flags.ts. */
export const RedFlagCodeSchema = z.enum([
  "MORTGAGE_NO_RELEASE",
  "INHERITANCE_UNRECORDED",
  "RAPID_FLIPS",
  "PARTITION_MISSING_SHARES",
  "COURT_CASE_PENDING",
  "ENCROACHMENT_FLAG",
  "OUTDATED_RECORDS",
]);
export type RedFlagCode = z.infer<typeof RedFlagCodeSchema>;

/** A detected red flag with severity and copy. */
export const RedFlagSchema = z.object({
  code: RedFlagCodeSchema,
  /** "critical" | "warn" | "info" */
  severity: z.enum(["critical", "warn", "info"]),
  /** Short headline (1 line) */
  headline: z.string().min(1).max(200),
  /** Body copy (1-3 sentences, lawyer-reviewed) */
  body: z.string().min(1).max(500),
  /** What the user should do */
  actionRequired: z.string().min(1).max(300),
  /** Source event(s) that triggered this flag */
  eventIds: z.array(z.string()),
});
export type RedFlag = z.infer<typeof RedFlagSchema>;

/** Layout decision for the renderer. V1 returns "list" only; V2
 *  (post-sprint) introduces "svg" and "timeline" with dagre. */
export const LayoutModeSchema = z.enum(["list", "svg", "timeline"]);
export type LayoutMode = z.infer<typeof LayoutModeSchema>;

export const LayoutSchema = z.object({
  mode: LayoutModeSchema,
  /** Width in pixels. 0 if "list" mode (auto-sized by CSS). */
  width: z.number().int().nonnegative(),
  /** Height in pixels. 0 if "list" mode (auto-sized by content). */
  height: z.number().int().nonnegative(),
  /** Why this mode was chosen (for diagnostic logging) */
  reason: z.string(),
});
export type Layout = z.infer<typeof LayoutSchema>;

/**
 * The summary text is RESTRICTED to a count-only regex (plan §4.4).
 *
 * Allowed patterns:
 *   "12 events, 4 owners"
 *   "12 events, 4 owners, 1 critical flag"
 *   "12 events, 4 owners, 2 warn flags"
 *   "1 event, 1 owner"
 *   "1 event, 1 owner, 1 info flag"
 *
 * NO prose. NO verdicts. NO "ownership appears continuous".
 */
export const SummaryTextSchema = z.string().regex(
  /^\d+ events?, \d+ owners?(?:, \d+ (?:critical|warn|info) flags?)?$/
);

/** The A13 (P3 V1) result. */
export const A13ResultSchema = z.object({
  nodes: z.array(LineageNodeSchema),
  edges: z.array(LineageEdgeSchema),
  events: z.array(LineageEventSchema),
  flags: z.array(RedFlagSchema),
  /** Plan §4.4: count-only summary, no prose */
  summary: SummaryTextSchema,
  layout: LayoutSchema,
  /** Confidence in the lineage reconstruction (0-1) */
  confidence: z.number().min(0).max(1),
});
export type A13Result = z.infer<typeof A13ResultSchema>;

/** Input to reasonA13. Comes from the consumer-report-writer pipeline. */
export const A13InputSchema = z.object({
  /** Plot identifier (for traceability) */
  plotNo: z.string().min(1),
  /** Mutation events from Bhulekh back page */
  mutationHistory: z.array(z.object({
    mutationNumber: z.string().optional(),
    mutationDate: z.string().optional(),
    plotNo: z.string().optional(),
    fromKhatiyan: z.string().optional(),
    toKhatiyan: z.string().optional(),
    /** Optional party names (NOT in schema today per plan §4.9 risk) */
    parties: z.array(z.object({
      name: z.string(),
      role: z.string().optional(),
    })).optional(),
    /** Document type (sale, mortgage, etc.) — heuristic from text */
    docType: z.string().optional(),
    /** Raw text from the source mutation entry */
    rawText: z.string().optional(),
  })).default([]),
  /** Encumbrance entries from Bhulekh back page */
  encumbranceEntries: z.array(z.object({
    type: z.string().optional(),
    partyName: z.string().optional(),
    docNo: z.string().optional(),
    date: z.string().optional(),
    amount: z.string().optional(),
    description: z.string().optional(),
  })).default([]),
  /** Tenant list (current owners) for end-of-chain nodes */
  tenants: z.array(z.object({
    tenantName: z.string(),
    fatherHusbandName: z.string().optional(),
  })).default([]),
  /** Viewport hint from the client (optional, V2-relevant) */
  viewport: z.enum(["mobile", "desktop", "unknown"]).default("unknown"),
});
export type A13Input = z.infer<typeof A13InputSchema>;
