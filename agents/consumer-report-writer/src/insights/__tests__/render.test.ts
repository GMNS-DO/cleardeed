// agents/consumer-report-writer/src/insights/__tests__/render.test.ts
import { describe, it, expect } from "vitest";
import { renderInsightBlock, renderInsightList } from "../render";
import type { Insight } from "../schema";

const base: Insight = {
  panel: "plot",
  issueLens: "title_chain",
  evidenceStrength: "document_anchor",
  source: "bhulekh:ror:page-1",
  severity: "watchout",
  headline: "Owner mismatch",
  body: "Owner does not match RoR.",
  actionItem: "Ask seller.",
  ruleId: "ROR-INS-001",
  disclosure: {
    whatWeChecked: "The RoR owner field on page 1.",
    howToVerify: "Open the RoR PDF on bhulekh.ori.nic.in.",
    limitsOfThisCheck: "We did not verify the mutation chain.",
  },
};

describe("render", () => {
  it("renderInsightBlock includes a <details> element closed by default", () => {
    const html = renderInsightBlock(base);
    expect(html).toContain("<details");
    expect(html).not.toContain("<details open");
  });

  it("renderInsightBlock escapes the rule id and source", () => {
    const html = renderInsightBlock({
      ...base,
      source: "bhulekh:ror:<script>",
      ruleId: "ROR-INS-001",
    });
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("renderInsightList groups by panel", () => {
    const html = renderInsightList([base, { ...base, panel: "owner" }]);
    expect(html).toContain("data-panel=\"plot\"");
    expect(html).toContain("data-panel=\"owner\"");
  });
});
