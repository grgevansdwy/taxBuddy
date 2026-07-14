import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { parsePdfToMarkdown } from "@/lib/parsing/llamaParse";

// Internal-only: lets the /dev/parse-preview page show what LlamaParse
// produces for a given document before any extraction pipeline is wired to
// read it. Nothing here touches the filings table — pure preview, no
// persistence.
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "A file is required." }, { status: 400 });
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const markdown = await parsePdfToMarkdown({ buffer, fileName: file.name });
    return NextResponse.json({ fileName: file.name, markdown });
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: detail }, { status: 502 });
  }
}
