-- Renames columns to a consistent "which onboarding page owns this" naming
-- scheme, and folds the standalone residency column into eligibility_page
-- (residency is what Stage 0 computes from its own input, so it belongs
-- alongside that input rather than in its own column).
--
--   profile             -> profile_page
--   interview_answers   -> interview_page
--   uploaded_documents  -> documents_upload
--   eligibility_input   -> eligibility_page (existing rows also gain a
--                          "residency" key merged in from the old column)
--
-- Renames preserve existing data. The residency merge only touches rows
-- that actually have a residency value; the old residency column is
-- dropped after the merge.

alter table public.filings rename column profile to profile_page;
alter table public.filings rename column interview_answers to interview_page;
alter table public.filings rename column uploaded_documents to documents_upload;
alter table public.filings rename column eligibility_input to eligibility_page;

update public.filings
set eligibility_page = coalesce(eligibility_page, '{}'::jsonb) || jsonb_build_object('residency', residency)
where residency is not null;

alter table public.filings drop column if exists residency;
