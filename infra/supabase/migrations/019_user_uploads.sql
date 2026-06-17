-- P2 V2: user-uploaded document storage.
--
-- When the user uploads a PDF/PNG of an EC or RoR, the file is
-- stored in the `user-uploads` Supabase Storage bucket, and a row
-- is written to this table with metadata (kind, size, sha256,
-- mime type). The interpreter reads the file back from storage
-- when processing the request.
--
-- Why a separate table and not just storage metadata?
--   - We need to know the docType the user *intended* (EC vs
--     RoR vs mutation order) — storage metadata doesn't carry
--     that.
--   - We need a UNIQUE (report_id, doc_type) so the user can
--     re-upload before processing (one active upload per
--     report + doc_type). After a result is delivered, the row
--     stays (audit trail).
--   - We need the sha256 to detect duplicate uploads.
--
-- The webhook for "ai_doc" unlock remains unchanged — the unlock
-- row in 018 must exist before the SSE call.

CREATE TABLE user_uploads (
  id              BIGSERIAL PRIMARY KEY,
  report_id       UUID NOT NULL,
  org_id          UUID,
  doc_type        TEXT NOT NULL,                    -- 'user_upload_ec' | 'user_upload_ror' | 'mutation_order_3g'
  storage_path    TEXT NOT NULL,                    -- path in user-uploads bucket
  mime_type       TEXT NOT NULL,                    -- 'application/pdf' | 'image/png' | 'image/jpeg'
  byte_size       INTEGER NOT NULL,
  sha256          TEXT NOT NULL,                    -- hex digest, used to detect duplicates
  uploaded_by     UUID,                             -- nullable for v1 (no auth)
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (report_id, doc_type)
);

CREATE INDEX idx_user_uploads_report
  ON user_uploads (report_id);

-- RLS: service_role only (user uploads are first-party; no public access).
ALTER TABLE user_uploads ENABLE ROW LEVEL SECURITY;
CREATE POLICY user_uploads_service_role
  ON user_uploads FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Storage bucket: 'user-uploads' (PDFs, PNGs). Created in a separate
-- setup step (Supabase dashboard or via supabase-cli) — SQL doesn't
-- support bucket creation. Document the expected config:
--
--   supabase storage buckets create user-uploads --public false
--   supabase storage buckets update user-uploads --file-size-limit 10485760
--
-- (10 MB hard cap on file size; larger files get rejected at the API.)
