import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { extractI20 } from "@/lib/ai/extractI20";

// Nothing is persisted here — the caller is responsible for writing the
// extracted fields to the case file via /api/documents/i20.
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const form = await request.formData();
  const i20File = form.get("i20");

  if (!(i20File instanceof File)) {
    return NextResponse.json({ error: "An I-20 file is required." }, { status: 400 });
  }

  const i20Buffer = await i20File.arrayBuffer();

  try {
    const extraction = await extractI20({
      i20Base64: Buffer.from(i20Buffer).toString("base64"),
    });
    return NextResponse.json(extraction);
  } catch (err) {
    console.error("extractI20 failed:", err);
    const detail = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Couldn't read this document: ${detail}` }, { status: 422 });
  }
}
