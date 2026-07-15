import { createClient } from "@/lib/supabase/server";
import { CURRENT_SUPPORTED_TAX_YEAR } from "@/lib/config/taxYear";
import { computeIncomeEngine, type IncomeEngineResult } from "@/lib/rules/income";
import type {
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

export interface EngineContext {
  profile: Partial<FilerProfile>;
  residency: ResidencyResult;
  eligibilityInput: EligibilityInput;
  income: IncomeEngineResult;
}

export type EngineContextResult = { ok: true; context: EngineContext } | { ok: false; status: number; error: string };

// Shared loader for every /api/documents/generate/* route: auth, fetch the
// case file, and run the Stage 5 income engine once so every form for a
// given filer agrees with every other. f8843 only reads `income` for its
// `hasReportableIncome` flag (whether it's the only form this filer needs).
export async function loadEngineContext(): Promise<EngineContextResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, status: 401, error: "unauthorized" };
  }

  const { data } = await supabase
    .from("filings")
    .select(
      "profile_page, eligibility_page, interview_page, w2s, f1042s, f1099ints, f1099divs, f1099bs, f1099das"
    )
    .eq("user_id", user.id)
    .eq("tax_year", CURRENT_SUPPORTED_TAX_YEAR)
    .maybeSingle();

  if (!data?.eligibility_page) {
    return { ok: false, status: 400, error: "Finish the eligibility and profile steps before generating this form." };
  }

  const profile = (data.profile_page as Partial<FilerProfile>) ?? {};
  const eligibilityPage = data.eligibility_page as EligibilityPageData;
  const residency: ResidencyResult = eligibilityPage.residency;
  const eligibilityInput: EligibilityInput = eligibilityPage;

  const income = computeIncomeEngine({
    taxYear: CURRENT_SUPPORTED_TAX_YEAR,
    profile,
    residency,
    w2s: (data.w2s as W2Data[] | undefined) ?? [],
    f1042s: (data.f1042s as F1042SData[] | undefined) ?? [],
    f1099ints: (data.f1099ints as F1099INTData[] | undefined) ?? [],
    f1099divs: (data.f1099divs as F1099DIVData[] | undefined) ?? [],
    f1099bs: (data.f1099bs as F1099BData[] | undefined) ?? [],
    f1099das: (data.f1099das as F1099DAData[] | undefined) ?? [],
    charitableContributions:
      (data.interview_page as Partial<InterviewAnswers> | null)?.charitableContributions ?? 0,
  });

  return { ok: true, context: { profile, residency, eligibilityInput, income } };
}
