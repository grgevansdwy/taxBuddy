import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { extractI94 } from "@/lib/ai/extractI94";

// Nothing is persisted here — per the EXTRACT-then-CONFIRM principle, extracted
// fields aren't written to the case file until the user confirms them via
// /api/eligibility.
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

  const [i94Buffer, travelHistoryBuffer] = await Promise.all([
    i94File.arrayBuffer(),
    travelHistoryFile.arrayBuffer(),
  ]);

  try {
    const extraction = await extractI94({
      i94Base64: Buffer.from(i94Buffer).toString("base64"),
      travelHistoryBase64: Buffer.from(travelHistoryBuffer).toString("base64"),
    });
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
