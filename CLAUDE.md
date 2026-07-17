@AGENTS.md

## Upcoming tasks

- **[deferred] Refund Check abuse dedup (SSN fingerprint).** The `/check` funnel
  (`public/check.html` → `/api/check/extract`, `/api/check/score`) runs paid
  LlamaParse + OpenAI calls with no auth. A privacy-preserving "one free check
  per filer" dedup is fully implemented but **currently disconnected** while we're
  in testing. It stores no PII — only a keyed HMAC-SHA256 of the filer's SSN/ITIN.
  Pieces already in place:
  - `lib/check/fingerprint.ts` — `fingerprintSsn` (HMAC with `CHECK_FINGERPRINT_SECRET`
    pepper, already set in `.env`), `extractSsnFromMarkdown`, `getSessionId`,
    `checkAndRecordFingerprint` (accepts an injectable client for testing).
  - `lib/supabase/admin.ts` — service-role client (fails open if unconfigured).
  - `supabase/migrations/20260716120000_add_check_fingerprints.sql` — the ledger
    table. **Not yet applied** (no Supabase CLI / DB password in this env; apply
    via the dashboard SQL editor).
  - `tests/golden/checkScore.test.ts` — covers the fingerprint + dedup decision.

  To re-enable: apply the migration, re-wire the dedup gate into
  `app/api/check/extract` (before the GPT calls) and `app/api/check/score` (on the
  filed TIN), and re-add the client-owned `x-check-session` id in `public/check.html`
  (persist in localStorage; send as a header on the extract/score fetches). Search
  the routes for the "abuse dedup ... disconnected" NOTE comments for the exact spots.
  Rate-limiting is still the real backstop for these unauthenticated paid endpoints.
