import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { CURRENT_SUPPORTED_TAX_YEAR } from "@/lib/config/taxYear";
import type { DocType, EligibilityInput, FilerProfile, InterviewAnswers, ResidencyResult } from "@/lib/types";

export interface UploadedDocument {
  fileName: string;
  path: string;
  uploadedAt: string;
}

export interface FilingResponse {
  stage: string | null;
  profile: Partial<FilerProfile> | null;
  residency: ResidencyResult | null;
  eligibilityInput: EligibilityInput | null;
  interviewAnswers: Partial<InterviewAnswers> | null;
  documentsNeeded: DocType[];
  uploadedDocuments: Partial<Record<DocType, UploadedDocument>>;
}

// Single hydration source for every onboarding page: each page fetches this
// on mount and prefills its own fields from whatever's already saved, so
// back-navigation never shows an empty form when data exists.
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
    .select("stage, profile, residency, eligibility_input, interview_answers, documents_needed, uploaded_documents")
    .eq("user_id", user.id)
    .eq("tax_year", CURRENT_SUPPORTED_TAX_YEAR)
    .maybeSingle();

  const response: FilingResponse = {
    stage: data?.stage ?? null,
    profile: (data?.profile as Partial<FilerProfile> | null) ?? null,
    residency: (data?.residency as ResidencyResult | null) ?? null,
    eligibilityInput: (data?.eligibility_input as EligibilityInput | null) ?? null,
    interviewAnswers: (data?.interview_answers as Partial<InterviewAnswers> | null) ?? null,
    documentsNeeded: (data?.documents_needed as DocType[] | undefined) ?? [],
    uploadedDocuments: (data?.uploaded_documents as Partial<Record<DocType, UploadedDocument>> | undefined) ?? {},
  };

  return NextResponse.json(response);
}
