import type { EligibilityInput, EligibilityResult, I94TravelRow } from "@/lib/types";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function parseDate(iso: string): Date {
  return new Date(`${iso}T00:00:00Z`);
}

function overlapDays(start: Date, end: Date, rangeStart: Date, rangeEnd: Date): number {
  const s = start > rangeStart ? start : rangeStart;
  const e = end < rangeEnd ? end : rangeEnd;
  if (e < s) return 0;
  return Math.floor((e.getTime() - s.getTime()) / MS_PER_DAY) + 1;
}

// Pairs sequential arrival/departure rows into stays. A trailing arrival with
// no matching departure is treated as still-present (departed: null).
function pairStays(travelHistory: I94TravelRow[]): { entered: string; departed: string | null }[] {
  const sorted = [...travelHistory].sort((a, b) => a.date.localeCompare(b.date));
  const stays: { entered: string; departed: string | null }[] = [];
  let openArrival: string | null = null;
  for (const row of sorted) {
    if (row.type === "arrival") {
      openArrival = row.date;
    } else if (row.type === "departure") {
      stays.push({ entered: openArrival ?? row.date, departed: row.date });
      openArrival = null;
    }
  }
  if (openArrival) stays.push({ entered: openArrival, departed: null });
  return stays;
}

function daysPresentInYear(travelHistory: I94TravelRow[], year: number): number {
  const yearStart = new Date(Date.UTC(year, 0, 1));
  const yearEnd = new Date(Date.UTC(year, 11, 31));
  let total = 0;
  for (const stay of pairStays(travelHistory)) {
    const entered = parseDate(stay.entered);
    const departed = stay.departed ? parseDate(stay.departed) : yearEnd;
    total += overlapDays(entered, departed, yearStart, yearEnd);
  }
  return total;
}

// The F-1 five-year exempt-individual count starts at the first US entry made
// *as an F-1 student*, not at any earlier entry on a different status (e.g. a
// tourist B visa years earlier). The I-20's "Earliest Admission Date" is the
// earliest a student may enter to begin the program, so the first travel-history
// arrival on/after it is the true first F-1 entry. Falls back to `fallback` (the
// I-94's earliest arrival) when the I-20 date is absent, so filers without a
// readable admission date keep the prior behavior.
export function computeFirstF1EntryDate(
  travelHistory: I94TravelRow[],
  earliestAdmissionDate: string,
  fallback: string,
): string {
  if (!earliestAdmissionDate) return fallback;
  const firstArrivalOnOrAfter = travelHistory
    .filter((row) => row.type === "arrival")
    .map((row) => row.date)
    .sort((a, b) => a.localeCompare(b))
    .find((date) => date >= earliestAdmissionDate);
  // No recorded arrival on/after the admission date (incomplete travel history):
  // the admission date itself is the best available anchor for the F-1 start.
  return firstArrivalOnOrAfter ?? earliestAdmissionDate;
}

// The subset of block reasons that depend only on the user's answers, not on
// anything extracted from the documents. The onboarding flow checks these right
// after the eligibility questions (before profile), so an answer-based block
// fires early instead of after the document-derived confirm step. Messages are
// kept identical to the corresponding branches in evaluateEligibility below.
export function answerBasedBlockReason(answers: {
  hasGreenCard: boolean;
  changedVisaType: boolean;
  incomeOnlyInWashington: boolean;
}): string | null {
  if (answers.hasGreenCard) {
    return "Green card holders are treated as US residents for tax purposes, which is outside what we support right now.";
  }
  if (answers.changedVisaType) {
    return "You mentioned changing visa type at some point, which we can't account for yet. Not supported yet.";
  }
  if (!answers.incomeOnlyInWashington) {
    return "We currently only support filers whose income was earned entirely while physically working or living in Washington State. Not supported yet.";
  }
  return null;
}

export function evaluateEligibility(input: EligibilityInput): EligibilityResult {
  const firstEntryYear = Number(input.firstEntryDate.slice(0, 4));
  const exemptYearsUsed = input.taxYear - firstEntryYear + 1;

  const visaHistory: Record<number, string> = {};
  for (let year = firstEntryYear; year <= input.taxYear; year++) {
    visaHistory[year] = input.visaClass;
  }

  const daysPresent = {
    taxYear: daysPresentInYear(input.travelHistory, input.taxYear),
    prior1: daysPresentInYear(input.travelHistory, input.taxYear - 1),
    prior2: daysPresentInYear(input.travelHistory, input.taxYear - 2),
  };

  const entryExitTaxYear = pairStays(input.travelHistory).filter((stay) => {
    const enteredYear = Number(stay.entered.slice(0, 4));
    const departedYear = stay.departed ? Number(stay.departed.slice(0, 4)) : input.taxYear;
    return enteredYear <= input.taxYear && departedYear >= input.taxYear;
  });

  const isF1 = input.visaClass.trim().toUpperCase().replace(/\s+/g, "") === "F-1";

  let passed = true;
  let reasoning: string;

  if (input.taxYear !== input.currentSupportedTaxYear) {
    passed = false;
    reasoning = `We only support filing for the ${input.currentSupportedTaxYear} tax year right now, so we can't help with ${input.taxYear} yet.`;
  } else if (!isF1) {
    passed = false;
    reasoning = `We currently only support F-1 students. Your I-94 shows a ${input.visaClass} status, which isn't covered yet.`;
  } else if (input.hasGreenCard) {
    passed = false;
    reasoning = "Green card holders are treated as US residents for tax purposes, which is outside what we support right now.";
  } else if (input.hadEarlierFJMQVisa) {
    passed = false;
    reasoning =
      "You mentioned being in the US on an F, J, M, or Q visa in an earlier year we can't verify from this I-94 alone, so we can't confirm you're still within your first five calendar years. Not supported yet.";
  } else if (input.changedVisaType) {
    passed = false;
    reasoning = "You mentioned changing visa type at some point, which we can't account for yet. Not supported yet.";
  } else if (!input.incomeOnlyInWashington) {
    passed = false;
    reasoning =
      "We currently only support filers whose income was earned entirely while physically working or living in Washington State. Not supported yet.";
  } else if (exemptYearsUsed > 5) {
    passed = false;
    reasoning = `Your I-94 shows you first entered in ${firstEntryYear}, which is more than five calendar years ago. You're treated as a resident for tax purposes, so we can't help with your filing yet.`;
  } else {
    reasoning = `Passed! You entered the US in ${firstEntryYear} on F-1 status, so you're within your first five calendar years — you're a nonresident for tax purposes and your days don't count toward residency.`;
  }

  return {
    passed,
    reasoning,
    residency: {
      exemptYearsUsed,
      isNonresident: passed,
      firstEntryDate: input.firstEntryDate,
      daysPresent,
      daysExcluded: daysPresent.taxYear,
      entryExitTaxYear,
      visaHistory,
      reasoning,
    },
  };
}
