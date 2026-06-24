import { createHash } from "node:crypto";

/**
 * Deterministic artifact key for a fetcher call.
 *
 * Same (sourceId, input) → same key. Used as the unique constraint
 * on pid_artifacts.artifact_key for idempotent re-runs.
 *
 * Key order is normalized by sorting object keys before stringifying,
 * so {a:1,b:2} and {b:2,a:1} produce the same key.
 */
export function computeArtifactKey(
  sourceId: string,
  input: Record<string, unknown>
): string {
  if (!sourceId || typeof sourceId !== "string") {
    throw new Error("computeArtifactKey: sourceId is required and must be a string");
  }
  const normalized = JSON.stringify(input, Object.keys(input).sort());
  return createHash("sha256")
    .update(`${sourceId}:${normalized}`)
    .digest("hex");
}
