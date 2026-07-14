import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { parsePdfToMarkdown } from "@/lib/parsing/llamaParse";
import { extractFromMarkdown } from "@/lib/ai/extractFromMarkdown";

// Nothing is persisted here — per the EXTRACT-then-CONFIRM principle, extracted
// fields aren't written to the case file until the user confirms them via
// /api/documents/income. One call handles one payer's 1099-DIV.
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const form = await request.formData();
  const file = form.get("f1099div");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "A 1099-DIV file is required." }, { status: 400 });
  }

  try {
    const markdown = await parsePdfToMarkdown({ buffer: Buffer.from(await file.arrayBuffer()), fileName: file.name });
    const extraction = await extractFromMarkdown("f1099div", [{ title: "1099-DIV", markdown }]);
    return NextResponse.json(extraction);
  } catch (err) {
    console.error("extractF1099Div failed:", err);
    const detail = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Couldn't read this document: ${detail}` }, { status: 422 });
  }
}
