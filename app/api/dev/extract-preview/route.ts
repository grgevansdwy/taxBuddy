import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { extractFromMarkdown } from "@/lib/ai/extractFromMarkdown";
import { EXTRACTION_SPECS, type ExtractionKind } from "@/lib/ai/extractionSpecs";
import { lookupSchoolContactInfo } from "@/lib/ai/lookupSchoolContactInfo";
import type { I20Extraction } from "@/lib/extraction/schemas/i20";

const VALID_KINDS = Object.keys(EXTRACTION_SPECS) as ExtractionKind[];

interface ExtractPreviewRequestBody {
  kind: ExtractionKind;
  documents: { title: string; markdown: string }[];
}

// Internal-only, sibling to /api/dev/parse-preview: runs the gpt-4o-mini +
// markdown extraction pipeline against markdown the browser already has
// (from a prior /api/dev/parse-preview call), so testing extraction doesn't
// mean re-running LlamaParse each time. Nothing here is saved.
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as ExtractPreviewRequestBody;

  if (!VALID_KINDS.includes(body.kind)) {
    return NextResponse.json({ error: `Unknown document kind "${body.kind}".` }, { status: 400 });
  }
  if (!Array.isArray(body.documents) || body.documents.length === 0) {
    return NextResponse.json({ error: "At least one document is required." }, { status: 400 });
  }

  try {
    const extraction = await extractFromMarkdown(body.kind, body.documents);

    // I-20 is the only kind with a follow-up web search (see
    // lib/ai/lookupSchoolContactInfo.ts) — surface it here too so this
    // preview tool mirrors the real /api/documents/extract/i20 pipeline.
    let webSearch: unknown = undefined;
    if (body.kind === "i20") {
      const i20Extraction = extraction as I20Extraction;
      webSearch = await lookupSchoolContactInfo({
        schoolName: i20Extraction.schoolName,
        dsoName: i20Extraction.dsoName,
      });
    }

    return NextResponse.json({ extraction, webSearch });
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: detail }, { status: 502 });
  }
}
