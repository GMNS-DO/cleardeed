/**
 * SourceResult → PidWritePayload mapper.
 *
 * Pure function. No I/O. Converts a fetcher's output envelope into the
 * PID write payloads: one optional artifact, zero or more fact assertions,
 * zero or more events, one optional property.
 *
 * Status semantics:
 *   - "ok" or "partial" → emit artifact + facts + fetch_completed event
 *   - "no_data", "source_down", "parse_error", "invalid_input", "manual_required"
 *     → emit nothing (or only a fetch_attempted event if rawArtifactHash present)
 *
 * The mapper knows about the SourceResult shape. It does NOT know about
 * Supabase, the pipeline, or the report renderer. Keeping it pure means
 * a snapshot test (Task A.4) gives full coverage.
 */
import { computeArtifactKey } from "./keys";
import type {
  SourceArtifact,
  FactAssertionInput,
  EventInput,
  PropertyInput,
} from "./types";

export interface PidWritePayload {
  artifact?: SourceArtifact;
  facts: FactAssertionInput[];
  events: EventInput[];
  property?: PropertyInput;
}

// Minimal shape the mapper needs from a SourceResult. We re-declare instead
// of importing the full @cleardeed/orchestrator type to avoid pulling the
// whole fetcher graph into the test.
export interface MapperInput {
  status: string;
  sourceId: string;
  input: Record<string, unknown>;
  data: Record<string, unknown>;
  fetchedAt: string;
  rawArtifactHash?: string;
  rawArtifactPath?: string;
  rawContentType?: string;
  rawByteSize?: number;
  rawHttpStatus?: number;
}

const RECORDABLE_STATUSES = new Set(["ok", "partial"]);

function isRecordable(input: MapperInput): boolean {
  return RECORDABLE_STATUSES.has(input.status);
}

export function mapSourceResultToPid(input: MapperInput): PidWritePayload {
  const empty: PidWritePayload = { facts: [], events: [] };

  if (!isRecordable(input)) {
    // No artifact, no facts. But still emit a fetch_attempted event if we
    // have a raw artifact, so the corpus knows the source was reached.
    if (input.rawArtifactHash && input.rawArtifactPath) {
      empty.events.push({
        eventType: "fetch_attempted",
        sourceId: input.sourceId as never,
        eventSummary: `status=${input.status}`,
        metadata: { artifact_key: computeArtifactKey(input.sourceId, input.input) },
      });
    }
    return empty;
  }

  // 1) Artifact
  let artifact: SourceArtifact | undefined;
  if (input.rawArtifactHash && input.rawArtifactPath) {
    artifact = {
      artifactKey: computeArtifactKey(input.sourceId, input.input),
      sourceId: input.sourceId as never,
      artifactType: guessArtifactType(input.rawContentType, input.rawArtifactPath),
      storagePath: input.rawArtifactPath,
      sha256: input.rawArtifactHash,
      contentType: input.rawContentType,
      byteSize: input.rawByteSize,
      httpStatus: input.rawHttpStatus,
      retrievedAt: input.fetchedAt,
      query: input.input,
      metadata: { status: input.status },
    };
  }

  // 2) Property (location identity)
  let property: PropertyInput | undefined;
  const data = input.data ?? {};
  if (data.district || data.tahasil || data.village) {
    property = {
      district: typeof data.district === "string" ? data.district : undefined,
      tahasil: typeof data.tahasil === "string" ? data.tahasil : undefined,
      village: typeof data.village === "string" ? data.village : undefined,
      mouza: typeof data.mouza === "string" ? data.mouza : undefined,
      khataNumber: typeof data.khataNo === "string" ? data.khataNo
        : typeof data.khata_number === "string" ? data.khata_number : undefined,
      plotNumber: typeof data.plotNo === "string" || typeof data.plotNo === "number"
        ? String(data.plotNo) : typeof data.plot_number === "string"
        ? data.plot_number : undefined,
      metadata: { source_id: input.sourceId },
    };
  }

  // 3) Facts — known predicate extractors. Add new extractors as new
  //    fetcher outputs need to land as PID facts.
  const facts: FactAssertionInput[] = [];
  const sourceId = input.sourceId as never;

  // Bhulekh tenants → owner_name facts
  if (Array.isArray(data.tenants)) {
    for (const t of data.tenants as Array<Record<string, unknown>>) {
      if (typeof t.name === "string") {
        facts.push({
          subjectType: "property",
          predicate: "owner_name",
          rawValue: t.name,
          sourceId,
          metadata: { source: "bhulekh.tenants" },
        });
      }
    }
  }

  // Bhunaksha plot_no → plot_number fact
  if (typeof data.plotNo === "string" || typeof data.plotNo === "number") {
    facts.push({
      subjectType: "property",
      predicate: "plot_number",
      rawValue: String(data.plotNo),
      sourceId,
    });
  }

  // Nominatim displayName → display_name fact
  if (typeof data.displayName === "string") {
    facts.push({
      subjectType: "property",
      predicate: "display_name",
      rawValue: data.displayName,
      sourceId,
    });
  }

  // 4) One fetch_completed event for every successful fetch
  const events: EventInput[] = [
    {
      eventType: "fetch_completed",
      sourceId,
      recordedAt: input.fetchedAt,
      eventSummary: `status=${input.status}`,
      metadata: {
        artifact_key: computeArtifactKey(input.sourceId, input.input),
        fact_count: facts.length,
      },
    },
  ];

  return { artifact, facts, events, property };
}

function guessArtifactType(
  contentType: string | undefined,
  path: string | undefined
): string {
  if (contentType?.includes("html")) return "html";
  if (contentType?.includes("json")) return "json";
  if (contentType?.includes("pdf")) return "pdf";
  if (contentType?.includes("image")) return "image";
  if (path?.endsWith(".html")) return "html";
  if (path?.endsWith(".json")) return "json";
  if (path?.endsWith(".pdf")) return "pdf";
  if (path?.endsWith(".png") || path?.endsWith(".jpg")) return "image";
  return "other";
}