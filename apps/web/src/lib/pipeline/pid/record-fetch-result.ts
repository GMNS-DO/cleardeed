/**
 * Top-level entry point for recording a fetcher's result in the PID layer.
 *
 * Called from the report pipeline after each fetcher returns. The pipeline
 * MUST be tolerant of PID failures (per D-024/D-025) — if every write fails
 * we return null and the report continues. PID is a corpus layer; it does
 * not gate the user-visible product.
 *
 * Order of writes (matters for foreign keys):
 *   1) pid_property (so subject_id is available for facts)
 *   2) pid_artifact (if raw bytes were saved)
 *   3) pid_fact_assertions (append-only)
 *   4) pid_event (one fetch_completed event)
 */
import { mapSourceResultToPid, type MapperInput } from "./mapper";
import {
  pidUpsertArtifact,
  pidInsertFactAssertion,
  pidInsertEvent,
  pidUpsertProperty,
} from "./client";

export interface RecordFetchResultOutput {
  artifactId?: string;
  factIds: string[];
  eventId?: string;
  propertyId?: string;
}

export async function recordFetchResult(
  sourceId: string,
  input: Record<string, unknown>,
  sourceResult: MapperInput,
  _reportId?: string
): Promise<RecordFetchResultOutput | null> {
  try {
    const payload = mapSourceResultToPid(sourceResult);

    // Short-circuit: nothing recordable
    if (
      !payload.artifact &&
      payload.facts.length === 0 &&
      payload.events.length === 0 &&
      !payload.property
    ) {
      return null;
    }

    // 1) Property (no-op if no location data in payload)
    let propertyId: string | undefined;
    if (payload.property) {
      propertyId = (await pidUpsertProperty(payload.property)) ?? undefined;
    }

    // 2) Artifact
    let artifactId: string | undefined;
    if (payload.artifact) {
      // If a reportId was provided, thread it into the artifact metadata
      // so readPidArtifactsForReport(reportId) can find it.
      if (_reportId) {
        payload.artifact.metadata = { ...payload.artifact.metadata, report_id: _reportId };
      }
      artifactId = (await pidUpsertArtifact(payload.artifact)) ?? undefined;
    }

    // 3) Facts
    const factIds: string[] = [];
    for (const fact of payload.facts) {
      const factWithSubject: typeof fact = { ...fact };
      if (propertyId && !factWithSubject.subjectId) {
        factWithSubject.subjectId = propertyId;
        factWithSubject.subjectType = "property";
      }
      if (artifactId) {
        factWithSubject.artifactId = artifactId;
      }
      const id = await pidInsertFactAssertion(factWithSubject);
      if (id) factIds.push(id);
    }

    // 4) Event(s)
    let eventId: string | undefined;
    for (const event of payload.events) {
      const eventWithRefs: typeof event = { ...event };
      if (propertyId) eventWithRefs.propertyId = propertyId;
      if (artifactId) eventWithRefs.artifactId = artifactId;
      if (_reportId) eventWithRefs.metadata = { ...eventWithRefs.metadata, report_id: _reportId };
      const id = await pidInsertEvent(eventWithRefs);
      if (id) eventId = id;
    }

    return { artifactId, factIds, eventId, propertyId };
  } catch (err) {
    console.warn(
      `[pid/recordFetchResult] ${sourceId} threw: ${(err as Error).message}`
    );
    return null;
  }
}
