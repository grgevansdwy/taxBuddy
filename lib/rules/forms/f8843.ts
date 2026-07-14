import type { EligibilityInput, FilerProfile, ResidencyResult } from "@/lib/types";
import { formatIsoDateSlashes, splitLegalName } from "@/lib/format";

// Line 11 (Part III) prints these six years statically on the 2025 revision
// of the form — re-verify against the new PDF if CURRENT_SUPPORTED_TAX_YEAR
// ever moves off 2025 (see lib/pdf/fieldMaps/f8843.ts).
const LINE_11_YEARS = [2019, 2020, 2021, 2022, 2023, 2024] as const;

// Pure, deterministic mapping from case-file data to Form 8843 line values.
// No AI involved — every value here is either a direct copy or simple string
// formatting of data the user already confirmed earlier in the wizard.
// Scoped to F-1 students in their first 5 years (Part III) only; Parts II/IV/V
// (teachers, trainees, athletes, medical) are out of scope and left blank.
export function computeForm8843(args: {
  profile: Partial<FilerProfile>;
  residency: ResidencyResult;
  eligibilityInput: EligibilityInput;
}): Record<string, string> {
  const { profile, residency, eligibilityInput } = args;

  const { firstNameAndInitial, lastName } = splitLegalName(profile.legalName?.value);

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

  const school = profile.school
    ? [profile.school.name, profile.school.address, profile.school.phone].filter(Boolean).join(", ")
    : "";

  const dso = profile.school
    ? [profile.school.dsoName, profile.school.dsoAddress, profile.school.dsoPhone].filter(Boolean).join(", ")
    : "";

  const lines: Record<string, string> = {
    "f8843.firstName": firstNameAndInitial,
    "f8843.lastName": lastName,
    "f8843.tin": profile.ssnOrItin ?? "",
    "f8843.foreignAddress": foreignAddress,
    "f8843.usAddress": usAddress,
    "f8843.1a": `${eligibilityInput.visaClass}, ${formatIsoDateSlashes(eligibilityInput.firstEntryDate)}`,
    "f8843.2": profile.citizenship?.value ?? "",
    "f8843.3a": profile.citizenship?.value ?? "",
    "f8843.3b": profile.passportNumber?.value ?? "",
    "f8843.4a.taxYear": String(residency.daysPresent.taxYear),
    "f8843.4a.prior1": String(residency.daysPresent.prior1),
    "f8843.4a.prior2": String(residency.daysPresent.prior2),
    "f8843.4b": String(residency.daysExcluded),
    "f8843.9": school,
    "f8843.10": dso,
    // Anyone reaching this form already passed the Stage 0 five-year gate
    // (lib/rules/eligibility.ts), so line 12 is always "No" for our scope.
    "f8843.12": "no",
    "f8843.13": eligibilityInput.appliedForGreenCard ? "yes" : "no",
    "f8843.14": eligibilityInput.appliedForGreenCardExplanation ?? "",
  };

  for (const year of LINE_11_YEARS) {
    // Field only accepts one character — form wants the visa-type letter
    // (F/J/M/Q), not the full "F-1" class string.
    lines[`f8843.11.${year}`] = residency.visaHistory[year]?.trim().charAt(0).toUpperCase() ?? "";
  }

  return lines;
}
