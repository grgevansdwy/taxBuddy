import type { FilerProfile } from "@/lib/types";
import type { IncomeEngineResult } from "@/lib/rules/income";
import { formatSsnDigits, formatUsdWhole, splitLegalName } from "@/lib/format";

// Pure mapping from the Stage 5 income engine to Schedule A (Form 1040-NR)
// line values. Scope: gifts to US charities only (line 2) — no state/local
// tax line (no wages this phase) and no casualty/other-deduction lines.
// Only relevant when income.usesStandardDeduction is false; the caller
// decides whether to attach this form at all (India filers who come out
// ahead on the standard deduction skip Schedule A entirely).
export function computeScheduleA(args: { profile: Partial<FilerProfile>; income: IncomeEngineResult }): Record<string, string> {
  const { profile, income } = args;
  if (income.charitableContributions <= 0) return {};

  const { firstNameAndInitial, lastName } = splitLegalName(profile.legalName?.value);
  const total = income.charitableContributions;
  return {
    "schedA.name": [firstNameAndInitial, lastName].filter(Boolean).join(" "),
    "schedA.tin": formatSsnDigits(profile.ssnOrItin),
    "schedA.2": formatUsdWhole(total),
    "schedA.5": formatUsdWhole(total),
    "schedA.8": formatUsdWhole(total), // → Form 1040-NR line 12
  };
}
