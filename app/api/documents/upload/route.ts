import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { CURRENT_SUPPORTED_TAX_YEAR } from "@/lib/config/taxYear";
import type { DocType } from "@/lib/types";
import type { UploadedDocument } from "@/app/api/filing/route";

const STORAGE_BUCKET = "filing-documents";

// Generic raw-file intake: stores the PDF in Supabase Storage and records
// { fileName, path, uploadedAt } on the case file so upload slots can show
// an "already uploaded" state on return visits. No extraction happens here —
// per Stage 2 of the pipeline, files are extracted later in the system.
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const form = await request.formData();
  const docType = form.get("docType");
  const file = form.get("file");

  if (typeof docType !== "string") {
    return NextResponse.json({ error: "docType is required." }, { status: 400 });
  }
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "A file is required." }, { status: 400 });
  }

  const path = `${user.id}/${CURRENT_SUPPORTED_TAX_YEAR}/${docType}/${file.name}`;

  const { error: uploadError } = await supabase.storage.from(STORAGE_BUCKET).upload(path, file, {
    upsert: true,
    contentType: file.type || "application/pdf",
  });
  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }

  const uploadedDocument: UploadedDocument = {
    fileName: file.name,
    path,
    uploadedAt: new Date().toISOString(),
  };

  const { data: existing } = await supabase
    .from("filings")
    .select("documents_upload")
    .eq("user_id", user.id)
    .eq("tax_year", CURRENT_SUPPORTED_TAX_YEAR)
    .maybeSingle();

  const { error: saveError } = await supabase.from("filings").upsert(
    {
      user_id: user.id,
      tax_year: CURRENT_SUPPORTED_TAX_YEAR,
      documents_upload: {
        ...((existing?.documents_upload as Partial<Record<DocType, UploadedDocument>> | null) ?? {}),
        [docType]: uploadedDocument,
      },
    },
    { onConflict: "user_id,tax_year" }
  );
  if (saveError) {
    return NextResponse.json({ error: saveError.message }, { status: 500 });
  }

  return NextResponse.json({ docType, ...uploadedDocument });
}
