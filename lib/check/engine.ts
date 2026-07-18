import { CURRENT_SUPPORTED_TAX_YEAR } from "@/lib/config/taxYear";
import { computeIncomeEngine, type IncomeEngineResult } from "@/lib/rules/income";
import { withRealizedGainLoss } from "@/lib/rules/capitalGains";
import type {
  F1042SData,
  F1099BData,
  F1099DAData,
  F1099DIVData,
  F1099INTData,
  FilerProfile,
  ResidencyResult,
  W2Data,
} from "@/lib/types";

// Shared by /api/check/estimate and /api/check/score so both run the SAME real
// Stage 5 engine (lib/rules/income.ts) over the funnel's income documents with
// the SAME assumptions. The funnel doesn't collect the filer's background (no
// I-20, no I-94, no eligibility interview), so we assume they are exactly this
// app's target filer and feed the engine those assumptions:
//   • an F-1 nonresident alien,
//   • filing Single (dominant case; married-NRA is rare),
//   • present the majority of the tax year, so the §871(a)(2) 183-day
//     capital-gains test is met (the common full-year-student case, and the
//     conservative one — it taxes net gains rather than over-promising),
//   • no charitable contributions (Schedule A itemizing isn't asked here).
// Citizenship is the one background fact that materially moves the number
// (India's standard deduction, treaty dividend rates / scholarship
// exemptions), so the funnel collects it directly.

const ASSUMED_PRESENT_DAYS = 300; // ≥183 → capital gains taxable

export interface FunnelIncomeInput {
  country?: string;
  filingStatus?: FilerProfile["filingStatus"];
  w2s?: W2Data[];
  f1042s?: F1042SData[];
  f1099ints?: F1099INTData[];
  f1099divs?: F1099DIVData[];
  f1099bs?: F1099BData[];
  f1099das?: F1099DAData[];
}

export function runFunnelEngine(input: FunnelIncomeInput): IncomeEngineResult {
  const filingStatus: FilerProfile["filingStatus"] =
    input.filingStatus === "married_nra" ? "married_nra" : "single";

  const profile: Partial<FilerProfile> = {
    citizenship: { value: input.country ?? "", confidence: 1, confirmed: true, source: "i94" },
    filingStatus,
  };

  const residency: ResidencyResult = {
    exemptYearsUsed: 0,
    isNonresident: true,
    firstEntryDate: "",
    daysPresent: { taxYear: ASSUMED_PRESENT_DAYS, prior1: 0, prior2: 0 },
    daysExcluded: ASSUMED_PRESENT_DAYS,
    entryExitTaxYear: [],
    visaHistory: {},
    reasoning: "Assumed F-1 nonresident present the majority of the tax year (Refund Check estimate).",
  };

  return computeIncomeEngine({
    taxYear: CURRENT_SUPPORTED_TAX_YEAR,
    profile,
    residency,
    w2s: input.w2s ?? [],
    f1042s: input.f1042s ?? [],
    f1099ints: input.f1099ints ?? [],
    f1099divs: input.f1099divs ?? [],
    // realizedGainLoss is derived, never trusted from the client — same as the
    // app's persist step in /api/documents/income.
    f1099bs: withRealizedGainLoss(input.f1099bs ?? []),
    f1099das: withRealizedGainLoss(input.f1099das ?? []),
    charitableContributions: 0,
  });
}
