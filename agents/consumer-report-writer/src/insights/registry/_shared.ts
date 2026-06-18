// agents/consumer-report-writer/src/insights/registry/_shared.ts
import type { Insight, Rule, RuleInput, IssueLens, InsightPanel, EvidenceStrength } from "../schema";
import { noProhibitedPhrases } from "../display-labels";

export function runRule(rule: Rule, input: RuleInput): Insight | null {
  try {
    const out = rule.fn(input);
    if (!out) return null;
    if (noProhibitedPhrases(out).length > 0) {
      throw new Error(
        `Rule ${rule.id} emitted prohibited phrase: ${noProhibitedPhrases(out).join(", ")}`
      );
    }
    return out;
  } catch (err) {
    // Engine never blows up a whole report because one rule failed.
    // Caller can log this with `rule.id` if observability is needed.
    if (process.env.NODE_ENV !== "test") {
      // eslint-disable-next-line no-console
      console.warn(`[insights] rule ${rule.id} failed:`, err);
    }
    return null;
  }
}

export function liveDataPresent(input: unknown, path: string): boolean {
  const parts = path.split(".");
  let cur: any = input;
  for (const p of parts) {
    if (cur == null) return false;
    cur = cur[p];
  }
  if (cur === undefined || cur === null) return false;
  if (typeof cur === "string" && cur.trim() === "") return false;
  if (Array.isArray(cur) && cur.length === 0) return false;
  return true;
}

export function stubFor(
  ruleId: string,
  panel: InsightPanel,
  lens: IssueLens,
  _evidence: EvidenceStrength,
  body: string,
  actionItem: string
): Insight {
  return {
    panel,
    issueLens: lens,
    evidenceStrength: "parser_uncertain",
    source: `${ruleId}:stub`,
    severity: "watchout",
    headline: "Manual verification recommended",
    body,
    actionItem,
    ruleId,
  };
}
