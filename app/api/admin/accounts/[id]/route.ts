import { NextResponse, type NextRequest } from "next/server";
import { requireAdmin, resolveName } from "@/lib/admin/data";
import { DOC_LABELS } from "@/lib/config/docLabels";
import type { DocType } from "@/lib/types";

const STORAGE_BUCKET = "filing-documents";
const SIGNED_URL_TTL_SECONDS = 600;

interface UploadedDoc {
  fileName: string;
  path: string;
  uploadedAt: string;
}

// Per-account detail for the admin popup: signed previews of the filer's raw
// uploaded documents plus the parsed pipeline output stored on their filing.
// Reads the filer's latest tax-year filing.
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;
  const { admin } = guard;

  const { id } = await params;

  const { data: userResult } = await admin.auth.admin.getUserById(id);
  const user = userResult?.user ?? null;

  const { data: filings, error } = await admin
    .from("filings")
    .select("*")
    .eq("user_id", id)
    .order("tax_year", { ascending: false });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const filing = filings?.[0] ?? null;

  // Sign each uploaded document so the admin can preview it without the file
  // being public. Short TTL — these are regenerated each time the popup opens.
  const uploads = (filing?.documents_upload ?? {}) as Partial<
    Record<DocType, UploadedDoc>
  >;
  const entries = Object.entries(uploads).filter(
    ([, v]) => v && typeof v.path === "string"
  ) as [DocType, UploadedDoc][];

  const documents = await Promise.all(
    entries.map(async ([docType, doc]) => {
      const { data: signed } = await admin.storage
        .from(STORAGE_BUCKET)
        .createSignedUrl(doc.path, SIGNED_URL_TTL_SECONDS);
      return {
        docType,
        label: DOC_LABELS[docType] ?? docType,
        fileName: doc.fileName,
        uploadedAt: doc.uploadedAt,
        url: signed?.signedUrl ?? null,
      };
    })
  );

  return NextResponse.json({
    account: {
      id,
      email: user?.email ?? "—",
      name: resolveName(filing?.profile_page, user?.user_metadata, user?.email),
      createdAt: user?.created_at ?? null,
    },
    documents,
    parsed: filing
      ? {
          taxYear: filing.tax_year,
          stage: filing.stage,
          documentsNeeded: filing.documents_needed ?? [],
          residency: filing.eligibility_page?.residency ?? null,
          w2s: filing.w2s ?? [],
          f1042s: filing.f1042s ?? [],
          f1099ints: filing.f1099ints ?? [],
          f1099divs: filing.f1099divs ?? [],
          f1099bs: filing.f1099bs ?? [],
          f1099das: filing.f1099das ?? [],
        }
      : null,
  });
}

// Admin-only teardown so the filing flow can be re-tested against a real account:
//   DELETE /api/admin/accounts/[id]?docType=w2  → remove just that one document
//   DELETE /api/admin/accounts/[id]             → full reset: delete every
//     uploaded document AND every filing row for the account, returning it to a
//     clean pre-onboarding state (the auth login is kept).
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;
  const { admin } = guard;

  const { id } = await params;
  const docType = request.nextUrl.searchParams.get("docType");

  const { data: filings, error } = await admin
    .from("filings")
    .select("id, documents_upload")
    .eq("user_id", id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = (filings ?? []) as { id: string; documents_upload: Partial<Record<DocType, UploadedDoc>> | null }[];

  // Single-document delete: pull the object from storage and drop its key from
  // every filing row that references it.
  if (docType) {
    for (const row of rows) {
      const uploads = row.documents_upload ?? {};
      const doc = uploads[docType as DocType];
      if (!doc) continue;
      await admin.storage.from(STORAGE_BUCKET).remove([doc.path]);
      const rest = { ...uploads };
      delete rest[docType as DocType];
      const { error: updateError } = await admin
        .from("filings")
        .update({ documents_upload: rest })
        .eq("id", row.id);
      if (updateError) {
        return NextResponse.json({ error: updateError.message }, { status: 500 });
      }
    }
    return NextResponse.json({ ok: true, deleted: docType });
  }

  // Full reset: remove every uploaded object, then delete the filing rows.
  const paths = rows.flatMap((row) =>
    Object.values(row.documents_upload ?? {})
      .map((d) => d?.path)
      .filter((p): p is string => typeof p === "string")
  );
  if (paths.length) {
    await admin.storage.from(STORAGE_BUCKET).remove(paths);
  }
  const { error: deleteError } = await admin
    .from("filings")
    .delete()
    .eq("user_id", id);
  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, reset: true });
}
