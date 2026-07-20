-- Lightweight per-visit log powering the admin monitoring dashboard.
-- One row per protected page load by a signed-in account ("app load"), inserted
-- from app/(protected)/layout.tsx. The admin dashboard aggregates these into
-- account visits / unique account visits / trend series via the service-role
-- client (RLS below intentionally exposes NO select policy to normal users).
--
-- NOTE: not yet applied in this env (no Supabase CLI / DB password) — apply via
-- the Supabase dashboard SQL editor, same as the check_fingerprints migration.

create table if not exists public.account_visits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  path text,
  created_at timestamptz not null default now()
);

create index if not exists account_visits_created_at_idx on public.account_visits (created_at);
create index if not exists account_visits_user_id_idx on public.account_visits (user_id);

alter table public.account_visits enable row level security;

-- Users may record their own visits; nobody but the service role can read them.
drop policy if exists "users insert their own visits" on public.account_visits;
create policy "users insert their own visits"
  on public.account_visits for insert
  with check (auth.uid() = user_id);
