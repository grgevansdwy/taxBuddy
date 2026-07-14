import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { evaluateEligibility } from "@/lib/rules/eligibility";
import { CURRENT_SUPPORTED_TAX_YEAR } from "@/lib/config/taxYear";
import type { I94TravelRow } from "@/lib/types";

interface EligibilityRequestBody {
  taxYear: number;
  visaClass: string;
  firstEntryDate: string;
  passportNumber: string;
  travelHistory: I94TravelRow[];
  hadEarlierFJMQVisa: boolean;
  hasGreenCard: boolean;
  appliedForGreenCard: boolean;
  appliedForGreenCardExplanation?: string;
  changedVisaType: boolean;
  incomeOnlyInWashington: boolean;
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as EligibilityRequestBody;

  const result = evaluateEligibility({
    taxYear: body.taxYear,
    currentSupportedTaxYear: CURRENT_SUPPORTED_TAX_YEAR,
    visaClass: body.visaClass,
    firstEntryDate: body.firstEntryDate,
    travelHistory: body.travelHistory,
    hadEarlierFJMQVisa: body.hadEarlierFJMQVisa,
    hasGreenCard: body.hasGreenCard,
    appliedForGreenCard: body.appliedForGreenCard,
    appliedForGreenCardExplanation: body.appliedForGreenCardExplanation,
    changedVisaType: body.changedVisaType,
    incomeOnlyInWashington: body.incomeOnlyInWashington,
  });

  const { data: existing } = await supabase
    .from("filings")
    .select("profile")
    .eq("user_id", user.id)
    .eq("tax_year", body.taxYear)
    .maybeSingle();

  const { error } = await supabase.from("filings").upsert(
    {
      user_id: user.id,
      tax_year: body.taxYear,
      stage: result.passed ? "profile" : "blocked",
      residency: result.residency,
      // Confirmed input, stored verbatim so the eligibility page can fully
      // rehydrate its confirm substep on back-navigation without re-extracting.
      eligibility_input: {
        taxYear: body.taxYear,
        currentSupportedTaxYear: CURRENT_SUPPORTED_TAX_YEAR,
        visaClass: body.visaClass,
        firstEntryDate: body.firstEntryDate,
        travelHistory: body.travelHistory,
        hadEarlierFJMQVisa: body.hadEarlierFJMQVisa,
        hasGreenCard: body.hasGreenCard,
        appliedForGreenCard: body.appliedForGreenCard,
        appliedForGreenCardExplanation: body.appliedForGreenCardExplanation,
        changedVisaType: body.changedVisaType,
        incomeOnlyInWashington: body.incomeOnlyInWashington,
      },
      profile: {
        ...(existing?.profile ?? {}),
        passportNumber: {
          value: body.passportNumber,
          confidence: 1,
          confirmed: true,
          source: "i94",
        },
      },
    },
    { onConflict: "user_id,tax_year" }
  );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(result);
}
