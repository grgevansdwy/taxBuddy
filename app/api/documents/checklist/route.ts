import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { computeDocumentChecklist, explainChecklist } from "@/lib/rules/documentChecklist";
import { CURRENT_SUPPORTED_TAX_YEAR } from "@/lib/config/taxYear";
import type { DocType, InterviewAnswers } from "@/lib/types";

interface ChecklistRequestBody extends InterviewAnswers {
  taxYear: number;
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
  const { taxYear, ...interview } = body;

  const documents = computeDocumentChecklist(interview);
  const explanation = explainChecklist(documents);

  const { error } = await supabase.from("filings").upsert(
    {
      user_id: user.id,
      tax_year: taxYear,
      stage: "documents",
      interview_answers: interview,
      documents_needed: documents,
    },
    { onConflict: "user_id,tax_year" }
  );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ documents, explanation });
}
