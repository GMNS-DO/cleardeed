-- Panel advocates for Guaranteed-tier co-sign
create table if not exists public.lawyers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  firm text,
  email text not null,
  phone text,
  license_number text,
  photo_url text,
  is_panel boolean not null default true,
  created_at timestamptz not null default now()
);

comment on table public.lawyers is 'Panel advocates available for Guaranteed-tier co-sign.';
comment on column public.lawyers.is_panel is 'true = on ClearDeed panel; false = buyer-supplied advocate.';

-- Guaranteed-tier columns on reports (idempotent)
alter table if exists public.reports
  add column if not exists lawyer_id uuid references public.lawyers(id) on delete set null,
  add column if not exists lawyer_signature_url text,
  add column if not exists signed_at timestamptz,
  add column if not exists guarantee_accepted_at timestamptz;

comment on column public.reports.lawyer_id is 'Panel advocate assigned to co-sign this report.';
comment on column public.reports.lawyer_signature_url is 'Supabase storage URL of the signed PDF.';
comment on column public.reports.signed_at is 'When the advocate signed the report.';
comment on column public.reports.guarantee_accepted_at is 'When the buyer accepted the 18-month guarantee terms (set by webhook on guaranteed-tier payments).';

-- RLS
alter table public.lawyers enable row level security;

create policy "lawyers_select_anon" on public.lawyers for select to anon, authenticated using (true);
create policy "lawyers_modify_staff" on public.lawyers for all to service_role using (true);
