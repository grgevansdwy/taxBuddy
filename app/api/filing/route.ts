import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { CURRENT_SUPPORTED_TAX_YEAR } from "@/lib/config/taxYear";
import type {
  DocType,
  EligibilityInput,
  EligibilityPageData,
  F1042SData,
  F1099BData,
  F1099DAData,
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
  f1099das: F1099DAData[];
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
      "stage, profile_page, eligibility_page, interview_page, documents_needed, documents_upload, f1042s, f1099ints, f1099divs, f1099bs, f1099das, w2s"
    )
    .eq("user_id", user.id)
    .eq("tax_year", CURRENT_SUPPORTED_TAX_YEAR)
    .maybeSingle();

  if (error) {
    console.error("GET /api/filing query failed:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const interviewAnswers = (data?.interview_page as Partial<InterviewAnswers> | null) ?? null;
  const eligibilityPage = (data?.eligibility_page as EligibilityPageData | null) ?? null;

  const response: FilingResponse = {
    stage: data?.stage ?? null,
    profile: (data?.profile_page as Partial<FilerProfile> | null) ?? null,
    residency: (eligibilityPage?.residency as ResidencyResult | undefined) ?? null,
    eligibilityInput: eligibilityPage as EligibilityInput | null,
    interviewAnswers,
    documentsNeeded: (data?.documents_needed as DocType[] | undefined) ?? [],
    uploadedDocuments: (data?.documents_upload as Partial<Record<DocType, UploadedDocument>> | undefined) ?? {},
    f1042s: (data?.f1042s as F1042SData[] | undefined) ?? [],
    f1099ints: (data?.f1099ints as F1099INTData[] | undefined) ?? [],
    f1099divs: (data?.f1099divs as F1099DIVData[] | undefined) ?? [],
    f1099bs: (data?.f1099bs as F1099BData[] | undefined) ?? [],
    f1099das: (data?.f1099das as F1099DAData[] | undefined) ?? [],
    w2s: (data?.w2s as W2Data[] | undefined) ?? [],
    charitableContributions: interviewAnswers?.charitableContributions ?? 0,
    charitableContributionsConfirmed: interviewAnswers?.charitableContributionsConfirmed ?? false,
  };

  return NextResponse.json(response);
}
