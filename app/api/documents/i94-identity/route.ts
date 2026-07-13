import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { CURRENT_SUPPORTED_TAX_YEAR } from "@/lib/config/taxYear";

interface I94IdentityRequestBody {
  legalName: string;
  dob: string;
  citizenship: string;
}

// Persists the identity fields pulled off the I-94 (name/DOB/citizenship) as
// soon as extraction succeeds, so the profile page's "Tell us about
// yourself" fields arrive pre-filled instead of blank — the user is only
// confirming, per the EXTRACT-then-CONFIRM principle. Mirrors
// /api/documents/i20's merge-into-profile pattern.
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as I94IdentityRequestBody;

  const { data: existing } = await supabase
    .from("filings")
    .select("profile")
    .eq("user_id", user.id)
    .eq("tax_year", CURRENT_SUPPORTED_TAX_YEAR)
    .maybeSingle();

  const { error } = await supabase.from("filings").upsert(
    {
      user_id: user.id,
      tax_year: CURRENT_SUPPORTED_TAX_YEAR,
      profile: {
        ...(existing?.profile ?? {}),
        legalName: { value: body.legalName, confidence: 1, confirmed: false, source: "i94" },
        dob: { value: body.dob, confidence: 1, confirmed: false, source: "i94" },
        citizenship: { value: body.citizenship, confidence: 1, confirmed: false, source: "i94" },
      },
    },
    { onConflict: "user_id,tax_year" }
  );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
