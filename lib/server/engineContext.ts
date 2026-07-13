import { createClient } from "@/lib/supabase/server";
import { CURRENT_SUPPORTED_TAX_YEAR } from "@/lib/config/taxYear";
import { computeIncomeEngine, type IncomeEngineResult } from "@/lib/rules/income";
import type {
  EligibilityInput,
  F1042SData,
  F1098TData,
  F1099BData,
  F1099DIVData,
  F1099INTData,
  FilerProfile,
  ResidencyResult,
} from "@/lib/types";

export interface EngineContext {
  profile: Partial<FilerProfile>;
  residency: ResidencyResult;
  eligibilityInput: EligibilityInput;
  income: IncomeEngineResult;
}

export type EngineContextResult = { ok: true; context: EngineContext } | { ok: false; status: number; error: string };

// Shared loader for every /api/documents/generate/* route beyond f8843: auth,
// fetch the case file, and run the Stage 5 income engine once so every form
// for a given filer agrees with every other. f8843's route doesn't need this
// — it only depends on profile/residency/eligibility_input, not income.
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
      "profile, residency, eligibility_input, f1098t, f1042s, f1099ints, f1099divs, f1099bs, charitable_contributions"
    )
    .eq("user_id", user.id)
    .eq("tax_year", CURRENT_SUPPORTED_TAX_YEAR)
    .maybeSingle();

  if (!data?.residency || !data?.eligibility_input) {
    return { ok: false, status: 400, error: "Finish the eligibility and profile steps before generating this form." };
  }

  const profile = (data.profile as Partial<FilerProfile>) ?? {};
  const residency = data.residency as ResidencyResult;
  const eligibilityInput = data.eligibility_input as EligibilityInput;

  const income = computeIncomeEngine({
    taxYear: CURRENT_SUPPORTED_TAX_YEAR,
    profile,
    residency,
    f1098t: (data.f1098t as F1098TData | null) ?? null,
    f1042s: (data.f1042s as F1042SData[] | undefined) ?? [],
    f1099ints: (data.f1099ints as F1099INTData[] | undefined) ?? [],
    f1099divs: (data.f1099divs as F1099DIVData[] | undefined) ?? [],
    f1099bs: (data.f1099bs as F1099BData[] | undefined) ?? [],
    charitableContributions: (data.charitable_contributions as number | undefined) ?? 0,
  });

  return { ok: true, context: { profile, residency, eligibilityInput, income } };
}
