/**
 * A12 — Document Interpreter.
 *
 * Plan §3.1: V1 supports igr_ec (Sonnet) and bhulekh_back (Haiku). The
 * function NEVER throws — it returns a degraded result with
 * `warnings: ["model_error"]` on any failure. The renderer falls back
 * to the upsell gate (₹499) without a summary.
 *
 * Cost gate: pre-flight rejects if the per-report or org-monthly cap
 * would be exceeded.
 */

import { z } from "zod";
import { SYSTEM_PROMPT } from "./prompts/system";
import { buildUserBlocks } from "./prompts/user-document";
import {
  estimateCost,
  makeCostStore,
  modelForDocType,
  preflight,
  type CostStore,
} from "./cost-tracker";
import {
  type ClaudeClient,
  type ClaudeRequest,
  type ClaudeResponse,
  makeClaudeClient as makeSdkClient,
} from "./claude-client";
import {
  InterpretationResultSchema,
  type DocType,
  type DocumentInput,
  type InterpretationResult,
} from "./schema";
import {
  extractDocumentText,
  validateAllQuotes,
} from "./validate-quotes";

const MAX_TOKENS = 2000;
const ESTIMATED_INPUT_TOKENS = 12_000;
const ESTIMATED_OUTPUT_TOKENS = 800;

export type InterpretDeps = {
  client: ClaudeClient;
  costStore: CostStore;
};

export type InterpretArgs = {
  reportId: string;
  orgId: string | null;
  docType: DocType;
  input: DocumentInput;
  pageDims?: { width: number; height: number };
};

const EmptyResult = (
  docType: DocType,
  model: string,
  costCents: number,
  durationMs: number,
  warnings: InterpretationResult["warnings"],
): InterpretationResult => ({
  docType,
  fields: [],
  warnings,
  model,
  costUsdCents: costCents,
  durationMs,
  cacheHit: false,
});

const RawLlmJsonSchema = z.object({
  docType: z.string().optional(),
  fields: z.array(
    z.object({
      field: z.string(),
      value: z.string(),
      quote: z.object({
        text: z.string(),
        page: z.number().optional(),
        bbox: z
          .object({ x: z.number(), y: z.number(), w: z.number(), h: z.number() })
          .optional(),
      }),
      interpretation: z.string(),
      confidence: z.number().min(0).max(1),
    }),
  ),
  plainEnglishSummary: z.string().optional(),
});

/**
 * Parse the raw LLM JSON, separating the plainEnglishSummary from the
 * field array. Plan §3.4: SummaryFieldSchema has quote optional.
 */
function parseLlmResponse(raw: string): {
  fields: Array<z.infer<typeof RawLlmJsonSchema>["fields"][number]>;
  summary?: string;
  parseError: boolean;
} {
  // Find the first { ... } block — Claude may add a leading code fence.
  const fenceMatch = raw.match(/```(?:json)?\s*([\s\S]+?)```/);
  const candidate = fenceMatch ? fenceMatch[1] : raw;
  let parsed: z.infer<typeof RawLlmJsonSchema>;
  try {
    parsed = RawLlmJsonSchema.parse(JSON.parse(candidate));
  } catch {
    return { fields: [], parseError: true };
  }
  return { fields: parsed.fields, summary: parsed.plainEnglishSummary, parseError: false };
}

export async function interpretDocument(args: InterpretArgs): Promise<InterpretationResult> {
  const start = Date.now();
  const model = modelForDocType(args.docType);
  const deps: InterpretDeps = {
    client: makeDefaultClient(),
    costStore: makeCostStore({ orgId: args.orgId }),
  };
  return interpretDocumentWithDeps(args, deps, start);
}

/** Test seam — production calls interpretDocument; tests call this. */
export async function interpretDocumentWithDeps(
  args: InterpretArgs,
  deps: InterpretDeps,
  startMs: number,
): Promise<InterpretationResult> {
  const model = modelForDocType(args.docType);
  const costStore = deps.costStore;

  // Pre-flight cost gate.
  const estimatedCents = estimateCost(model, {
    inputTokens: ESTIMATED_INPUT_TOKENS,
    outputTokens: ESTIMATED_OUTPUT_TOKENS,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
  });
  const gate = await preflight(costStore, args.reportId, args.orgId, args.docType, estimatedCents);
  if (!gate.ok) {
    const warning = gate.reason === "ai_not_purchased" ? "ai_not_purchased" : "model_error";
    return EmptyResult(
      args.docType,
      model,
      0,
      Date.now() - startMs,
      [warning],
    );
  }

  const req: ClaudeRequest = {
    model,
    system: SYSTEM_PROMPT,
    blocks: buildUserBlocks(args.input, args.docType),
    maxTokens: MAX_TOKENS,
  };

  let response: ClaudeResponse;
  try {
    response = await deps.client.call(req);
  } catch (err) {
    return EmptyResult(
      args.docType,
      model,
      0,
      Date.now() - startMs,
      ["model_error"],
    );
  }

  const costCents = estimateCost(model, response.usage);
  await costStore.recordCost({
    reportId: args.reportId,
    orgId: args.orgId,
    docType: args.docType,
    model,
    costCents,
    durationMs: Date.now() - startMs,
    usage: response.usage,
  });

  const { fields, summary, parseError } = parseLlmResponse(response.text);
  if (parseError) {
    return EmptyResult(
      args.docType,
      model,
      costCents,
      Date.now() - startMs,
      ["model_error"],
    );
  }

  // Validate quotes against the document text.
  const docText = extractDocumentText(args.input);
  const { adjustedFields, warnings } = validateAllQuotes(fields as any, docText, args.pageDims);

  // Build the result. Summary lives in `fields[]` as SummaryFieldSchema.
  const resultFields = [...adjustedFields];
  if (summary) {
    resultFields.push({
      field: "plainEnglishSummary",
      value: summary,
      interpretation: "AI-generated summary in plain English",
      confidence: 1.0,
    } as any);
  }

  return InterpretationResultSchema.parse({
    docType: args.docType,
    fields: resultFields,
    warnings,
    model,
    costUsdCents: costCents,
    durationMs: Date.now() - startMs,
    cacheHit: response.cacheHit,
  });
}

// The default client is a no-op stub. Production wires the real Anthropic
// SDK at the apps/web layer; tests inject a fake client.
export function makeDefaultClient(): ClaudeClient {
  // V1 stub: in production the real Anthropic SDK is injected via the
  // apps/web layer. Tests pass their own client. The runtime guard
  // here is to keep `interpretDocument` callable from non-test code;
  // if no real SDK is configured the call will throw, and the wrapper
  // catches it and returns the EmptyResult.
  const stub = {
    messages: {
      create: async () => {
        throw new Error("claude_sdk_not_configured");
      },
    },
  };
  return makeSdkClient(stub as any);
}

// ── Public re-exports ───────────────────────────────────────────────
export {
  InterpretationResultSchema,
  type DocType,
  type DocumentInput,
  type FieldExtraction,
  type FieldSchema,
  type InterpretationResult,
  type SourceQuote,
  type SummaryField,
  type Warning,
} from "./schema";
export { validateAllQuotes, validateQuote, extractDocumentText } from "./validate-quotes";
export {
  estimateCost,
  modelForDocType,
  preflight,
  PER_REPORT_CEILING_CENTS,
  ORG_MONTHLY_CAP_CENTS,
  type CostStore,
  type Usage,
} from "./cost-tracker";
export { makeClaudeClient, type ClaudeClient, type ClaudeRequest, type ClaudeResponse } from "./claude-client";
export { SYSTEM_PROMPT } from "./prompts/system";
export { buildUserBlocks, type ContentBlock } from "./prompts/user-document";
