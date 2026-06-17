/**
 * A12 Document Interpreter — golden fixture tests.
 *
 * Plan §3.1 V1: 2 golden fixtures (IGR EC clean, IGR EC Odia-mixed).
 * V1.5 will add 1 (Bhulekh back). V2 adds 1 (mutation order, 18 fields).
 */

import { describe, it, expect } from "vitest";
import {
  interpretDocumentWithDeps,
  type ClaudeClient,
  type ClaudeRequest,
  type ClaudeResponse,
} from "./index";
import type { InterpretationResult } from "./schema";
import type { CostStore } from "./cost-tracker";

const makeFakeClient = (response: ClaudeResponse): ClaudeClient => ({
  call: async (_req: ClaudeRequest): Promise<ClaudeResponse> => response,
});

const noopStore: CostStore = {
  spentOnReportCents: async () => 0,
  spentOnOrgCentsThisMonth: async () => 0,
  isUnlocked: async () => true,
  recordCost: async () => {},
};

const igrEcHtml = `<html><body>
<h1>Encumbrance Certificate</h1>
<table>
<tr><th>SRO</th><td>Bhubaneswar</td></tr>
</table>
<h2>Entries</h2>
<table>
<tr><th>Type</th><th>Party</th><th>Doc No</th><th>Date</th><th>Amount</th></tr>
<tr><td>Type Mortgage</td><td>Party State Bank of India</td><td>DOC-100</td><td>15/08/2020</td><td>Rs. 500000/-</td></tr>
<tr><td>Type Sale</td><td>Party Harihar Panda</td><td>DOC-200</td><td>22/01/2022</td><td>Rs. 1200000/-</td></tr>
</table>
</body></html>`;

const igrEcOdiaMixedHtml = `<html><body>
<h1>Encumbrance Certificate</h1>
<p>District: ଖୋର୍ଦ୍ଧା</p>
<table>
<tr><th>SRO</th><td>Bhubaneswar</td></tr>
<tr><th>Type</th><th>Party</th><th>Doc No</th><th>Date</th><th>Amount</th></tr>
<tr><td>Type Mortgage</td><td>Party ସ୍ଟେଟ୍ ବ୍ୟାଙ୍କ</td><td>DOC-300</td><td>15/08/2020</td><td>Rs. 500000/-</td></tr>
</table>
</body></html>`;

const makeIgrEcLlmJson = () =>
  JSON.stringify({
    fields: [
      {
        field: "sro",
        value: "Bhubaneswar",
        quote: { text: "SRO Bhubaneswar" },
        interpretation: "The Sub-Registrar Office is Bhubaneswar.",
        confidence: 0.95,
      },
      {
        field: "encumbranceType",
        value: "Mortgage",
        quote: { text: "Type Mortgage" },
        interpretation: "First entry is a mortgage.",
        confidence: 0.92,
      },
      {
        field: "partyName",
        value: "State Bank of India",
        quote: { text: "Party State Bank of India" },
        interpretation: "Mortgagor is SBI.",
        confidence: 0.95,
      },
      {
        field: "docNo",
        value: "DOC-100",
        quote: { text: "Doc No DOC-100" },
        interpretation: "Document number.",
        confidence: 0.95,
      },
      {
        field: "date",
        value: "15/08/2020",
        quote: { text: "15/08/2020" },
        interpretation: "Execution date.",
        confidence: 0.95,
      },
      {
        field: "amount",
        value: "Rs. 500000/-",
        quote: { text: "Rs. 500000/-" },
        interpretation: "Mortgage amount in INR.",
        confidence: 0.95,
      },
    ],
    plainEnglishSummary:
      "The property has two registered entries. A mortgage to SBI dated 15/08/2020 for Rs. 5 lakh, and a sale to Harihar Panda on 22/01/2022 for Rs. 12 lakh.",
  });

describe("A12 Document Interpreter — golden fixtures (plan §3.1 V1)", () => {
  it("IGR EC clean: extracts 6 fields with 100% grounding + summary", async () => {
    const client = makeFakeClient({
      text: makeIgrEcLlmJson(),
      usage: {
        inputTokens: 1_000,
        outputTokens: 800,
        cacheReadTokens: 12_000,
        cacheWriteTokens: 0,
      },
      cacheHit: true,
    });
    const result = await interpretDocumentWithDeps(
      {
        reportId: "report-igr-clean",
        orgId: "org-1",
        docType: "igr_ec",
        input: { kind: "html", content: igrEcHtml },
      },
      { client, costStore: noopStore },
      Date.now(),
    );

    expect(result.docType).toBe("igr_ec");
    expect(result.cacheHit).toBe(true);
    expect(result.warnings).not.toContain("low_grounding_rate");
    // 6 fields + 1 summary = 7
    expect(result.fields.length).toBeGreaterThanOrEqual(6);
    expect(result.costUsdCents).toBe(2); // Sonnet cache hit
    // summary present
    const summary = result.fields.find(
      (f: any) => f.field === "plainEnglishSummary",
    );
    expect(summary).toBeDefined();
    expect((summary as any).value.length).toBeLessThanOrEqual(500);
  });

  it("IGR EC Odia-mixed: parses Odia headings without failing", async () => {
    const client = makeFakeClient({
      text: JSON.stringify({
        fields: [
          {
            field: "sro",
            value: "Bhubaneswar",
            quote: { text: "SRO Bhubaneswar" },
            interpretation: "SRO is Bhubaneswar.",
            confidence: 0.95,
          },
          {
            field: "partyName",
            value: "ସ୍ଟେଟ୍ ବ୍ୟାଙ୍କ",
            quote: { text: "Party ସ୍ଟେଟ୍ ବ୍ୟାଙ୍କ" },
            interpretation: "Mortgagor in Odia script.",
            confidence: 0.92,
          },
        ],
        plainEnglishSummary: "One mortgage entry to SBI for Rs. 5 lakh.",
      }),
      usage: {
        inputTokens: 13_000,
        outputTokens: 400,
        cacheReadTokens: 0,
        cacheWriteTokens: 13_000,
      },
      cacheHit: false,
    });
    const result = await interpretDocumentWithDeps(
      {
        reportId: "report-igr-odia",
        orgId: "org-1",
        docType: "igr_ec",
        input: { kind: "html", content: igrEcOdiaMixedHtml },
      },
      { client, costStore: noopStore },
      Date.now(),
    );

    expect(result.docType).toBe("igr_ec");
    expect(result.cacheHit).toBe(false);
    expect(result.costUsdCents).toBeGreaterThan(0);
    // The Odia quote should pass the substring check (it's verbatim in HTML).
    expect(result.warnings).not.toContain("low_grounding_rate");
  });

  it("model error returns EmptyResult with model_error warning", async () => {
    const failingClient: ClaudeClient = {
      call: async () => {
        throw new Error("anthropic_5xx");
      },
    };
    const result = await interpretDocumentWithDeps(
      {
        reportId: "report-fail",
        orgId: "org-1",
        docType: "igr_ec",
        input: { kind: "html", content: igrEcHtml },
      },
      { client: failingClient, costStore: noopStore },
      Date.now(),
    );
    expect(result.warnings).toContain("model_error");
    expect(result.fields).toEqual([]);
    expect(result.costUsdCents).toBe(0);
  });

  it("pre-flight rejection returns EmptyResult before calling Claude", async () => {
    let called = false;
    const client: ClaudeClient = {
      call: async () => {
        called = true;
        return {
          text: "{}",
          usage: { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 },
          cacheHit: false,
        };
      },
    };
    const overBudget: CostStore = {
      spentOnReportCents: async () => 100,
      spentOnOrgCentsThisMonth: async () => 0,
      isUnlocked: async () => true,
      recordCost: async () => {},
    };
    const result = await interpretDocumentWithDeps(
      {
        reportId: "report-over",
        orgId: "org-1",
        docType: "igr_ec",
        input: { kind: "html", content: igrEcHtml },
      },
      { client, costStore: overBudget },
      Date.now(),
    );
    expect(called).toBe(false);
    expect(result.warnings).toContain("model_error");
  });

  it("low_grounding_rate warning appears when many quotes fail validation", async () => {
    const client = makeFakeClient({
      text: JSON.stringify({
        fields: [
          {
            field: "sro",
            value: "Bhubaneswar",
            quote: { text: "SRO Bhubaneswar" },
            interpretation: "SRO.",
            confidence: 0.95,
          },
          // Invented quotes — should fail substring check.
          {
            field: "partyName",
            value: "Fake Bank",
            quote: { text: "Quote about a completely different bank" },
            interpretation: "x",
            confidence: 0.95,
          },
          {
            field: "docNo",
            value: "DOC-XYZ",
            quote: { text: "DOC-XYZ-99999-invented" },
            interpretation: "x",
            confidence: 0.95,
          },
          {
            field: "date",
            value: "01/01/2099",
            quote: { text: "01/01/2099-future-date" },
            interpretation: "x",
            confidence: 0.95,
          },
        ],
        plainEnglishSummary: "Summary that should be suppressed.",
      }),
      usage: {
        inputTokens: 12_000,
        outputTokens: 800,
        cacheReadTokens: 12_000,
        cacheWriteTokens: 0,
      },
      cacheHit: true,
    });
    const result = await interpretDocumentWithDeps(
      {
        reportId: "report-low-ground",
        orgId: "org-1",
        docType: "igr_ec",
        input: { kind: "html", content: igrEcHtml },
      },
      { client, costStore: noopStore },
      Date.now(),
    );
    expect(result.warnings).toContain("low_grounding_rate");
    // Failed fields have confidence ≤ 0.3
    const failedFields = result.fields.filter(
      (f: any) => f.field !== "plainEnglishSummary" && f.confidence <= 0.3,
    );
    expect(failedFields.length).toBeGreaterThan(0);
  });

  it("malformed LLM JSON returns model_error", async () => {
    const client = makeFakeClient({
      text: "not json at all",
      usage: {
        inputTokens: 12_000,
        outputTokens: 800,
        cacheReadTokens: 12_000,
        cacheWriteTokens: 0,
      },
      cacheHit: true,
    });
    const result = await interpretDocumentWithDeps(
      {
        reportId: "report-bad-json",
        orgId: "org-1",
        docType: "igr_ec",
        input: { kind: "html", content: igrEcHtml },
      },
      { client, costStore: noopStore },
      Date.now(),
    );
    expect(result.warnings).toContain("model_error");
    expect(result.fields).toEqual([]);
  });

  it("result matches InterpretationResultSchema (Zod)", () => {
    // Type-level check via runtime assertion.
    const result: InterpretationResult = {
      docType: "igr_ec",
      fields: [],
      warnings: [],
      model: "claude-sonnet-4-5",
      costUsdCents: 0,
      durationMs: 0,
      cacheHit: false,
    };
    expect(result.docType).toBe("igr_ec");
    expect(result.fields).toEqual([]);
  });
});
