import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { CURRENT_SUPPORTED_TAX_YEAR } from "@/lib/config/taxYear";
import type {
  DocType,
  EligibilityInput,
  F1042SData,
  F1099BData,
  F1099DIVData,
  F1099INTData,
  FilerProfile,
  InterviewAnswers,
  ResidencyResult,
  W2Data,
} from "@/lib/types";

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
  f1042s: F1042SData[];
  f1099ints: F1099INTData[];
  f1099divs: F1099DIVData[];
  f1099bs: F1099BData[];
  w2s: W2Data[];
  charitableContributions: number;
  charitableContributionsConfirmed: boolean;
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

  const { data, error } = await supabase
    .from("filings")
    .select(
      "stage, profile, residency, eligibility_input, interview_answers, documents_needed, uploaded_documents, f1042s, f1099ints, f1099divs, f1099bs, w2s"
    )
    .eq("user_id", user.id)
    .eq("tax_year", CURRENT_SUPPORTED_TAX_YEAR)
    .maybeSingle();

  if (error) {
    console.error("GET /api/filing query failed:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const interviewAnswers = (data?.interview_answers as Partial<InterviewAnswers> | null) ?? null;

  const response: FilingResponse = {
    stage: data?.stage ?? null,
    profile: (data?.profile as Partial<FilerProfile> | null) ?? null,
    residency: (data?.residency as ResidencyResult | null) ?? null,
    eligibilityInput: (data?.eligibility_input as EligibilityInput | null) ?? null,
    interviewAnswers,
    documentsNeeded: (data?.documents_needed as DocType[] | undefined) ?? [],
    uploadedDocuments: (data?.uploaded_documents as Partial<Record<DocType, UploadedDocument>> | undefined) ?? {},
    f1042s: (data?.f1042s as F1042SData[] | undefined) ?? [],
    f1099ints: (data?.f1099ints as F1099INTData[] | undefined) ?? [],
    f1099divs: (data?.f1099divs as F1099DIVData[] | undefined) ?? [],
    f1099bs: (data?.f1099bs as F1099BData[] | undefined) ?? [],
    w2s: (data?.w2s as W2Data[] | undefined) ?? [],
    charitableContributions: interviewAnswers?.charitableContributions ?? 0,
    charitableContributionsConfirmed: interviewAnswers?.charitableContributionsConfirmed ?? false,
  };

  return NextResponse.json(response);
}
