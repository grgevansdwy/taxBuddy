-- Abuse-dedup ledger for the pre-signup "Refund Check" funnel (public/
-- check.html). Enforces "one free check per person" WITHOUT storing any PII.
--
-- We never store a name, an SSN, or any document. `fingerprint` is a keyed
-- HMAC-SHA256 of the filer's normalized SSN/ITIN (see lib/check/fingerprint.ts) —
-- irreversible without the server-only pepper, and the SSN keyspace is small
-- enough that only an HMAC (not a plain hash) is safe to persist. `session_id`
-- is a random opaque cookie value, not tied to any identity; it exists purely
-- so a single legitimate session uploading several documents (W-2 + 1042-S +
-- 1099, all the same SSN) doesn't flag itself as a repeat. A given SSN
-- appearing under a DIFFERENT session_id is the repeat-use signal.
create table if not exists public.check_fingerprints (
  fingerprint text not null,
  session_id text not null,
  created_at timestamptz not null default now(),
  primary key (fingerprint, session_id)
);

-- Fast "has this SSN been seen under any session?" lookup.
create index if not exists check_fingerprints_fingerprint_idx
  on public.check_fingerprints (fingerprint);

-- RLS on with NO policies: anon/authenticated clients (PostgREST) can neither
-- read nor write this table. Only the service-role key (server-side, in the
-- /api/check/* routes) touches it, and service role bypasses RLS.
alter table public.check_fingerprints enable row level security;
