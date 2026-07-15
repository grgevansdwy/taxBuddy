import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { CURRENT_SUPPORTED_TAX_YEAR } from "@/lib/config/taxYear";
import type { SchoolInfo } from "@/lib/types";

interface I20RequestBody {
  school: SchoolInfo;
  sevisId?: string; // no longer extracted from the I-20; kept for whenever it's collected another way
}

// Nothing extracted is trusted unsupervised — but per the silent
// extract-and-save pattern used for income docs, there's no confirm screen
// here: the client extracts (via /api/documents/extract/i20), then calls
// this route to merge the result into profile immediately.
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as I20RequestBody;

  const { data: existing } = await supabase
    .from("filings")
    .select("profile_page")
    .eq("user_id", user.id)
    .eq("tax_year", CURRENT_SUPPORTED_TAX_YEAR)
    .maybeSingle();

  const { error } = await supabase.from("filings").upsert(
    {
      user_id: user.id,
      tax_year: CURRENT_SUPPORTED_TAX_YEAR,
      profile_page: {
        ...(existing?.profile_page ?? {}),
        school: body.school,
        sevisId: body.sevisId ?? existing?.profile_page?.sevisId,
      },
    },
    { onConflict: "user_id,tax_year" }
  );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
