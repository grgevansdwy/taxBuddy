import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { computeDocumentChecklist, explainChecklist } from "@/lib/rules/documentChecklist";
import { CURRENT_SUPPORTED_TAX_YEAR } from "@/lib/config/taxYear";
import type { DocType, InterviewAnswers } from "@/lib/types";

interface ChecklistRequestBody extends InterviewAnswers {
  taxYear: number;
  digitalAssets: boolean;
}

// Lets the Stage 2 upload page re-fetch the checklist Stage 1 already computed,
// instead of threading it through client-side navigation state.
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { data } = await supabase
    .from("filings")
    .select("documents_needed")
    .eq("user_id", user.id)
    .eq("tax_year", CURRENT_SUPPORTED_TAX_YEAR)
    .maybeSingle();

  const documents = (data?.documents_needed as DocType[] | undefined) ?? [];
  return NextResponse.json({ documents, explanation: explainChecklist(documents) });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as ChecklistRequestBody;
  const { taxYear, digitalAssets, ...interview } = body;

  const documents = computeDocumentChecklist(interview);
  const explanation = explainChecklist(documents);

  const { data: existing } = await supabase
    .from("filings")
    .select("profile_page, interview_page")
    .eq("user_id", user.id)
    .eq("tax_year", taxYear)
    .maybeSingle();

  const { error } = await supabase.from("filings").upsert(
    {
      user_id: user.id,
      tax_year: taxYear,
      stage: "documents",
      // charitableContributions/charitableContributionsConfirmed live in
      // this same column but are saved separately via /api/reduction —
      // merge rather than replace so this write can't clobber those.
      interview_page: {
        ...(existing?.interview_page ?? {}),
        ...interview,
      },
      documents_needed: documents,
      // digitalAssets is asked on this page but lives on profile_page (it's
      // a 1040-NR-level field, not a documents-checklist input) — merge it
      // in rather than replacing the whole profile object.
      profile_page: {
        ...(existing?.profile_page ?? {}),
        digitalAssets,
      },
    },
    { onConflict: "user_id,tax_year" }
  );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ documents, explanation });
}
