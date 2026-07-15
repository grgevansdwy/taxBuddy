import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { extractTransactionsPerPage } from "@/lib/ai/extractTransactionsPerPage";

// Nothing is persisted here — per the EXTRACT-then-CONFIRM principle, extracted
// fields aren't written to the case file until the user confirms them via
// /api/documents/income. One call handles one broker's 1099-DA (all its
// digital-asset transaction rows) — extracted per page and merged (see
// extractTransactionsPerPage), same reasoning as the 1099-B route.
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const form = await request.formData();
  const file = form.get("f1099da");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "A 1099-DA file is required." }, { status: 400 });
  }

  try {
    const extraction = await extractTransactionsPerPage(
      "f1099da",
      "1099-DA",
      { buffer: Buffer.from(await file.arrayBuffer()), fileName: file.name }
    );
    return NextResponse.json(extraction);
  } catch (err) {
    console.error("extractF1099DA failed:", err);
    const detail = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Couldn't read this document: ${detail}` }, { status: 422 });
  }
}
