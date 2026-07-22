import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { parsePdfToMarkdown } from "@/lib/parsing/llamaParse";
import { extractFromMarkdown } from "@/lib/ai/extractFromMarkdown";
import { resolveUploadedDoc } from "@/lib/server/resolveUploadedDoc";

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
  // Use freshly-uploaded files where provided, otherwise fall back to the copy
  // already in Supabase Storage — so changing one document doesn't require
  // re-uploading all of them.
  const i94 = await resolveUploadedDoc(supabase, user.id, "i94", form.get("i94"));
  const travelHistory = await resolveUploadedDoc(supabase, user.id, "travel_history", form.get("travelHistory"));

  if (!i94 || !travelHistory) {
    return NextResponse.json(
      { error: "Both an I-94 and a travel history are required." },
      { status: 400 }
    );
  }

  try {
    const [i94Markdown, travelHistoryMarkdown] = await Promise.all([
      parsePdfToMarkdown({ buffer: i94.buffer, fileName: i94.fileName }),
      parsePdfToMarkdown({ buffer: travelHistory.buffer, fileName: travelHistory.fileName }),
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
