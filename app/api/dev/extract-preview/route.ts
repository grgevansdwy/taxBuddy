import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { extractFromMarkdown } from "@/lib/ai/extractFromMarkdown";
import type { ExtractionKind } from "@/lib/ai/extractionSpecs";

const VALID_KINDS: ExtractionKind[] = ["i94", "f1042s", "f1098t", "f1099int", "f1099div", "f1099b"];

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
    return NextResponse.json({ extraction });
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: detail }, { status: 502 });
  }
}
