import type { FilerProfile } from "@/lib/types";
import type { IncomeEngineResult } from "@/lib/rules/income";
import { formatSsnDigits, formatUsd, splitLegalName } from "@/lib/format";

// Pure mapping from case-file data + the Stage 5 income engine to Form
// 1040-NR page 1/2 line values. Scope: only line 1a of the wages section is
// ever populated (box 1 total across all W-2s) — lines 1b-1h (household
// employee wages, tips not on a W-2, etc.) don't apply to this app's income
// types, so 1z (their sum) always equals 1a. The only other "effectively
// connected income" this engine produces is taxable scholarship (line 8,
// standing in for Schedule 1 line 8r since Schedule 1 isn't built separately yet).
// Only the US home address is printed here (not the foreign address block) —
// every filer in this app's scope has a US address from onboarding.
export function computeF1040NR(args: { profile: Partial<FilerProfile>; income: IncomeEngineResult }): Record<string, string> {
  const { profile, income } = args;

  const { firstNameAndInitial, lastName } = splitLegalName(profile.legalName?.value);

  const nonWageWithholding = income.interestWithheld + income.dividendsWithheld + income.capitalGainsWithheld;

  const lines: Record<string, string> = {
    "1040nr.firstName": firstNameAndInitial,
    "1040nr.lastName": lastName,
    "1040nr.tin": formatSsnDigits(profile.ssnOrItin),
    "1040nr.usAddress.line1": profile.usAddress?.line1 ?? "",
    "1040nr.usAddress.aptNo": profile.usAddress?.line2 ?? "",
    "1040nr.usAddress.city": profile.usAddress?.city ?? "",
    "1040nr.usAddress.state": profile.usAddress?.state ?? "",
    "1040nr.usAddress.zip": profile.usAddress?.postalCode ?? "",
    "1040nr.filingStatus.single": profile.filingStatus === "married_nra" ? "no" : "yes",
    "1040nr.filingStatus.mfs": profile.filingStatus === "married_nra" ? "yes" : "no",
    "1040nr.digitalAssets": profile.digitalAssets ? "yes" : "no",
    "1040nr.1a": formatUsd(income.wagesTaxable),
    "1040nr.1z": formatUsd(income.wagesTaxable),
    "1040nr.1k": formatUsd(income.totalTreatyExemptIncome), // must match Schedule OI item L's total
    "1040nr.2a": formatUsd(income.interestExempt),
    "1040nr.8": formatUsd(income.scholarshipTaxable),
    "1040nr.9": formatUsd(income.effectivelyConnectedIncome),
    "1040nr.11a": formatUsd(income.effectivelyConnectedIncome),
    "1040nr.11b": formatUsd(income.effectivelyConnectedIncome),
    "1040nr.12": formatUsd(income.deduction),
    "1040nr.15": formatUsd(income.taxableIncome),
    "1040nr.16": formatUsd(income.effectivelyConnectedTax),
    "1040nr.18": formatUsd(income.effectivelyConnectedTax),
    "1040nr.22": formatUsd(income.effectivelyConnectedTax),
    "1040nr.23a": formatUsd(income.necTax),
    "1040nr.23d": formatUsd(income.necTax),
    "1040nr.24": formatUsd(income.totalTax),
    "1040nr.25a": formatUsd(income.wagesWithheld),
    "1040nr.25b": formatUsd(nonWageWithholding),
    "1040nr.25d": formatUsd(income.wagesWithheld + nonWageWithholding),
    "1040nr.25g": formatUsd(income.scholarship1042SWithheld),
    "1040nr.33": formatUsd(income.totalWithholding),
  };

  if (income.refundOrDue >= 0) {
    // Exactly $0 (withholding matched tax owed precisely) reads as "no
    // refund" rather than "amount owed" — same convention as line 34's own
    // instruction ("if line 33 is more than line 24").
    lines["1040nr.34"] = formatUsd(income.refundOrDue);
    lines["1040nr.35a"] = formatUsd(income.refundOrDue);
  } else {
    lines["1040nr.37"] = formatUsd(-income.refundOrDue);
  }

  return lines;
}
