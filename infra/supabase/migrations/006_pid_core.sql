-- Migration: PID core corpus schema
-- Purpose: Lightweight Pattern Intelligence Database model for land/plot dispute evidence.
-- Notes:
-- - Raw PDFs, screenshots, HTML, OCR JSON, and page images should live in object/file storage.
-- - Postgres stores source metadata, artifact references, extracted facts, normalized objects,
--   event timelines, reviews, and pattern candidates.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS pid_sources (
  source_id TEXT PRIMARY KEY,
  source_name TEXT NOT NULL,
  source_category TEXT NOT NULL,
  priority TEXT NOT NULL DEFAULT 'P2' CHECK (priority IN ('P0','P1','P2','P3','DEFER')),
  source_roles TEXT[] NOT NULL DEFAULT '{}',
  availability TEXT NOT NULL DEFAULT 'unknown',
  access_modes TEXT[] NOT NULL DEFAULT '{}',
  collection_mode TEXT NOT NULL DEFAULT 'manual' CHECK (
    collection_mode IN ('bulk','targeted','manual','uploaded','conditional','lead_only','defer')
  ),
  official_url TEXT,
  fields_expected JSONB NOT NULL DEFAULT '[]',
  pattern_families JSONB NOT NULL DEFAULT '[]',
  limitations JSONB NOT NULL DEFAULT '[]',
  storage_notes TEXT,
  status TEXT NOT NULL DEFAULT 'planned' CHECK (
    status IN ('planned','sampled','active','blocked','deferred','retired')
  ),
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pid_source_fields (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id TEXT NOT NULL REFERENCES pid_sources(source_id) ON DELETE CASCADE,
  source_field TEXT NOT NULL,
  canonical_field TEXT NOT NULL,
  field_type TEXT NOT NULL DEFAULT 'text',
  reliability TEXT NOT NULL DEFAULT 'unknown' CHECK (reliability IN ('high','medium','low','unknown')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (source_id, source_field, canonical_field)
);

CREATE TABLE IF NOT EXISTS pid_collection_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_key TEXT NOT NULL UNIQUE,
  source_id TEXT REFERENCES pid_sources(source_id),
  run_type TEXT NOT NULL DEFAULT 'collector' CHECK (run_type IN ('collector','manual_intake','upload','backfill','analysis')),
  status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running','completed','failed','partial')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  collector_version TEXT,
  root_path TEXT,
  parameters JSONB NOT NULL DEFAULT '{}',
  stats JSONB NOT NULL DEFAULT '{}',
  notes TEXT
);

CREATE TABLE IF NOT EXISTS pid_artifacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  artifact_key TEXT NOT NULL UNIQUE,
  source_id TEXT NOT NULL REFERENCES pid_sources(source_id),
  collection_run_id UUID REFERENCES pid_collection_runs(id) ON DELETE SET NULL,
  artifact_type TEXT NOT NULL,
  document_type TEXT,
  source_url TEXT,
  source_origin TEXT,
  access_mode TEXT,
  query JSONB NOT NULL DEFAULT '{}',
  storage_path TEXT NOT NULL,
  storage_bucket TEXT,
  storage_key TEXT,
  sha256 TEXT NOT NULL,
  byte_size BIGINT,
  content_type TEXT,
  http_status INTEGER,
  retrieved_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  parser_status TEXT NOT NULL DEFAULT 'raw_saved',
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pid_artifacts_source ON pid_artifacts(source_id);
CREATE INDEX IF NOT EXISTS idx_pid_artifacts_sha256 ON pid_artifacts(sha256);
CREATE INDEX IF NOT EXISTS idx_pid_artifacts_retrieved_at ON pid_artifacts(retrieved_at);
CREATE INDEX IF NOT EXISTS idx_pid_artifacts_query_gin ON pid_artifacts USING GIN (query);

CREATE TABLE IF NOT EXISTS pid_artifact_representations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  artifact_id UUID NOT NULL REFERENCES pid_artifacts(id) ON DELETE CASCADE,
  representation_type TEXT NOT NULL CHECK (
    representation_type IN ('clean_html','ocr_text','ocr_json','parsed_json','page_image','text_chunk_source','screenshot','table_json','other')
  ),
  storage_path TEXT NOT NULL,
  sha256 TEXT,
  created_by TEXT,
  extraction_run_key TEXT,
  confidence NUMERIC CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 1)),
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pid_artifact_representations_artifact ON pid_artifact_representations(artifact_id);

CREATE TABLE IF NOT EXISTS pid_extractions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  artifact_id UUID NOT NULL REFERENCES pid_artifacts(id) ON DELETE CASCADE,
  extraction_type TEXT NOT NULL,
  extractor_name TEXT NOT NULL,
  extractor_version TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','success','partial','failed','needs_ocr','needs_review')),
  normalized_text_sha256 TEXT,
  text_storage_path TEXT,
  confidence NUMERIC CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 1)),
  fields JSONB NOT NULL DEFAULT '{}',
  errors JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pid_extractions_artifact ON pid_extractions(artifact_id);
CREATE INDEX IF NOT EXISTS idx_pid_extractions_status ON pid_extractions(status);

CREATE TABLE IF NOT EXISTS pid_text_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  artifact_id UUID NOT NULL REFERENCES pid_artifacts(id) ON DELETE CASCADE,
  extraction_id UUID REFERENCES pid_extractions(id) ON DELETE SET NULL,
  chunk_index INTEGER NOT NULL,
  page_number INTEGER,
  section_label TEXT,
  chunk_text TEXT NOT NULL,
  chunk_hash TEXT NOT NULL,
  token_count INTEGER,
  tsv tsvector GENERATED ALWAYS AS (to_tsvector('simple', chunk_text)) STORED,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (artifact_id, chunk_hash)
);

CREATE INDEX IF NOT EXISTS idx_pid_text_chunks_artifact ON pid_text_chunks(artifact_id);
CREATE INDEX IF NOT EXISTS idx_pid_text_chunks_tsv ON pid_text_chunks USING GIN (tsv);

CREATE TABLE IF NOT EXISTS pid_properties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  canonical_key TEXT UNIQUE,
  state TEXT NOT NULL DEFAULT 'Odisha',
  district TEXT,
  tahasil TEXT,
  village TEXT,
  mouza TEXT,
  khata_number TEXT,
  plot_number TEXT,
  survey_number TEXT,
  area_value NUMERIC,
  area_unit TEXT,
  geometry_ref TEXT,
  identity_confidence NUMERIC CHECK (identity_confidence IS NULL OR (identity_confidence >= 0 AND identity_confidence <= 1)),
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pid_properties_location ON pid_properties(district, tahasil, village, khata_number, plot_number);

CREATE TABLE IF NOT EXISTS pid_property_identifiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES pid_properties(id) ON DELETE CASCADE,
  identifier_type TEXT NOT NULL,
  raw_value TEXT NOT NULL,
  normalized_value TEXT,
  source_id TEXT REFERENCES pid_sources(source_id),
  artifact_id UUID REFERENCES pid_artifacts(id) ON DELETE SET NULL,
  confidence NUMERIC CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 1)),
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pid_property_identifiers_value ON pid_property_identifiers(identifier_type, normalized_value);

CREATE TABLE IF NOT EXISTS pid_entities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL CHECK (
    entity_type IN ('person','company','bank','authority','promoter','project','broker','lawyer','deed_writer','unknown')
  ),
  canonical_name TEXT NOT NULL,
  normalized_name TEXT NOT NULL,
  jurisdiction TEXT,
  confidence NUMERIC CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 1)),
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pid_entities_normalized_name ON pid_entities(normalized_name);

CREATE TABLE IF NOT EXISTS pid_entity_aliases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID NOT NULL REFERENCES pid_entities(id) ON DELETE CASCADE,
  alias TEXT NOT NULL,
  normalized_alias TEXT NOT NULL,
  alias_type TEXT NOT NULL DEFAULT 'variant',
  source_id TEXT REFERENCES pid_sources(source_id),
  artifact_id UUID REFERENCES pid_artifacts(id) ON DELETE SET NULL,
  confidence NUMERIC CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 1)),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (entity_id, normalized_alias, alias_type)
);

CREATE INDEX IF NOT EXISTS idx_pid_entity_aliases_normalized ON pid_entity_aliases(normalized_alias);

CREATE TABLE IF NOT EXISTS pid_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  artifact_id UUID REFERENCES pid_artifacts(id) ON DELETE SET NULL,
  document_type TEXT NOT NULL,
  document_number TEXT,
  document_date DATE,
  registration_date DATE,
  issuing_authority TEXT,
  sro TEXT,
  status TEXT,
  title TEXT,
  summary TEXT,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pid_documents_type_date ON pid_documents(document_type, document_date);
CREATE INDEX IF NOT EXISTS idx_pid_documents_number ON pid_documents(document_number);

CREATE TABLE IF NOT EXISTS pid_cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  artifact_id UUID REFERENCES pid_artifacts(id) ON DELETE SET NULL,
  case_source TEXT NOT NULL,
  case_number TEXT,
  cnr TEXT,
  court_or_forum TEXT,
  case_type TEXT,
  filing_date DATE,
  disposal_date DATE,
  status TEXT,
  district TEXT,
  parties JSONB NOT NULL DEFAULT '[]',
  issue_summary TEXT,
  outcome_summary TEXT,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pid_cases_case_number ON pid_cases(case_source, case_number);
CREATE INDEX IF NOT EXISTS idx_pid_cases_cnr ON pid_cases(cnr);

CREATE TABLE IF NOT EXISTS pid_charges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  artifact_id UUID REFERENCES pid_artifacts(id) ON DELETE SET NULL,
  charge_source TEXT NOT NULL,
  charge_status TEXT,
  borrower_entity_id UUID REFERENCES pid_entities(id) ON DELETE SET NULL,
  creditor_entity_id UUID REFERENCES pid_entities(id) ON DELETE SET NULL,
  property_id UUID REFERENCES pid_properties(id) ON DELETE SET NULL,
  amount NUMERIC,
  charge_type TEXT,
  creation_date DATE,
  satisfaction_date DATE,
  property_description TEXT,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pid_charges_status ON pid_charges(charge_status);
CREATE INDEX IF NOT EXISTS idx_pid_charges_property ON pid_charges(property_id);

CREATE TABLE IF NOT EXISTS pid_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  event_date DATE,
  execution_date DATE,
  registration_date DATE,
  filing_date DATE,
  order_date DATE,
  publication_date DATE,
  effective_from DATE,
  effective_to DATE,
  recorded_at TIMESTAMPTZ,
  property_id UUID REFERENCES pid_properties(id) ON DELETE SET NULL,
  document_id UUID REFERENCES pid_documents(id) ON DELETE SET NULL,
  case_id UUID REFERENCES pid_cases(id) ON DELETE SET NULL,
  charge_id UUID REFERENCES pid_charges(id) ON DELETE SET NULL,
  source_id TEXT REFERENCES pid_sources(source_id),
  artifact_id UUID REFERENCES pid_artifacts(id) ON DELETE SET NULL,
  event_summary TEXT,
  confidence NUMERIC CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 1)),
  review_status TEXT NOT NULL DEFAULT 'unreviewed' CHECK (
    review_status IN ('unreviewed','approved','rejected','needs_followup','lead_only')
  ),
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pid_events_type_date ON pid_events(event_type, event_date);
CREATE INDEX IF NOT EXISTS idx_pid_events_property ON pid_events(property_id);
CREATE INDEX IF NOT EXISTS idx_pid_events_artifact ON pid_events(artifact_id);
CREATE INDEX IF NOT EXISTS idx_pid_events_metadata_gin ON pid_events USING GIN (metadata);

CREATE TABLE IF NOT EXISTS pid_relationship_edges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_type TEXT NOT NULL,
  from_id UUID NOT NULL,
  to_type TEXT NOT NULL,
  to_id UUID NOT NULL,
  relationship_type TEXT NOT NULL,
  source_id TEXT REFERENCES pid_sources(source_id),
  artifact_id UUID REFERENCES pid_artifacts(id) ON DELETE SET NULL,
  event_id UUID REFERENCES pid_events(id) ON DELETE SET NULL,
  valid_from DATE,
  valid_to DATE,
  confidence NUMERIC CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 1)),
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pid_relationship_edges_from ON pid_relationship_edges(from_type, from_id);
CREATE INDEX IF NOT EXISTS idx_pid_relationship_edges_to ON pid_relationship_edges(to_type, to_id);
CREATE INDEX IF NOT EXISTS idx_pid_relationship_edges_type ON pid_relationship_edges(relationship_type);

CREATE TABLE IF NOT EXISTS pid_fact_assertions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_type TEXT NOT NULL,
  subject_id UUID,
  predicate TEXT NOT NULL,
  raw_value TEXT,
  normalized_value TEXT,
  value_json JSONB NOT NULL DEFAULT '{}',
  source_id TEXT REFERENCES pid_sources(source_id),
  artifact_id UUID REFERENCES pid_artifacts(id) ON DELETE SET NULL,
  extraction_id UUID REFERENCES pid_extractions(id) ON DELETE SET NULL,
  page_number INTEGER,
  char_start INTEGER,
  char_end INTEGER,
  bbox JSONB,
  confidence NUMERIC CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 1)),
  review_status TEXT NOT NULL DEFAULT 'unreviewed' CHECK (
    review_status IN ('unreviewed','approved','rejected','needs_followup','lead_only')
  ),
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pid_fact_assertions_subject ON pid_fact_assertions(subject_type, subject_id);
CREATE INDEX IF NOT EXISTS idx_pid_fact_assertions_predicate ON pid_fact_assertions(predicate);
CREATE INDEX IF NOT EXISTS idx_pid_fact_assertions_artifact ON pid_fact_assertions(artifact_id);
CREATE INDEX IF NOT EXISTS idx_pid_fact_assertions_value_gin ON pid_fact_assertions USING GIN (value_json);

CREATE TABLE IF NOT EXISTS pid_theme_labels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  label_key TEXT NOT NULL,
  label_name TEXT NOT NULL,
  label_family TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id UUID NOT NULL,
  source_id TEXT REFERENCES pid_sources(source_id),
  artifact_id UUID REFERENCES pid_artifacts(id) ON DELETE SET NULL,
  confidence NUMERIC CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 1)),
  status TEXT NOT NULL DEFAULT 'candidate' CHECK (status IN ('candidate','approved','rejected','needs_followup')),
  notes TEXT,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pid_theme_labels_target ON pid_theme_labels(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_pid_theme_labels_key ON pid_theme_labels(label_key);

CREATE TABLE IF NOT EXISTS pid_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  target_type TEXT NOT NULL,
  target_id UUID NOT NULL,
  review_status TEXT NOT NULL CHECK (
    review_status IN ('approved','rejected','needs_followup','lead_only','benign','extraction_error')
  ),
  reviewer TEXT,
  reviewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  facts_checked JSONB NOT NULL DEFAULT '[]',
  decision_notes TEXT,
  false_positive_notes TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_pid_reviews_target ON pid_reviews(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_pid_reviews_status ON pid_reviews(review_status);

CREATE TABLE IF NOT EXISTS pid_pattern_candidates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_key TEXT NOT NULL UNIQUE,
  pattern_family TEXT NOT NULL,
  candidate_name TEXT NOT NULL,
  logic_description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'RAW_SIGNAL' CHECK (
    status IN ('RAW_SIGNAL','CANDIDATE','REVIEWED','PROBABLE','VALIDATED','REJECTED')
  ),
  evidence_count INTEGER NOT NULL DEFAULT 0,
  reviewed_example_count INTEGER NOT NULL DEFAULT 0,
  supporting_event_ids UUID[] NOT NULL DEFAULT '{}',
  supporting_artifact_ids UUID[] NOT NULL DEFAULT '{}',
  rule_version TEXT,
  false_positive_notes TEXT,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pid_pattern_candidates_family ON pid_pattern_candidates(pattern_family);
CREATE INDEX IF NOT EXISTS idx_pid_pattern_candidates_status ON pid_pattern_candidates(status);

CREATE TABLE IF NOT EXISTS pid_patterns (
  pattern_id TEXT PRIMARY KEY,
  pattern_name TEXT NOT NULL,
  pattern_family TEXT NOT NULL,
  definition TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'STUB' CHECK (status IN ('STUB','CANDIDATE','REVIEWED','PROBABLE','VALIDATED','RETIRED')),
  rule_logic JSONB NOT NULL DEFAULT '{}',
  source_requirements JSONB NOT NULL DEFAULT '[]',
  example_count INTEGER NOT NULL DEFAULT 0,
  reviewed_example_count INTEGER NOT NULL DEFAULT 0,
  false_positive_notes TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pid_pattern_examples (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pattern_id TEXT NOT NULL REFERENCES pid_patterns(pattern_id) ON DELETE CASCADE,
  candidate_id UUID REFERENCES pid_pattern_candidates(id) ON DELETE SET NULL,
  property_id UUID REFERENCES pid_properties(id) ON DELETE SET NULL,
  event_ids UUID[] NOT NULL DEFAULT '{}',
  artifact_ids UUID[] NOT NULL DEFAULT '{}',
  review_id UUID REFERENCES pid_reviews(id) ON DELETE SET NULL,
  example_status TEXT NOT NULL DEFAULT 'candidate' CHECK (
    example_status IN ('candidate','approved','rejected','needs_followup','benign')
  ),
  summary TEXT,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pid_pattern_examples_pattern ON pid_pattern_examples(pattern_id);
CREATE INDEX IF NOT EXISTS idx_pid_pattern_examples_property ON pid_pattern_examples(property_id);

CREATE TABLE IF NOT EXISTS pid_corpus_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_key TEXT NOT NULL UNIQUE,
  description TEXT,
  source_counts JSONB NOT NULL DEFAULT '{}',
  artifact_count INTEGER NOT NULL DEFAULT 0,
  fact_count INTEGER NOT NULL DEFAULT 0,
  event_count INTEGER NOT NULL DEFAULT 0,
  pattern_count INTEGER NOT NULL DEFAULT 0,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata JSONB NOT NULL DEFAULT '{}'
);

ALTER TABLE pid_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE pid_source_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE pid_collection_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE pid_artifacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE pid_artifact_representations ENABLE ROW LEVEL SECURITY;
ALTER TABLE pid_extractions ENABLE ROW LEVEL SECURITY;
ALTER TABLE pid_text_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE pid_properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE pid_property_identifiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE pid_entities ENABLE ROW LEVEL SECURITY;
ALTER TABLE pid_entity_aliases ENABLE ROW LEVEL SECURITY;
ALTER TABLE pid_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE pid_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE pid_charges ENABLE ROW LEVEL SECURITY;
ALTER TABLE pid_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE pid_relationship_edges ENABLE ROW LEVEL SECURITY;
ALTER TABLE pid_fact_assertions ENABLE ROW LEVEL SECURITY;
ALTER TABLE pid_theme_labels ENABLE ROW LEVEL SECURITY;
ALTER TABLE pid_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE pid_pattern_candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE pid_patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE pid_pattern_examples ENABLE ROW LEVEL SECURITY;
ALTER TABLE pid_corpus_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role only" ON pid_sources FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role only" ON pid_source_fields FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role only" ON pid_collection_runs FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role only" ON pid_artifacts FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role only" ON pid_artifact_representations FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role only" ON pid_extractions FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role only" ON pid_text_chunks FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role only" ON pid_properties FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role only" ON pid_property_identifiers FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role only" ON pid_entities FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role only" ON pid_entity_aliases FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role only" ON pid_documents FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role only" ON pid_cases FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role only" ON pid_charges FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role only" ON pid_events FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role only" ON pid_relationship_edges FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role only" ON pid_fact_assertions FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role only" ON pid_theme_labels FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role only" ON pid_reviews FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role only" ON pid_pattern_candidates FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role only" ON pid_patterns FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role only" ON pid_pattern_examples FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role only" ON pid_corpus_snapshots FOR ALL USING (auth.role() = 'service_role');
