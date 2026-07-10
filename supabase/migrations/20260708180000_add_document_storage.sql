-- Adds raw-file storage + full hydration support for the onboarding wizard.
-- eligibility_input: the confirmed Stage 0 input verbatim, so the eligibility
-- page can rehydrate its confirm substep on back-navigation without re-extracting.
-- uploaded_documents: map of DocType -> { fileName, path, uploadedAt } for
-- every raw file the user has uploaded, so upload slots can show an
-- "already uploaded" state instead of an empty dropzone.
alter table public.filings
  add column if not exists eligibility_input jsonb,
  add column if not exists uploaded_documents jsonb not null default '{}';

-- Private bucket for raw uploaded tax documents (I-94, I-20, W-2, 1099s, etc).
insert into storage.buckets (id, name, public)
values ('filing-documents', 'filing-documents', false)
on conflict (id) do nothing;

-- Objects are stored at {user_id}/{tax_year}/{docType}/{fileName} — restrict
-- each user to their own top-level folder.
create policy "users manage their own filing documents"
  on storage.objects for all
  using (bucket_id = 'filing-documents' and auth.uid()::text = (storage.foldername(name))[1])
  with check (bucket_id = 'filing-documents' and auth.uid()::text = (storage.foldername(name))[1]);
