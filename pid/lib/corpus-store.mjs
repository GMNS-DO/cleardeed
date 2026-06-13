import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, stat, appendFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { PID_CORPUS_FILES, PID_CORPUS_ROOT } from "../config.js";
import { propertyCanonicalKey, normalizeName } from "./normalizers.mjs";

export function stableHash(value) {
  return createHash("sha256").update(typeof value === "string" ? value : JSON.stringify(value)).digest("hex");
}

export async function ensureCorpusRoot() {
  await mkdir(PID_CORPUS_ROOT, { recursive: true });
}

export async function appendJsonl(path, row) {
  await mkdir(dirname(path), { recursive: true });
  await appendFile(path, `${JSON.stringify(row)}\n`);
  return row;
}

export async function readJsonl(path) {
  try {
    const text = await readFile(path, "utf8");
    return text
      .split(/\n+/)
      .filter(Boolean)
      .map((line) => JSON.parse(line));
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
}

export async function writeJsonl(path, rows) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, rows.map((row) => JSON.stringify(row)).join("\n") + (rows.length ? "\n" : ""));
}

export async function fileInfo(path) {
  const buffer = await readFile(path);
  const stats = await stat(path);
  return {
    sha256: stableHash(buffer),
    byte_size: stats.size,
  };
}

export class LocalCorpusStore {
  constructor(files = PID_CORPUS_FILES) {
    this.files = files;
  }

  async init() {
    await ensureCorpusRoot();
    return this;
  }

  async addArtifact(input) {
    const artifact = {
      id: input.id || randomUUID(),
      artifact_key: input.artifact_key || stableHash({
        source_id: input.source_id,
        storage_path: input.storage_path,
        source_url: input.source_url,
        source_origin: input.source_origin,
      }),
      source_id: input.source_id,
      artifact_type: input.artifact_type,
      document_type: input.document_type || null,
      source_url: input.source_url || null,
      source_origin: input.source_origin || null,
      access_mode: input.access_mode || "unknown",
      query: input.query || {},
      storage_path: input.storage_path,
      sha256: input.sha256,
      byte_size: input.byte_size || null,
      content_type: input.content_type || null,
      retrieved_at: input.retrieved_at || new Date().toISOString(),
      parser_status: input.parser_status || "raw_saved",
      metadata: input.metadata || {},
    };
    return appendJsonl(this.files.artifacts, artifact);
  }

  async addArtifactRepresentation(input) {
    const representation = {
      id: input.id || randomUUID(),
      artifact_id: input.artifact_id,
      representation_type: input.representation_type,
      storage_path: input.storage_path,
      sha256: input.sha256 || null,
      created_by: input.created_by || "local_extractor",
      extraction_run_key: input.extraction_run_key || null,
      confidence: input.confidence ?? null,
      metadata: input.metadata || {},
      created_at: input.created_at || new Date().toISOString(),
    };
    return appendJsonl(this.files.artifactRepresentations, representation);
  }

  async addExtraction(input) {
    const extraction = {
      id: input.id || randomUUID(),
      artifact_id: input.artifact_id,
      extraction_type: input.extraction_type,
      extractor_name: input.extractor_name,
      extractor_version: input.extractor_version || null,
      status: input.status || "pending",
      normalized_text_sha256: input.normalized_text_sha256 || null,
      text_storage_path: input.text_storage_path || null,
      confidence: input.confidence ?? null,
      fields: input.fields || {},
      errors: input.errors || [],
      created_at: input.created_at || new Date().toISOString(),
    };
    return appendJsonl(this.files.extractions, extraction);
  }

  async addTextChunk(input) {
    const chunk = {
      id: input.id || randomUUID(),
      artifact_id: input.artifact_id,
      extraction_id: input.extraction_id || null,
      chunk_index: input.chunk_index,
      page_number: input.page_number ?? null,
      section_label: input.section_label || null,
      chunk_text: input.chunk_text,
      chunk_hash: input.chunk_hash || stableHash(input.chunk_text),
      token_count: input.token_count ?? null,
      metadata: input.metadata || {},
      created_at: input.created_at || new Date().toISOString(),
    };
    return appendJsonl(this.files.textChunks, chunk);
  }

  async addProperty(input) {
    const property = {
      id: input.id || randomUUID(),
      canonical_key: input.canonical_key || propertyCanonicalKey(input),
      state: input.state || "Odisha",
      district: input.district || null,
      tahasil: input.tahasil || null,
      village: input.village || null,
      mouza: input.mouza || null,
      khata_number: input.khata_number || null,
      plot_number: input.plot_number || null,
      survey_number: input.survey_number || null,
      area_value: input.area_value ?? null,
      area_unit: input.area_unit || null,
      geometry_ref: input.geometry_ref || null,
      identity_confidence: input.identity_confidence ?? null,
      metadata: input.metadata || {},
      created_at: input.created_at || new Date().toISOString(),
    };
    return appendJsonl(this.files.properties, property);
  }

  async addEntity(input) {
    const entity = {
      id: input.id || randomUUID(),
      entity_type: input.entity_type || "unknown",
      canonical_name: input.canonical_name || input.name,
      normalized_name: input.normalized_name || normalizeName(input.canonical_name || input.name),
      jurisdiction: input.jurisdiction || null,
      confidence: input.confidence ?? null,
      metadata: input.metadata || {},
      created_at: input.created_at || new Date().toISOString(),
    };
    return appendJsonl(this.files.entities, entity);
  }

  async addDocument(input) {
    const document = {
      id: input.id || randomUUID(),
      artifact_id: input.artifact_id || null,
      document_type: input.document_type,
      document_number: input.document_number || null,
      document_date: input.document_date || null,
      registration_date: input.registration_date || null,
      issuing_authority: input.issuing_authority || null,
      sro: input.sro || null,
      status: input.status || null,
      title: input.title || null,
      summary: input.summary || null,
      metadata: input.metadata || {},
      created_at: input.created_at || new Date().toISOString(),
    };
    return appendJsonl(this.files.documents, document);
  }

  async addCase(input) {
    const caseRecord = {
      id: input.id || randomUUID(),
      artifact_id: input.artifact_id || null,
      case_source: input.case_source,
      case_number: input.case_number || null,
      cnr: input.cnr || null,
      court_or_forum: input.court_or_forum || null,
      case_type: input.case_type || null,
      filing_date: input.filing_date || null,
      disposal_date: input.disposal_date || null,
      status: input.status || null,
      district: input.district || null,
      parties: input.parties || [],
      issue_summary: input.issue_summary || null,
      outcome_summary: input.outcome_summary || null,
      // P-NEW-2: Resolution tracking fields (D-089 / P-NEW-3 dependency)
      resolution_mechanism: input.resolution_mechanism || null,
      resolution_date: input.resolution_date || null,
      resolution_summary: input.resolution_summary || null,
      buyer_action_that_succeeded: input.buyer_action_that_succeeded || null,
      deciding_factor: input.deciding_factor || null,
      remedy_type: input.remedy_type || null,
      case_outcome: input.case_outcome || null,
      metadata: input.metadata || {},
      created_at: input.created_at || new Date().toISOString(),
    };
    return appendJsonl(this.files.cases, caseRecord);
  }

  async addCharge(input) {
    const charge = {
      id: input.id || randomUUID(),
      artifact_id: input.artifact_id || null,
      charge_source: input.charge_source,
      charge_status: input.charge_status || null,
      borrower_entity_id: input.borrower_entity_id || null,
      creditor_entity_id: input.creditor_entity_id || null,
      property_id: input.property_id || null,
      amount: input.amount ?? null,
      charge_type: input.charge_type || null,
      creation_date: input.creation_date || null,
      satisfaction_date: input.satisfaction_date || null,
      property_description: input.property_description || null,
      metadata: input.metadata || {},
      created_at: input.created_at || new Date().toISOString(),
    };
    return appendJsonl(this.files.charges, charge);
  }

  async addRelationship(input) {
    const relationship = {
      id: input.id || randomUUID(),
      from_type: input.from_type,
      from_id: input.from_id,
      to_type: input.to_type,
      to_id: input.to_id,
      relationship_type: input.relationship_type,
      source_id: input.source_id || null,
      artifact_id: input.artifact_id || null,
      event_id: input.event_id || null,
      valid_from: input.valid_from || null,
      valid_to: input.valid_to || null,
      confidence: input.confidence ?? null,
      metadata: input.metadata || {},
      created_at: input.created_at || new Date().toISOString(),
    };
    return appendJsonl(this.files.relationships, relationship);
  }

  async addFact(input) {
    const fact = {
      id: input.id || randomUUID(),
      subject_type: input.subject_type,
      subject_id: input.subject_id || null,
      predicate: input.predicate,
      raw_value: input.raw_value ?? null,
      normalized_value: input.normalized_value ?? null,
      value_json: input.value_json || {},
      source_id: input.source_id || null,
      artifact_id: input.artifact_id || null,
      page_number: input.page_number ?? null,
      confidence: input.confidence ?? null,
      review_status: input.review_status || "unreviewed",
      metadata: input.metadata || {},
      created_at: input.created_at || new Date().toISOString(),
    };
    return appendJsonl(this.files.facts, fact);
  }

  async addEvent(input) {
    const event = {
      id: input.id || randomUUID(),
      event_type: input.event_type,
      event_date: input.event_date || null,
      execution_date: input.execution_date || null,
      registration_date: input.registration_date || null,
      filing_date: input.filing_date || null,
      order_date: input.order_date || null,
      publication_date: input.publication_date || null,
      property_id: input.property_id || null,
      document_id: input.document_id || null,
      case_id: input.case_id || null,
      charge_id: input.charge_id || null,
      source_id: input.source_id || null,
      artifact_id: input.artifact_id || null,
      event_summary: input.event_summary || null,
      confidence: input.confidence ?? null,
      review_status: input.review_status || "unreviewed",
      metadata: input.metadata || {},
      created_at: input.created_at || new Date().toISOString(),
    };
    return appendJsonl(this.files.events, event);
  }

  async addPatternCandidate(input) {
    const candidate = {
      id: input.id || randomUUID(),
      candidate_key: input.candidate_key,
      pattern_family: input.pattern_family,
      candidate_name: input.candidate_name,
      logic_description: input.logic_description,
      status: input.status || "RAW_SIGNAL",
      evidence_count: input.evidence_count || 0,
      supporting_event_ids: input.supporting_event_ids || [],
      supporting_artifact_ids: input.supporting_artifact_ids || [],
      false_positive_notes: input.false_positive_notes || null,
      metadata: input.metadata || {},
      created_at: input.created_at || new Date().toISOString(),
      updated_at: input.updated_at || input.created_at || new Date().toISOString(),
    };
    return appendJsonl(this.files.patternCandidates, candidate);
  }

  async addReview(input) {
    const review = {
      id: input.id || randomUUID(),
      target_type: input.target_type,
      target_id: input.target_id,
      review_status: input.review_status,
      reviewer: input.reviewer || null,
      reviewed_at: input.reviewed_at || new Date().toISOString(),
      facts_checked: input.facts_checked || [],
      decision_notes: input.decision_notes || null,
      false_positive_notes: input.false_positive_notes || null,
      metadata: input.metadata || {},
    };
    return appendJsonl(this.files.reviews, review);
  }

  async readArtifacts() {
    return readJsonl(this.files.artifacts);
  }

  async readArtifactRepresentations() {
    return readJsonl(this.files.artifactRepresentations);
  }

  async readExtractions() {
    return readJsonl(this.files.extractions);
  }

  async readTextChunks() {
    return readJsonl(this.files.textChunks);
  }

  async writeTextSignals(rows) {
    return writeJsonl(this.files.textSignals, rows);
  }

  async readTextSignals() {
    return readJsonl(this.files.textSignals);
  }

  async writeEcLinkSuggestions(rows) {
    return writeJsonl(this.files.ecLinkSuggestions, rows);
  }

  async readEcLinkSuggestions() {
    return readJsonl(this.files.ecLinkSuggestions);
  }

  async readEcReviewPackets() {
    return readJsonl(this.files.ecReviewPackets);
  }

  async writeArtifacts(rows) {
    return writeJsonl(this.files.artifacts, rows);
  }

  async readProperties() {
    return readJsonl(this.files.properties);
  }

  async writeProperties(rows) {
    return writeJsonl(this.files.properties, rows);
  }

  async readEntities() {
    return readJsonl(this.files.entities);
  }

  async writeEntities(rows) {
    return writeJsonl(this.files.entities, rows);
  }

  async readDocuments() {
    return readJsonl(this.files.documents);
  }

  async writeDocuments(rows) {
    return writeJsonl(this.files.documents, rows);
  }

  async readCases() {
    return readJsonl(this.files.cases);
  }

  async writeCases(rows) {
    return writeJsonl(this.files.cases, rows);
  }

  async readRelationships() {
    return readJsonl(this.files.relationships);
  }

  async writeRelationships(rows) {
    return writeJsonl(this.files.relationships, rows);
  }

  async readFacts() {
    return readJsonl(this.files.facts);
  }

  async writeFacts(rows) {
    return writeJsonl(this.files.facts, rows);
  }

  async readCharges() {
    return readJsonl(this.files.charges);
  }

  async writeCharges(rows) {
    return writeJsonl(this.files.charges, rows);
  }

  async readReviews() {
    return readJsonl(this.files.reviews);
  }

  async writePatternCandidates(rows) {
    return writeJsonl(this.files.patternCandidates, rows);
  }

  async writeEvents(rows) {
    return writeJsonl(this.files.events, rows);
  }

  async writeSourceCoverage(rows) {
    return writeJsonl(this.files.sourceCoverage, rows);
  }

  async readSourceCoverage() {
    return readJsonl(this.files.sourceCoverage);
  }

  async writePlotSpine(rows) {
    return writeJsonl(this.files.plotSpine, rows);
  }

  async readPlotSpine() {
    return readJsonl(this.files.plotSpine);
  }

  async writeWorkQueue(rows) {
    return writeJsonl(this.files.workQueue, rows);
  }

  async readWorkQueue() {
    return readJsonl(this.files.workQueue);
  }

  async writeSeedReviewSet(rows) {
    return writeJsonl(this.files.seedReviewSet, rows);
  }

  async readSeedReviewSet() {
    return readJsonl(this.files.seedReviewSet);
  }

  async readSeedReviewPackets() {
    return readJsonl(this.files.seedReviewPackets);
  }

  async readReviewSprint() {
    return readJsonl(this.files.reviewSprint);
  }

  async readTitleChainPackets() {
    return readJsonl(this.files.titleChainPackets);
  }

  async addSnapshot(input) {
    const snapshot = {
      id: input.id || randomUUID(),
      snapshot_key: input.snapshot_key,
      description: input.description || null,
      source_counts: input.source_counts || {},
      artifact_count: input.artifact_count || 0,
      fact_count: input.fact_count || 0,
      event_count: input.event_count || 0,
      pattern_count: input.pattern_count || 0,
      created_by: input.created_by || "local_corpus",
      created_at: input.created_at || new Date().toISOString(),
      metadata: input.metadata || {},
    };
    return appendJsonl(this.files.snapshots, snapshot);
  }

  async readSnapshots() {
    return readJsonl(this.files.snapshots);
  }

  async updatePatternCandidate(candidateId, patch) {
    const rows = await this.readPatternCandidates();
    const index = rows.findIndex((row) => row.id === candidateId || row.candidate_key === candidateId);
    if (index === -1) return null;
    rows[index] = {
      ...rows[index],
      ...patch,
      metadata: {
        ...(rows[index].metadata || {}),
        ...(patch.metadata || {}),
      },
      updated_at: patch.updated_at || new Date().toISOString(),
    };
    await this.writePatternCandidates(rows);
    return rows[index];
  }

  // P-NEW-2: Update case record with new resolution_* fields. Patches the
  // matching case row and rewrites cases.jsonl. Preserves metadata merge.
  async updateCase(caseId, patch) {
    const rows = await this.readCases();
    const index = rows.findIndex((row) => row.id === caseId);
    if (index === -1) return null;
    rows[index] = {
      ...rows[index],
      ...patch,
      metadata: {
        ...(rows[index].metadata || {}),
        ...(patch.metadata || {}),
      },
      updated_at: patch.updated_at || new Date().toISOString(),
    };
    await this.writeCases(rows);
    return rows[index];
  }

  corpusAccessors(targetType) {
    const accessors = {
      artifact: ["readArtifacts", "writeArtifacts"],
      property: ["readProperties", "writeProperties"],
      entity: ["readEntities", "writeEntities"],
      document: ["readDocuments", "writeDocuments"],
      case: ["readCases", "writeCases"],
      relationship: ["readRelationships", "writeRelationships"],
      fact: ["readFacts", "writeFacts"],
      charge: ["readCharges", "writeCharges"],
      event: ["readEvents", "writeEvents"],
      pattern_candidate: ["readPatternCandidates", "writePatternCandidates"],
      plot_spine: ["readPlotSpine", "writePlotSpine"],
    }[targetType];
    if (!accessors) throw new Error(`Unsupported target type: ${targetType}`);
    return accessors;
  }

  async updateCorpusRow(targetType, id, patch) {
    const [reader, writer] = this.corpusAccessors(targetType);
    const rows = await this[reader]();
    const index = rows.findIndex((row) => row.id === id || row.candidate_key === id || row.artifact_key === id);
    if (index === -1) return null;
    rows[index] = {
      ...rows[index],
      ...patch,
      metadata: {
        ...(rows[index].metadata || {}),
        ...(patch.metadata || {}),
      },
      updated_at: patch.updated_at || new Date().toISOString(),
    };
    await this[writer](rows);
    return rows[index];
  }

  async readEvents() {
    return readJsonl(this.files.events);
  }

  async readPatternCandidates() {
    return readJsonl(this.files.patternCandidates);
  }
}
