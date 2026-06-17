/**
 * Claude API client for A12 — Document Interpreter.
 *
 * Plan §3.6: 30s timeout; 1/2/4s exponential backoff on 429. V1 sends
 * prompt-cache headers via the SDK.
 *
 * The client is constructed with an injected `fetch` or SDK instance
 * for testability. Production wires the real Anthropic SDK; tests pass
 * a stub that returns canned responses.
 */

import type { Usage } from "./cost-tracker";

export type ClaudeRequest = {
  model: string;
  system: string;
  blocks: Array<
    | { type: "text"; text: string; cache_control?: { type: "ephemeral" } }
    | { type: "document"; source: { type: "base64"; media_type: string; data: string } }
    | { type: "image"; source: { type: "base64"; media_type: string; data: string } }
  >;
  maxTokens: number;
};

export type ClaudeResponse = {
  text: string;
  usage: Usage;
  cacheHit: boolean;
};

export type ClaudeClient = {
  call(req: ClaudeRequest, signal?: AbortSignal): Promise<ClaudeResponse>;
};

const DEFAULT_TIMEOUT_MS = 30_000;
const BACKOFF_DELAYS_MS = [1000, 2000, 4000];

export const MAX_RETRIES = 3;

export type BackoffFn = (attempt: number) => Promise<void>;
export const defaultBackoff: BackoffFn = async (attempt) => {
  const delay = BACKOFF_DELAYS_MS[Math.min(attempt, BACKOFF_DELAYS_MS.length - 1)];
  await new Promise((resolve) => setTimeout(resolve, delay));
};

export type SdkLike = {
  messages: {
    create(args: {
      model: string;
      system: string;
      messages: Array<{ role: "user"; content: any[] }>;
      max_tokens: number;
    }): Promise<{
      content: Array<{ type: "text"; text: string }>;
      usage: {
        input_tokens: number;
        output_tokens: number;
        cache_read_input_tokens?: number;
        cache_creation_input_tokens?: number;
      };
    }>;
  };
};

export function makeClaudeClient(sdk: SdkLike, opts?: { timeoutMs?: number }): ClaudeClient {
  const timeoutMs = opts?.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  return {
    async call(req, signal) {
      let lastErr: unknown = null;
      for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
        try {
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), timeoutMs);
          // Chain user signal
          signal?.addEventListener("abort", () => controller.abort(), { once: true });

          const res = await sdk.messages.create({
            model: req.model,
            system: req.system,
            messages: [{ role: "user", content: req.blocks }],
            max_tokens: req.maxTokens,
          });

          clearTimeout(timer);
          const text = res.content.find((c) => c.type === "text")?.text ?? "";
          const usage: Usage = {
            inputTokens: res.usage.input_tokens,
            outputTokens: res.usage.output_tokens,
            cacheReadTokens: res.usage.cache_read_input_tokens ?? 0,
            cacheWriteTokens: res.usage.cache_creation_input_tokens ?? 0,
          };
          const cacheHit = usage.cacheReadTokens > 0;
          return { text, usage, cacheHit };
        } catch (err: any) {
          lastErr = err;
          if (err?.status === 429 && attempt < MAX_RETRIES - 1) {
            await defaultBackoff(attempt);
            continue;
          }
          if (err?.name === "AbortError") {
            throw new Error("claude_timeout");
          }
          throw err;
        }
      }
      throw lastErr;
    },
  };
}
