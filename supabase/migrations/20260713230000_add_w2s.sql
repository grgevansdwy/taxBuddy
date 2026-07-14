-- Adds W-2 wage-statement storage. Unlike 20260710130000_init.sql, this is
-- additive only — it does not drop/recreate the table, so it's safe to run
-- against a database that already has real filings rows in it.

alter table public.filings
  add column if not exists w2s jsonb not null default '[]';

