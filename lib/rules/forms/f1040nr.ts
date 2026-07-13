import type { FilerProfile } from "@/lib/types";
import type { IncomeEngineResult } from "@/lib/rules/income";
import { formatSsnDigits, formatUsdWhole, splitLegalName } from "@/lib/format";

// Pure mapping from case-file data + the Stage 5 income engine to Form
// 1040-NR page 1/2 line values. Scope: no wages this phase, so lines 1a-1h
// and 1z are always blank/0 — the only "effectively connected income" this
// engine ever produces is taxable scholarship (line 8, standing in for
// Schedule 1 line 8r since Schedule 1 isn't built separately yet).
export function computeF1040NR(args: { profile: Partial<FilerProfile>; income: IncomeEngineResult }): Record<string, string> {
  const { profile, income } = args;

  const { firstNameAndInitial, lastName } = splitLegalName(profile.legalName?.value);

  const lines: Record<string, string> = {
    "1040nr.firstName": firstNameAndInitial,
    "1040nr.lastName": lastName,
    "1040nr.tin": formatSsnDigits(profile.ssnOrItin),
    "1040nr.filingStatus.single": profile.filingStatus === "married_nra" ? "no" : "yes",
    "1040nr.filingStatus.mfs": profile.filingStatus === "married_nra" ? "yes" : "no",
    "1040nr.digitalAssets": profile.digitalAssets ? "yes" : "no",
    "1040nr.1k": formatUsdWhole(income.scholarshipTreatyExempt),
    "1040nr.2a": formatUsdWhole(income.interestExempt),
    "1040nr.8": formatUsdWhole(income.scholarshipTaxable),
    "1040nr.9": formatUsdWhole(income.effectivelyConnectedIncome),
    "1040nr.11a": formatUsdWhole(income.effectivelyConnectedIncome),
    "1040nr.11b": formatUsdWhole(income.effectivelyConnectedIncome),
    "1040nr.12": formatUsdWhole(income.deduction),
    "1040nr.15": formatUsdWhole(income.taxableIncome),
    "1040nr.16": formatUsdWhole(income.effectivelyConnectedTax),
    "1040nr.18": formatUsdWhole(income.effectivelyConnectedTax),
    "1040nr.22": formatUsdWhole(income.effectivelyConnectedTax),
    "1040nr.23a": formatUsdWhole(income.necTax),
    "1040nr.23d": formatUsdWhole(income.necTax),
    "1040nr.24": formatUsdWhole(income.totalTax),
    "1040nr.25b": formatUsdWhole(income.interestWithheld + income.dividendsWithheld + income.capitalGainsWithheld),
    "1040nr.25d": formatUsdWhole(income.interestWithheld + income.dividendsWithheld + income.capitalGainsWithheld),
    "1040nr.25g": formatUsdWhole(income.scholarship1042SWithheld),
    "1040nr.33": formatUsdWhole(income.totalWithholding),
  };

  if (income.refundOrDue > 0) {
    lines["1040nr.34"] = formatUsdWhole(income.refundOrDue);
    lines["1040nr.35a"] = formatUsdWhole(income.refundOrDue);
  } else if (income.refundOrDue < 0) {
    lines["1040nr.37"] = formatUsdWhole(-income.refundOrDue);
  }

  return lines;
}
