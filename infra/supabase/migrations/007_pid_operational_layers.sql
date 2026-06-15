-- Migration: PID operational corpus layers
-- Purpose: Persist source coverage, canonical plot spine, text-derived leads, and work queue.
-- These tables mirror the local JSONL operational artifacts built by PID CLIs.

CREATE TABLE IF NOT EXISTS pid_source_coverage (
  source_id TEXT PRIMARY KEY REFERENCES pid_sources(source_id) ON DELETE CASCADE,
  collection_status TEXT NOT NULL CHECK (
    collection_status IN ('configured_only','raw_artifacts','parsed_facts','normalized_events','reviewed_evidence')
  ),
  claim_readiness TEXT NOT NULL CHECK (
    claim_readiness IN ('C0_CONFIGURED_ONLY','C0_ARTIFACT_ONLY','C1_PARSED_FACT','C2_TARGET_LINKED','C3_REVIEWED_OR_CROSSCHECKED')
  ),
  counts JSONB NOT NULL DEFAULT '{}',
  event_types JSONB NOT NULL DEFAULT '{}',
  next_gaps JSONB NOT NULL DEFAULT '[]',
  allowed_posture TEXT,
  limitations JSONB NOT NULL DEFAULT '[]',
  metadata JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pid_source_coverage_status ON pid_source_coverage(collection_status);
CREATE INDEX IF NOT EXISTS idx_pid_source_coverage_readiness ON pid_source_coverage(claim_readiness);

CREATE TABLE IF NOT EXISTS pid_plot_spine (
  id TEXT PRIMARY KEY,
  spine_key TEXT NOT NULL UNIQUE,
  identity JSONB NOT NULL,
  identity_confidence NUMERIC NOT NULL CHECK (identity_confidence >= 0 AND identity_confidence <= 1),
  app_ready BOOLEAN NOT NULL DEFAULT FALSE,
  review_flags TEXT[] NOT NULL DEFAULT '{}',
  evidence JSONB NOT NULL DEFAULT '{}',
  review_status TEXT NOT NULL DEFAULT 'unreviewed' CHECK (
    review_status IN ('unreviewed','reviewed','approved','rejected','needs_followup')
  ),
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pid_plot_spine_ready ON pid_plot_spine(app_ready, identity_confidence DESC);
CREATE INDEX IF NOT EXISTS idx_pid_plot_spine_identity_gin ON pid_plot_spine USING GIN (identity);
CREATE INDEX IF NOT EXISTS idx_pid_plot_spine_evidence_gin ON pid_plot_spine USING GIN (evidence);

CREATE TABLE IF NOT EXISTS pid_text_signals (
  id TEXT PRIMARY KEY,
  signal_family TEXT NOT NULL,
  matched_term TEXT NOT NULL,
  source_id TEXT REFERENCES pid_sources(source_id),
  artifact_id UUID REFERENCES pid_artifacts(id) ON DELETE CASCADE,
  chunk_id UUID REFERENCES pid_text_chunks(id) ON DELETE SET NULL,
  confidence NUMERIC CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 1)),
  review_status TEXT NOT NULL DEFAULT 'lead_only' CHECK (
    review_status IN ('unreviewed','approved','rejected','needs_followup','lead_only','benign','extraction_error')
  ),
  snippet TEXT,
  storage_path TEXT,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pid_text_signals_family ON pid_text_signals(signal_family);
CREATE INDEX IF NOT EXISTS idx_pid_text_signals_source ON pid_text_signals(source_id);
CREATE INDEX IF NOT EXISTS idx_pid_text_signals_artifact ON pid_text_signals(artifact_id);
CREATE INDEX IF NOT EXISTS idx_pid_text_signals_status ON pid_text_signals(review_status);

CREATE TABLE IF NOT EXISTS pid_work_queue (
  id TEXT PRIMARY KEY,
  task_type TEXT NOT NULL CHECK (
    task_type IN (
      'review_pattern_candidate',
      'review_ec_link_suggestion',
      'review_plot_spine',
      'review_text_signal',
      'parse_artifact',
      'ocr_artifact',
      'link_unlinked_event',
      'manual_intake',
      'source_probe'
    )
  ),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','in_progress','completed','blocked','dismissed')),
  priority_score INTEGER NOT NULL DEFAULT 0,
  source_id TEXT,
  source_priority TEXT,
  target_type TEXT,
  target_id TEXT,
  title TEXT NOT NULL,
  reason TEXT,
  recommended_action TEXT,
  command TEXT,
  blockers JSONB NOT NULL DEFAULT '[]',
  assigned_to TEXT,
  due_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pid_work_queue_open_priority ON pid_work_queue(status, priority_score DESC);
CREATE INDEX IF NOT EXISTS idx_pid_work_queue_source ON pid_work_queue(source_id);
CREATE INDEX IF NOT EXISTS idx_pid_work_queue_target ON pid_work_queue(target_type, target_id);

CREATE TABLE IF NOT EXISTS pid_seed_review_set (
  id TEXT PRIMARY KEY,
  bucket TEXT NOT NULL,
  source_id TEXT,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  review_status TEXT NOT NULL DEFAULT 'unreviewed' CHECK (
    review_status IN ('unreviewed','approved','rejected','needs_followup','lead_only','benign','extraction_error')
  ),
  title TEXT,
  why_selected TEXT,
  review_goal TEXT,
  command TEXT,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (target_type, target_id)
);

CREATE INDEX IF NOT EXISTS idx_pid_seed_review_set_bucket ON pid_seed_review_set(bucket);
CREATE INDEX IF NOT EXISTS idx_pid_seed_review_set_status ON pid_seed_review_set(review_status);

ALTER TABLE pid_source_coverage ENABLE ROW LEVEL SECURITY;
ALTER TABLE pid_plot_spine ENABLE ROW LEVEL SECURITY;
ALTER TABLE pid_text_signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE pid_work_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE pid_seed_review_set ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role only" ON pid_source_coverage FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role only" ON pid_plot_spine FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role only" ON pid_text_signals FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role only" ON pid_work_queue FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role only" ON pid_seed_review_set FOR ALL USING (auth.role() = 'service_role');
