import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { CURRENT_SUPPORTED_TAX_YEAR } from "@/lib/config/taxYear";

// Partial, non-deciding save of the eligibility inputs as they're gathered
// across the reordered onboarding flow: the extracted fields (visa class, first
// entry date, passport, travel history) are saved on the documents step, and
// the answers on the questions step. The actual eligibility decision runs later
// via POST /api/eligibility from the confirm step.
//
// Merges the incoming fields into eligibility_page so each partial save keeps
// what the others already wrote. Callers serialize their writes on the client
// (the answers save is chained after the extraction save), so this
// read-modify-write never overlaps itself for a given user.
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const patch = (await request.json()) as Record<string, unknown>;

  const { data: existing } = await supabase
    .from("filings")
    .select("eligibility_page")
    .eq("user_id", user.id)
    .eq("tax_year", CURRENT_SUPPORTED_TAX_YEAR)
    .maybeSingle();

  // The answers save carries eligibilityDraftReady — that's the point where the
  // user leaves the eligibility questions for profile, so advance the resume
  // stage to "profile". (stage is a separate column, so this doesn't disturb the
  // eligibility_page merge.) The final decision at /api/eligibility moves it on.
  const advanceStage = patch.eligibilityDraftReady === true;

  const { error } = await supabase.from("filings").upsert(
    {
      user_id: user.id,
      tax_year: CURRENT_SUPPORTED_TAX_YEAR,
      ...(advanceStage ? { stage: "profile" } : {}),
      eligibility_page: {
        ...((existing?.eligibility_page as Record<string, unknown> | null) ?? {}),
        ...patch,
      },
    },
    { onConflict: "user_id,tax_year" }
  );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
