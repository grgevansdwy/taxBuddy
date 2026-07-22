import type { createClient } from "@/lib/supabase/server";
import { CURRENT_SUPPORTED_TAX_YEAR } from "@/lib/config/taxYear";

type ServerSupabase = Awaited<ReturnType<typeof createClient>>;

const STORAGE_BUCKET = "filing-documents";

// Resolves a document to bytes for extraction from EITHER a freshly-uploaded
// file OR the copy already in Supabase Storage from a prior visit. This is what
// lets a resuming user change just one document instead of re-uploading the
// whole set: the routes read the unchanged ones back from storage (path recorded
// in filings.documents_upload by /api/documents/upload).
export async function resolveUploadedDoc(
  supabase: ServerSupabase,
  userId: string,
  docType: string,
  liveFile: FormDataEntryValue | null,
): Promise<{ buffer: Buffer; fileName: string } | null> {
  if (liveFile instanceof File) {
    return { buffer: Buffer.from(await liveFile.arrayBuffer()), fileName: liveFile.name };
  }

  const { data: filing } = await supabase
    .from("filings")
    .select("documents_upload")
    .eq("user_id", userId)
    .eq("tax_year", CURRENT_SUPPORTED_TAX_YEAR)
    .maybeSingle();

  const uploaded = (
    filing?.documents_upload as Record<string, { path?: string; fileName?: string }> | null | undefined
  )?.[docType];
  if (!uploaded?.path) return null;

  const { data: blob, error } = await supabase.storage.from(STORAGE_BUCKET).download(uploaded.path);
  if (error || !blob) return null;

  return { buffer: Buffer.from(await blob.arrayBuffer()), fileName: uploaded.fileName ?? `${docType}.pdf` };
}
