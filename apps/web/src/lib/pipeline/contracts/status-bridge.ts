/**
 * Sprint V2 — Status vocabulary bridge.
 *
 * The typed contract layer (per-fetcher `SourceResultContract`) uses a narrow,
 * five-value status set: `ok | no_data | source_down | invalid_input | parse_error`.
 * The existing pipeline + consumer-report-writer + observability stack reads
 * the wider fetcher-native vocabulary: `success | partial | failed | error |
 * not_run | not_covered | manual_required | out_of_scope | unconfirmed`.
 *
 * This module is a *helper*, not a refactor. It exists so that any future
 * consumer (mapper upgrade, PID ingest, observability dashboard) can take a
 * typed `ContractStatus` and project it into the renderer vocabulary without
 * having to remember the mapping table. It is intentionally side-effect-free
 * and dependency-free.
 *
 * The mapping is one-way (`ContractStatus → renderer vocabulary`). The reverse
 * is unnecessary because the typed envelope is built from the fetcher's native
 * status, not the renderer's.
 */
import type { ContractStatus } from "./types";

/** The renderer-facing vocabulary. Mirrors the values that
 * `SourceResultBase.status` accepts and the consumer-report-writer
 * `sourceStatus` block understands. */
export type RendererStatus =
  | "success"
  | "partial"
  | "failed"
  | "error"
  | "not_run"
  | "not_covered"
  | "manual_required"
  | "out_of_scope";

/**
 * Project a typed `ContractStatus` into the renderer vocabulary.
 *
 * Mapping rationale (kept conservative — preserves the existing report
 * behavior; the renderer treats all "negative" outcomes as degraded rather
 * than as a different *kind* of outcome):
 *
 *   - `ok`            → `success`        (data present and valid)
 *   - `no_data`       → `partial`        (typed "no hits" — not a failure,
 *                                         the report renders "no cases found")
 *   - `source_down`   → `manual_required` (portal unavailable; report asks
 *                                         the buyer to verify manually)
 *   - `invalid_input` → `error`          (request was malformed)
 *   - `parse_error`   → `partial`        (data came back but couldn't be
 *                                         parsed — surface as a soft
 *                                         degradation, not a hard error)
 */
export function projectContractStatus(status: ContractStatus): RendererStatus {
  switch (status) {
    case "ok":
      return "success";
    case "no_data":
      return "partial";
    case "source_down":
      return "manual_required";
    case "invalid_input":
      return "error";
    case "parse_error":
      return "partial";
  }
}
