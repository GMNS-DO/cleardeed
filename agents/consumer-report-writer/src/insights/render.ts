// agents/consumer-report-writer/src/insights/render.ts
import type { Insight } from "./schema";

const escape = (s: string): string =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

export function renderInsightBlock(i: Insight): string {
  const disclosure = i.disclosure
    ? `<details>
  <summary>How we checked this</summary>
  <p><strong>What we checked:</strong> ${escape(i.disclosure.whatWeChecked)}</p>
  <p><strong>How to verify:</strong> ${escape(i.disclosure.howToVerify)}</p>
  <p><strong>Limits of this check:</strong> ${escape(i.disclosure.limitsOfThisCheck)}</p>
  <p><strong>Source:</strong> ${escape(i.source)} (rule ${escape(i.ruleId)}, evidence ${escape(i.evidenceStrength)}).</p>
</details>`
    : `<details>
  <summary>How we checked this</summary>
  <p>Source: ${escape(i.source)} (rule ${escape(i.ruleId)}, evidence ${escape(i.evidenceStrength)}).</p>
</details>`;

  return `<div class="insight insight-${escape(i.severity)}" data-panel="${escape(i.panel)}" data-rule="${escape(i.ruleId)}">
  <h4 class="insight-headline">${escape(i.headline)}</h4>
  <p class="insight-body">${escape(i.body)}</p>
  <p class="insight-action"><strong>What to do:</strong> ${escape(i.actionItem)}</p>
  ${disclosure}
</div>`;
}

export function renderInsightList(insights: Insight[]): string {
  if (insights.length === 0) return "";
  return `<div class="insight-list">${insights.map(renderInsightBlock).join("\n")}</div>`;
}
