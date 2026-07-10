-- Case file for the Stage 0-2 wizard: one row per user per tax year.
-- profile/residency/documents_needed are JSON blobs shaped like the
-- FilerProfile / ResidencyResult / DocType[] types in lib/types.ts.
create table public.filings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  tax_year int not null,
  stage text not null default 'eligibility',
  profile jsonb not null default '{}',
  residency jsonb,
  interview_answers jsonb not null default '{}',
  documents_needed jsonb not null default '[]',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, tax_year)
);

alter table public.filings enable row level security;

create policy "users manage their own filings"
  on public.filings for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger filings_set_updated_at
  before update on public.filings
  for each row execute function public.set_updated_at();
