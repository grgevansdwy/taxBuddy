import type { EligibilityInput, FilerProfile, ResidencyResult } from "@/lib/types";
import type { IncomeEngineResult } from "@/lib/rules/income";
import { formatIsoDateSlashesShortYear, formatSsnDigits, formatUsdWhole, splitLegalName } from "@/lib/format";

// Item H prints these three years statically on the 2025 revision of the
// form — re-verify against the new PDF if CURRENT_SUPPORTED_TAX_YEAR ever
// moves off 2025 (same caveat as f8843's LINE_11_YEARS).
const DAYS_PRESENT_YEARS = ["2023", "2024", "2025"] as const;

// Pure, deterministic mapping from case-file data + the Stage 5 income engine
// to Schedule OI (Form 1040-NR) line values. Country of tax residence is
// simplified to citizenship (profile.citizenship) — this app doesn't track a
// separate tax-residence country, which only differs from citizenship in
// edge cases out of scope for F-1 students in their first 5 years.
export function computeScheduleOI(args: {
  profile: Partial<FilerProfile>;
  residency: ResidencyResult;
  eligibilityInput: EligibilityInput;
  income: IncomeEngineResult;
}): Record<string, string> {
  const { profile, residency, eligibilityInput, income } = args;

  const { firstNameAndInitial, lastName } = splitLegalName(profile.legalName?.value);

  const lines: Record<string, string> = {
    "schedOI.name": [firstNameAndInitial, lastName].filter(Boolean).join(" "),
    "schedOI.tin": formatSsnDigits(profile.ssnOrItin),
    "schedOI.A": profile.citizenship?.value ?? "",
    "schedOI.B": profile.citizenship?.value ?? "",
    "schedOI.C": eligibilityInput.appliedForGreenCard ? "yes" : "no",
    "schedOI.D1": "no", // never a US citizen — implied by needing this form at all
    "schedOI.D2": eligibilityInput.hasGreenCard ? "yes" : "no",
    "schedOI.E": eligibilityInput.visaClass,
    "schedOI.F": "no", // visa status change mid-year — out of scope (f8843 edge case, not supported)
    "schedOI.I": profile.priorReturn?.filed ? "yes" : "no",
    "schedOI.I.year": profile.priorReturn?.filed ? String(profile.priorReturn.year ?? "") : "",
    "schedOI.J": "no", // not a trust
    "schedOI.K": "no", // $250,000+ compensation — not applicable, no wages in scope
  };

  residency.entryExitTaxYear.slice(0, 8).forEach((trip, i) => {
    lines[`schedOI.G.${i}.entered`] = formatIsoDateSlashesShortYear(trip.entered);
    lines[`schedOI.G.${i}.departed`] = trip.departed ? formatIsoDateSlashesShortYear(trip.departed) : "";
  });

  const daysPresentByYear = [residency.daysPresent.prior2, residency.daysPresent.prior1, residency.daysPresent.taxYear];
  DAYS_PRESENT_YEARS.forEach((year, i) => {
    lines[`schedOI.H.${year}`] = String(daysPresentByYear[i]);
  });

  // Item L — treaty exemption claim. Only the scholarship-exemption case
  // (e.g. China, South Korea) belongs here; India's standard-deduction claim
  // isn't "exempt income" and has no line 1(d) amount, so item L stays blank
  // for India even though Form 8833 is still required for that claim.
  if (income.scholarshipTreatyExempt > 0 && income.treatyRule) {
    lines["schedOI.L.country"] = profile.citizenship?.value ?? "";
    lines["schedOI.L.article"] = income.treatyRule.article;
    lines["schedOI.L.monthsPriorYears"] = String(income.treatyRule.time_limit_years ? 0 : 0); // first year on this app
    lines["schedOI.L.amount"] = formatUsdWhole(income.scholarshipTreatyExempt);
    lines["schedOI.L.total"] = formatUsdWhole(income.scholarshipTreatyExempt); // → Form 1040-NR line 1k
    lines["schedOI.L2"] = "no"; // taxed by foreign country on this income — not tracked, default no
    lines["schedOI.L3"] = "no"; // Competent Authority determination — out of scope
  }

  return lines;
}
