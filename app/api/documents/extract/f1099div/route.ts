import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { extractF1099Div } from "@/lib/ai/extractF1099Div";

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

  const buffer = await file.arrayBuffer();

  try {
    const extraction = await extractF1099Div({
      f1099divBase64: Buffer.from(buffer).toString("base64"),
    });
    return NextResponse.json(extraction);
  } catch (err) {
    console.error("extractF1099Div failed:", err);
    const detail = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Couldn't read this document: ${detail}` }, { status: 422 });
  }
}
