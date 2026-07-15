import type { EligibilityInput, FilerProfile, ResidencyResult } from "@/lib/types";
import type { IncomeEngineResult } from "@/lib/rules/income";
import { formatIsoDateSlashesShortYear, formatSsnDigits, formatUsd, splitLegalName } from "@/lib/format";

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
    "schedOI.E": `${eligibilityInput.visaClass} Student`,
    "schedOI.F": "no", // visa status change mid-year — out of scope (f8843 edge case, not supported)
    "schedOI.I": profile.priorReturn?.filed ? "yes" : "no",
    // Official form has a single blank for "latest year AND form number filed" —
    // not two separate boxes — so both pieces combine into one line here.
    "schedOI.I.detail": profile.priorReturn?.filed
      ? [
          profile.priorReturn.year ? String(profile.priorReturn.year) : "",
          profile.priorReturn.form ? `Form ${profile.priorReturn.form}` : "",
        ]
          .filter(Boolean)
          .join(", ")
      : "",
    "schedOI.J": "no", // not a trust
    "schedOI.K": "no", // $250,000+ compensation — not applicable, no wages in scope
    // L2/L3 are standalone yes/no questions, independent of whether item L1
    // has a treaty-exempt-income row above — always answered, never left blank.
    "schedOI.L2": "no", // taxed by foreign country on this income — not tracked, default no
    "schedOI.L3": "no", // Competent Authority determination — out of scope
  };

  residency.entryExitTaxYear.slice(0, 8).forEach((trip, i) => {
    lines[`schedOI.G.${i}.entered`] = formatIsoDateSlashesShortYear(trip.entered);
    lines[`schedOI.G.${i}.departed`] = trip.departed ? formatIsoDateSlashesShortYear(trip.departed) : "";
  });

  const daysPresentByYear = [residency.daysPresent.prior2, residency.daysPresent.prior1, residency.daysPresent.taxYear];
  DAYS_PRESENT_YEARS.forEach((year, i) => {
    lines[`schedOI.H.${year}`] = String(daysPresentByYear[i]);
  });

  // Item L1 — treaty-exempt-income claims. The real table has 3 rows; each
  // row here is a distinct income type this app ever treats as fully exempt
  // under a treaty article — scholarship (e.g. China, Korea, Indonesia) and
  // wages (e.g. Indonesia's $2,000/year cap). A filer with neither correctly
  // gets zero rows. India's standard-deduction claim isn't "exempt income"
  // and never gets a row here, even though Form 8833 is still required for
  // that claim. Adding a new exempt-income type elsewhere in the engine just
  // means pushing another row here — up to the table's 3-row limit.
  const treatyExemptRows: { article: string; monthsPriorYears: string; amount: number }[] = [];
  if (income.scholarshipTreatyExempt > 0 && income.treatyRule) {
    treatyExemptRows.push({
      article: income.treatyRule.article,
      monthsPriorYears: String(income.treatyRule.time_limit_years ? 0 : 0), // first year on this app
      amount: income.scholarshipTreatyExempt,
    });
  }
  if (income.wagesTreatyExempt > 0 && income.wagesTreatyRule) {
    treatyExemptRows.push({
      article: income.wagesTreatyRule.article,
      monthsPriorYears: String(income.wagesTreatyRule.time_limit_years ? 0 : 0),
      amount: income.wagesTreatyExempt,
    });
  }

  treatyExemptRows.forEach((row, i) => {
    lines[`schedOI.L.country.${i}`] = profile.citizenship?.value ?? "";
    lines[`schedOI.L.article.${i}`] = row.article;
    lines[`schedOI.L.monthsPriorYears.${i}`] = row.monthsPriorYears;
    lines[`schedOI.L.amount.${i}`] = formatUsd(row.amount);
  });
  if (treatyExemptRows.length > 0) {
    lines["schedOI.L.total"] = formatUsd(income.totalTreatyExemptIncome); // → Form 1040-NR line 1k
  }

  return lines;
}
