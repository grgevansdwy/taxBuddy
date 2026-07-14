import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { parsePdfToMarkdown } from "@/lib/parsing/llamaParse";
import { extractFromMarkdown } from "@/lib/ai/extractFromMarkdown";

// Nothing is persisted here — per the EXTRACT-then-CONFIRM principle, extracted
// fields aren't written to the case file until the user confirms them.
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const form = await request.formData();
  const file = form.get("i20");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "An I-20 file is required." }, { status: 400 });
  }

  try {
    const markdown = await parsePdfToMarkdown({ buffer: Buffer.from(await file.arrayBuffer()), fileName: file.name });
    const extraction = await extractFromMarkdown("i20", [{ title: "I-20", markdown }]);
    return NextResponse.json(extraction);
  } catch (err) {
    console.error("extractI20 failed:", err);
    const detail = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Couldn't read this document: ${detail}` }, { status: 422 });
  }
}
