import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { CURRENT_SUPPORTED_TAX_YEAR } from "@/lib/config/taxYear";

// Marks the filing as ready to download. The dashboard shows the download
// links once stage is "file" — the actual PDFs are generated on-demand by
// the existing /api/documents/generate/* routes, not here.
export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { error } = await supabase.from("filings").upsert(
    {
      user_id: user.id,
      tax_year: CURRENT_SUPPORTED_TAX_YEAR,
      stage: "file",
    },
    { onConflict: "user_id,tax_year" }
  );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
