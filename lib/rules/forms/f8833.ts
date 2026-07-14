import type { FilerProfile } from "@/lib/types";
import type { IncomeEngineResult } from "@/lib/rules/income";
import { formatSsnDigits, formatUsdWhole } from "@/lib/format";

// Pure mapping from the Stage 5 income engine to Form 8833 line values.
// Only called when income.needsForm8833 is true. Two mutually-exclusive
// scenarios in this app's treaty table (see lib/rules/treaties.ts):
//  - A scholarship-exemption claim with no substantiating 1042-S (China,
//    South Korea today).
//  - India's Article 21(2) standard-deduction claim, which per the proposal
//    always requires disclosure regardless of 1042-S.
export function computeF8833(args: { profile: Partial<FilerProfile>; income: IncomeEngineResult }): Record<string, string> {
  const { profile, income } = args;
  const country = profile.citizenship?.value ?? "";
  const rule = income.treatyRule;
  if (!rule) return {};

  const foreignAddress = profile.foreignAddress
    ? [
        profile.foreignAddress.line1,
        profile.foreignAddress.state,
        profile.foreignAddress.postalCode,
        profile.foreignAddress.country,
      ]
        .filter(Boolean)
        .join(", ")
    : "";
  const usAddress = profile.usAddress
    ? [profile.usAddress.line1, profile.usAddress.city, profile.usAddress.state, profile.usAddress.postalCode]
        .filter(Boolean)
        .join(", ")
    : "";

  const lines: Record<string, string> = {
    "f8833.name": profile.legalName?.value ?? "",
    "f8833.tin": formatSsnDigits(profile.ssnOrItin),
    "f8833.addressForeign": foreignAddress,
    "f8833.addressUS": usAddress,
    "f8833.checkbox6114": "yes",
    "f8833.1a": country,
    "f8833.1b": `Art. ${rule.article}`,
  };

  if (rule.allows_standard_deduction) {
    lines["f8833.2"] = "IRC §63(c) — standard deduction otherwise unavailable to a nonresident alien";
    lines["f8833.6"] =
      `Under Art. ${rule.article} of the US-${country} income tax treaty, a resident of ${country} temporarily present ` +
      "in the United States as a student is entitled to the same standard deduction as a US resident, " +
      `in lieu of itemized deductions. ${formatUsdWhole(income.deduction)} claimed as the standard deduction on Form 1040-NR, line 12.`;
  } else {
    lines["f8833.2"] = "IRC §117(a)/§871(c) — taxability of scholarship and fellowship grants";
    lines["f8833.6"] =
      `Under Art. ${rule.article} of the US-${country} income tax treaty, ${formatUsdWhole(income.scholarshipTreatyExempt)} ` +
      "of taxable scholarship/fellowship income is exempt from U.S. tax. No Form 1042-S was issued reporting this " +
      "exemption, so it is disclosed here per Form 8833 instructions.";
  }

  return lines;
}
