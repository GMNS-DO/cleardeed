/**
 * Sprint V2 — Fetcher contract base types.
 *
 * Every ClearDeed fetcher must return either:
 *   - a typed-correct result matching its `SourceResultContract` (status: "ok"), or
 *   - a typed error (status: "no_data" | "source_down" | "invalid_input" | "parse_error").
 *
 * The point of this module is type discipline, not a new abstraction over the
 * existing `SourceResultBase` from `@cleardeed/schema`. Per-fetcher contract
 * schemas (in the sibling files) extend the discriminated union below with
 * source-specific data and source literal names.
 *
 * Per CLAUDE.md: no new abstractions on first pass. These types are the minimum
 * surface needed to make a typed contract per fetcher. The existing fetcher code
 * is NOT modified; this layer sits alongside it for V2 contract tests.
 */
import { z } from "zod";

/**
 * The five possible terminal states a fetcher can declare.
 *
 * Mapping note: the existing `SourceResultBase.status` uses
 * "success" / "partial" / "failed" / "error" / "not_covered". The V2 contract
 * status set is intentionally narrower because the contract is the *result of
 * the fetcher* (a single typed deliverable), not the pipeline-level
 * verification state. mappers (added in V3) translate between the two.
 */
export const ContractStatus = z.enum([
  "ok",
  "no_data",
  "source_down",
  "invalid_input",
  "parse_error",
]);
export type ContractStatus = z.infer<typeof ContractStatus>;

/**
 * Every contract carries the same envelope:
 *   - status:           the typed terminal state
 *   - data:             the typed payload (only when status === "ok")
 *   - error:            structured error (only when status !== "ok")
 *   - fetchedAt:        ISO 8601 timestamp of the fetch attempt
 *   - sourceUrl:        the portal URL hit (or local data file path)
 *   - latencyMs:        wall-clock latency of the fetch attempt
 *
 * The TSource literal comes from the per-fetcher discriminated union, so a
 * SourceResultContract<'bhulekh', ...> can be distinguished at the type level
 * from a SourceResultContract<'bhunaksha', ...> by the `source` field.
 */
export const ContractEnvelopeBase = z.object({
  status: ContractStatus,
  fetchedAt: z.string().datetime(),
  sourceUrl: z.string(),
  latencyMs: z.number().nonnegative(),
});
export type ContractEnvelopeBase = z.infer<typeof ContractEnvelopeBase>;

/**
 * Structured error payload for non-`ok` statuses. Kept loose (record of
 * strings) because the failure mode varies per fetcher — e.g. captcha failure
 * on CERSAI has different fields than WFS timeout on Bhunaksha.
 */
export const ContractError = z.object({
  code: z.string(),
  message: z.string(),
  details: z.record(z.string()).optional(),
});
export type ContractError = z.infer<typeof ContractError>;

/**
 * Generic shape of a fetcher contract: a discriminated union over `status`.
 *
 * Each per-fetcher contract schema uses this as its envelope, with `Data`
 * (a source-specific Zod object) spliced in via the `data` field.
 *
 * Example per-fetcher definition:
 *
 *   export const BhulekhContract = z.discriminatedUnion("status", [
 *     z.object({ status: z.literal("ok"),
 *                data: BhulekhDataSchema,
 *                ...envelope }),
 *     z.object({ status: z.enum(["no_data", "source_down",
 *                                "invalid_input", "parse_error"]),
 *                error: ContractError,
 *                ...envelope }),
 *   ]);
 */
export type SourceResultContract<TSource extends string, TData> =
  | (ContractEnvelopeBase & {
      status: "ok";
      source: TSource;
      data: TData;
    })
  | (ContractEnvelopeBase & {
      status: Exclude<ContractStatus, "ok">;
      source: TSource;
      error: ContractError;
    });

/**
 * Helper: build the success branch of a contract given a source name and the
 * data Zod schema. Use this inside each per-fetcher contract file to keep the
 * shape uniform.
 */
export const successBranch = <TData extends z.ZodTypeAny>(
  source: string,
  dataSchema: TData
) =>
  ContractEnvelopeBase.extend({
    source: z.literal(source),
    status: z.literal("ok"),
    data: dataSchema,
  });

/**
 * Helper: build the failure branches (all non-`ok` statuses share the same
 * `error` shape). Per-fetcher schemas use this to keep things DRY.
 */
export const failureBranches = (source: string) =>
  z.discriminatedUnion("status", [
    ContractEnvelopeBase.extend({
      source: z.literal(source),
      status: z.literal("no_data"),
      error: ContractError,
    }),
    ContractEnvelopeBase.extend({
      source: z.literal(source),
      status: z.literal("source_down"),
      error: ContractError,
    }),
    ContractEnvelopeBase.extend({
      source: z.literal(source),
      status: z.literal("invalid_input"),
      error: ContractError,
    }),
    ContractEnvelopeBase.extend({
      source: z.literal(source),
      status: z.literal("parse_error"),
      error: ContractError,
    }),
  ]);
