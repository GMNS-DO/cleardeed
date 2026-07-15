-- Guaranteed tier columns on reports (idempotent — T3's 021 migration may also add these)
alter table if exists public.reports
  add column if not exists guarantee_accepted_at timestamptz;

comment on column public.reports.guarantee_accepted_at is 'When the buyer accepted the 18-month guarantee terms (set by webhook on guaranteed-tier payments).';
