-- Single consolidated schema for the whole app — replaces the previous 4
-- incremental migration files. Safe to re-run from scratch: drops and
-- recreates everything, so applying this wipes any existing filings rows.
--
-- One row per user per tax year. JSON/JSONB columns are shaped like the
-- matching types in lib/types.ts — see that file for the authoritative shape
-- of each blob (EligibilityPageData, FilerProfile, DocType[], F1042SData[], etc).

drop table if exists public.filings cascade;

create table public.filings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  tax_year int not null,
  stage text not null default 'eligibility',

  -- Stage 0: confirmed I-94/eligibility input plus what evaluateEligibility()
  -- computed from it (residency), stored together — see
  -- lib/types.ts's EligibilityPageData for the shape.
  eligibility_page jsonb,

  -- Stage 1a: filer identity — see lib/types.ts's FilerProfile.
  profile_page jsonb not null default '{}',

  -- Stage 1b: interview answers + the derived upload checklist. Also holds
  -- charitableContributions/charitableContributionsConfirmed (Stage 3) —
  -- no separate columns for those, see lib/types.ts's InterviewAnswers.
  interview_page jsonb not null default '{}',
  documents_needed jsonb not null default '[]',

  -- Stage 2: raw uploaded files (DocType -> {fileName, path, uploadedAt}),
  -- and the structured data extracted from the income documents.
  documents_upload jsonb not null default '{}',
  f1042s jsonb not null default '[]',
  f1099ints jsonb not null default '[]',
  f1099divs jsonb not null default '[]',
  f1099bs jsonb not null default '[]',
  w2s jsonb not null default '[]',

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

-- Private bucket for raw uploaded tax documents (I-94, I-20, W-2, 1099s, etc).
-- Objects are stored at {user_id}/{tax_year}/{docType}/{fileName} — restrict
-- each user to their own top-level folder.
insert into storage.buckets (id, name, public)
values ('filing-documents', 'filing-documents', false)
on conflict (id) do nothing;

drop policy if exists "users manage their own filing documents" on storage.objects;

create policy "users manage their own filing documents"
  on storage.objects for all
  using (bucket_id = 'filing-documents' and auth.uid()::text = (storage.foldername(name))[1])
  with check (bucket_id = 'filing-documents' and auth.uid()::text = (storage.foldername(name))[1]);
