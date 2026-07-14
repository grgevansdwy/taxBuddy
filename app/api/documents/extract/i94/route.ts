import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { parsePdfToMarkdown } from "@/lib/parsing/llamaParse";
import { extractFromMarkdown } from "@/lib/ai/extractFromMarkdown";

// Nothing is persisted here — per the EXTRACT-then-CONFIRM principle, extracted
// fields aren't written to the case file until the user confirms them via
// /api/eligibility. PDF -> markdown (LlamaParse) -> structured fields
// (gpt-4o-mini), validated against the same Zod schema either pipeline uses.
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const form = await request.formData();
  const i94File = form.get("i94");
  const travelHistoryFile = form.get("travelHistory");

  if (!(i94File instanceof File) || !(travelHistoryFile instanceof File)) {
    return NextResponse.json(
      { error: "Both an I-94 and a travel history file are required." },
      { status: 400 }
    );
  }

  try {
    const [i94Markdown, travelHistoryMarkdown] = await Promise.all([
      parsePdfToMarkdown({ buffer: Buffer.from(await i94File.arrayBuffer()), fileName: i94File.name }),
      parsePdfToMarkdown({
        buffer: Buffer.from(await travelHistoryFile.arrayBuffer()),
        fileName: travelHistoryFile.name,
      }),
    ]);

    const extraction = await extractFromMarkdown("i94", [
      { title: "I-94", markdown: i94Markdown },
      { title: "I-94 travel history", markdown: travelHistoryMarkdown },
    ]);
    return NextResponse.json(extraction);
  } catch (err) {
    // TODO: swap this for structured logging + a sanitized user-facing message
    // before this ships to real users. Surfacing the raw error for now so it's
    // debuggable during development.
    console.error("extractI94 failed:", err);
    const detail = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: `Couldn't read one of these documents: ${detail}` },
      { status: 422 }
    );
  }
}
