// agents/consumer-report-writer/src/insights/schema.ts
import { z } from "zod";

export const ISSUE_LENS = [
  "title_chain",
  "registry_ec",
  "revenue_record",
  "land_use_permission",
  "parser_source_quality",
] as const;
export type IssueLens = (typeof ISSUE_LENS)[number];

export const EVIDENCE_STRENGTH = [
  "document_anchor",
  "case_or_order_anchor",
  "selected_plot_anchor",
  "row_count_signal",
  "source_observation",
  "parser_uncertain",
  "missing_source",
] as const;
export type EvidenceStrength = (typeof EVIDENCE_STRENGTH)[number];

export const INSIGHT_PANEL = [
  "plot",
  "owner",
  "land",
  "plotTable",
  "dues",
  "backPage",
  "chain",
  "encumbrance",
  "deeds",
  "court",
  "financial",
  "ownershipChain",
  "neighbours",
  "roadAccess",
  "khaAdjacent",
  "completeness",
] as const;
export type InsightPanel = (typeof INSIGHT_PANEL)[number];

export const SEVERITY = ["positive", "watchout", "redFlag"] as const;
export type Severity = (typeof SEVERITY)[number];

export const InsightSchema = z.object({
  panel: z.enum(INSIGHT_PANEL),
  issueLens: z.enum(ISSUE_LENS),
  evidenceStrength: z.enum(EVIDENCE_STRENGTH),
  source: z.string().min(1),
  severity: z.enum(SEVERITY),
  headline: z.string().min(1),
  body: z.string().min(1),
  actionItem: z.string().min(1),
  ruleId: z.string().regex(/^ROR-INS-\d{3}$/),
  disclosure: z
    .object({
      whatWeChecked: z.string(),
      howToVerify: z.string(),
      limitsOfThisCheck: z.string(),
    })
    .optional(),
});
export type Insight = z.infer<typeof InsightSchema>;

// Forward declaration; defined in registry/_shared.ts in Task 2.
export type RuleInput = unknown;
export type RuleFn = (input: RuleInput) => Insight[] | null;

export const RuleSchema = z.object({
  id: z.string().regex(/^ROR-INS-\d{3}$/),
  panel: z.enum(INSIGHT_PANEL),
  fn: z.custom<RuleFn>(),
  version: z.string().min(1),
});
export type Rule = z.infer<typeof RuleSchema>;