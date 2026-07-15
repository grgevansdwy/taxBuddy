-- Adds Form 1099-DA (digital asset/crypto broker transactions) storage.
-- Additive only, like 20260713230000_add_w2s.sql — safe to run against a
-- database that already has real filings rows in it.

alter table public.filings
  add column if not exists f1099das jsonb not null default '[]';
