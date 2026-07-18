// Synthetic sample filer for the Logic Viz audit tool (app/(protected)/dev/logic-viz).
//
// Scope: a single, deliberately narrow case — an Indonesian, NON-scholarship
// F-1 student — chosen so the 1040-NR's whole "effectively connected income +
// tax" spine plus Schedule NEC's flat-rate income are all exercised and every
// treaty branch that applies to Indonesia fires:
//   * wages above Indonesia's $2,000 treaty cap  (Art 19(1)(b)(iii))   → line 1a/1k
//   * dividends at Indonesia's 15% NEC treaty rate (Art 11(2))         → Schedule NEC → 23a
//   * a taxable capital gain (present ≥183 days, IRC §871(a)(2))        → Schedule NEC → 23a
//   * exempt bank interest (§871(i)) — intentionally lands on NO line, the classic audit gotcha
//   * NO 1042-S at all → non-scholarship, so line 8 = 0 and no Form 8833.
//
// This is fixed test data, not a real filer. It mirrors the shape of the
// fixture in tests/golden/1040nr-scheduleOI.test.ts but drops the scholarship.
// Kept as an importable module (not trapped inside a .test.ts) so the API
// route and the drift-guard test can both run the real engine on it.

import type {
  EligibilityInput,
  F1042SData,
  F1099BData,
  F1099DAData,
  F1099DIVData,
  F1099INTData,
  FilerProfile,
  ResidencyResult,
  W2Data,
} from "@/lib/types";

export const TAX_YEAR = 2025;

export const profile: Partial<FilerProfile> = {
  legalName: { value: "Budi Hartono Santoso", confidence: 1, confirmed: true, source: "i94" },
  citizenship: { value: "Indonesia", confidence: 1, confirmed: true, source: "i94" },
  passportNumber: { value: "A1234567", confidence: 1, confirmed: true, source: "i94" },
  dob: { value: "2000-01-01", confidence: 1, confirmed: true, source: "i94" },
  ssnOrItin: "123-45-6789",
  filingStatus: "single",
  digitalAssets: false,
  usAddress: { line1: "123 Main St", city: "Seattle", state: "WA", postalCode: "98105", country: "United States" },
  foreignAddress: { line1: "Jl. Sudirman 1", postalCode: "10110", country: "Indonesia" },
  priorReturn: { filed: true, year: 2024, form: "1040-NR" },
  school: {
    name: "University of Washington",
    address: "1400 NE Campus Parkway, Seattle, WA 98195",
    phone: "206-543-2100",
    dsoName: "Amber Pilgreen",
    dsoAddress: "459 Schmitz Hall, 1410 NE Campus Parkway, Seattle, WA 98195",
    dsoPhone: "206-221-7857",
  },
  sevisId: "N0012345678",
};

export const residency: ResidencyResult = {
  exemptYearsUsed: 3,
  isNonresident: true,
  firstEntryDate: "2023-08-15",
  daysPresent: { taxYear: 300, prior1: 365, prior2: 138 }, // taxYear ≥ 183 → capital gains taxable
  daysExcluded: 300,
  entryExitTaxYear: [{ entered: "2025-01-01", departed: null }],
  visaHistory: { 2023: "F-1", 2024: "F-1", 2025: "F-1" },
  reasoning: "F-1 within first 5 calendar years → nonresident; days don't count toward substantial presence.",
};

export const eligibilityInput: EligibilityInput = {
  taxYear: TAX_YEAR,
  currentSupportedTaxYear: TAX_YEAR,
  visaClass: "F-1",
  firstEntryDate: "2023-08-15",
  travelHistory: [],
  hadEarlierFJMQVisa: false,
  hasGreenCard: false,
  appliedForGreenCard: false,
  changedVisaType: false,
  incomeOnlyInWashington: true,
};

export const w2s: W2Data[] = [
  {
    employerName: "UW Library",
    employerEin: "91-1234567",
    employerAddress: "Seattle, WA",
    box1: 6000, // first $2,000 treaty-exempt → $4,000 taxable
    box2: 600, // federal income tax withheld → line 25a
    box3: 6000,
    box4: 0, // F-1 NRAs are FICA-exempt; 0 keeps this fixture clean of a FICA finding
    box5: 6000,
    box6: 0,
    box15State: null, // Washington has no state income tax
    box17StateTaxWithheld: null,
  },
];

// No 1042-S: this filer received no scholarship (the whole point of the case).
export const f1042s: F1042SData[] = [];

export const f1099divs: F1099DIVData[] = [
  {
    payerName: "Brokerage Inc",
    payerEin: "12-3456789",
    box1aTotalOrdinaryDividends: 500, // → Schedule NEC line 1a, taxed at Indonesia's 15% treaty rate
    box1bQualifiedDividends: 0,
    box4FederalTaxWithheld: 75,
  },
];

export const f1099bs: F1099BData[] = [
  {
    payerName: "Brokerage Inc",
    transactions: [
      {
        description: "100 sh AAPL",
        dateAcquired: "2024-01-01",
        dateSold: "2025-06-01",
        proceeds: 2000,
        costBasis: 1000,
        washSaleLossDisallowed: 0,
        realizedGainLoss: 1000, // proceeds − basis; taxed at 30% because present ≥183 days
        isShortTerm: true,
        box4FederalTaxWithheld: 0,
      },
    ],
  },
];

export const f1099ints: F1099INTData[] = [
  {
    payerName: "Seattle Credit Union",
    payerEin: "98-7654321",
    box1InterestIncome: 200, // §871(i) exempt for NRAs — appears on NO 1040-NR line
    box4FederalTaxWithheld: 0,
    box8TaxExemptInterest: 0,
  },
];

export const charitableContributions = 0; // Indonesia's treaty grants no standard deduction → itemized only

// The complete argument object for computeIncomeEngine(...), so callers don't
// have to re-assemble it (and can't drift from what this fixture intends).
// Not `as const` — computeIncomeEngine takes mutable arrays.
export const engineArgs = {
  taxYear: TAX_YEAR,
  profile,
  residency,
  w2s,
  f1042s,
  f1099ints,
  f1099divs,
  f1099bs,
  f1099das: [] as F1099DAData[],
  charitableContributions,
};
