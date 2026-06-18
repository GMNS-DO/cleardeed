// agents/consumer-report-writer/src/insights/display-labels.ts
import type { Insight } from "./schema";

export const PROHIBITED_PHRASES = [
  "verified clear",
  "ownership verified",
  "safe to buy",
  "no encumbrance",
  "no litigation",
  "clear title",
  "buildable",
  "no restriction",
] as const;

export function noProhibitedPhrases(insight: Insight): string[] {
  const haystack = [insight.headline, insight.body, insight.actionItem]
    .join(" \n ")
    .toLowerCase();
  return PROHIBITED_PHRASES.filter((p) => haystack.includes(p));
}
