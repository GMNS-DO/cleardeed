// agents/consumer-report-writer/src/insights/engine.ts
import type { Insight, InsightPanel, Rule, RuleInput } from "./schema";
import { runRule } from "./registry/_shared";

export function runInsights(rules: Rule[], input: RuleInput): Insight[] {
  const out: Insight[] = [];
  for (const r of rules) {
    const i = runRule(r, input);
    if (i) out.push(i);
  }
  return out;
}

export function groupByPanel(insights: Insight[]): Map<InsightPanel, Insight[]> {
  const m = new Map<InsightPanel, Insight[]>();
  for (const i of insights) {
    const arr = m.get(i.panel) ?? [];
    arr.push(i);
    m.set(i.panel, arr);
  }
  return m;
}
