-- Cleanup, additive/non-destructive (doesn't touch the rest of the table):
--   - f1098t: dropped entirely from the app, no code reads or writes it anymore.
--   - charitable_contributions / charitable_contributions_confirmed: superseded by
--     interview_answers.charitableContributions / .charitableContributionsConfirmed
--     (see /api/reduction, /api/documents/checklist, lib/server/engineContext.ts).
--     The real values already live in interview_answers by now — these two
--     columns have been dead weight since that change shipped.

alter table public.filings
  drop column if exists f1098t,
  drop column if exists charitable_contributions,
  drop column if exists charitable_contributions_confirmed;
