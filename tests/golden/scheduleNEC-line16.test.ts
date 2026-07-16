import { describe, it, expect } from "vitest";
import { PDFDocument } from "pdf-lib";
import { computeIncomeEngine } from "@/lib/rules/income";
import { computeScheduleNEC } from "@/lib/rules/forms/scheduleNEC";
import { withRealizedGainLoss } from "@/lib/rules/capitalGains";
import { generateCapitalGainsAttachment } from "@/lib/pdf/generateCapitalGainsAttachment";
import { generateReturnForms, mergeReturnForms } from "@/lib/server/generateReturnForms";
import type { EligibilityInput, F1099BData, FilerProfile, ResidencyResult } from "@/lib/types";

// This suite guards the exact defect behind the Glacier comparison: the form's
// line 16 table holds only the first 5 lots, but lines 9/17/18 must total EVERY
// lot, and the remainder must spill onto the continuation attachment. An eight-
// lot filer (mix of gains and losses) exercises all three.
const profile: Partial<FilerProfile> = {
  legalName: { value: "Budi Hartono Santoso", confidence: 1, confirmed: true, source: "unknown" },
  citizenship: { value: "Indonesia", confidence: 1, confirmed: true, source: "unknown" },
  passportNumber: { value: "A1234567", confidence: 1, confirmed: true, source: "unknown" },
  dob: { value: "2000-01-01", confidence: 1, confirmed: true, source: "unknown" },
  ssnOrItin: "123-45-6789",
  filingStatus: "single",
  digitalAssets: false,
  usAddress: { line1: "123 Main St", city: "Seattle", state: "WA", postalCode: "98105", country: "United States" },
  foreignAddress: { line1: "Jl. Sudirman 1", postalCode: "10110", country: "Indonesia" },
  priorReturn: { filed: false },
  school: {
    name: "University of Washington",
    address: "1400 NE Campus Parkway, Seattle, WA 98195",
    phone: "206-543-2100",
    dsoName: "Amber Pilgreen",
    dsoAddress: "459 Schmitz Hall, Seattle, WA 98195",
    dsoPhone: "206-221-7857",
  },
  sevisId: "N0012345678",
};

const residency: ResidencyResult = {
  exemptYearsUsed: 3,
  isNonresident: true,
  firstEntryDate: "2023-08-15",
  daysPresent: { taxYear: 300, prior1: 365, prior2: 138 }, // >= 183 so capital gains are taxable
  daysExcluded: 300,
  entryExitTaxYear: [{ entered: "2025-01-01", departed: null }],
  visaHistory: { 2023: "F-1", 2024: "F-1", 2025: "F-1" },
  reasoning: "test fixture",
};

const eligibilityInput: EligibilityInput = {
  taxYear: 2025,
  currentSupportedTaxYear: 2025,
  visaClass: "F-1",
  firstEntryDate: "2023-08-15",
  travelHistory: [],
  hadEarlierFJMQVisa: false,
  hasGreenCard: false,
  appliedForGreenCard: false,
  changedVisaType: false,
  incomeOnlyInWashington: true,
};

// 8 lots: net = 1000-100+200-200+50+300-150+500 = 1600 (positive -> taxable).
const lots: [string, number, number][] = [
  ["Alpha", 2000, 1000], // +1000  (row 0)
  ["Bravo", 500, 600], //   -100   (row 1)
  ["Charlie", 300, 100], // +200   (row 2)
  ["Delta", 1000, 1200], // -200   (row 3)
  ["Echo", 800, 750], //    +50    (row 4)  <- last built-in row
  ["Foxtrot", 400, 100], // +300   (overflow)
  ["Golf", 100, 250], //    -150   (overflow)
  ["Hotel", 900, 400], //   +500   (overflow)
];

const f1099bs: F1099BData[] = [
  {
    payerName: "Broker",
    transactions: lots.map(([description, proceeds, costBasis]) => ({
      description,
      dateAcquired: "2024-01-01",
      dateSold: "2025-06-01",
      proceeds,
      costBasis,
      washSaleLossDisallowed: 0,
      realizedGainLoss: proceeds - costBasis,
      isShortTerm: true,
      box4FederalTaxWithheld: 0,
    })),
  },
];

const income = computeIncomeEngine({
  taxYear: 2025,
  profile,
  residency,
  w2s: [],
  f1042s: [],
  f1099ints: [],
  f1099divs: [],
  f1099bs,
  f1099das: [],
  charitableContributions: 0,
});

describe("computeScheduleNEC line 16 / 17 / 18", () => {
  const lines = computeScheduleNEC({ profile, income });

  it("nets EVERY lot into the taxable total, not just the 5 that fit on line 16", () => {
    expect(income.capitalGainsTransactions).toHaveLength(8);
    expect(income.capitalGainsNet).toBe(1600);
    expect(lines["schedNEC.9.c"]).toBe("1,600.00");
    expect(lines["schedNEC.17"]).toBe("1,600.00");
    expect(lines["schedNEC.18"]).toBe("1,600.00");
  });

  it("prints exactly the first 5 lots on line 16, with the right gain/loss column each", () => {
    expect(lines["schedNEC.16.kind.0"]).toBe("Alpha");
    expect(lines["schedNEC.16.gain.0"]).toBe("1,000.00");
    expect(lines["schedNEC.16.loss.0"]).toBeUndefined();

    expect(lines["schedNEC.16.kind.1"]).toBe("Bravo");
    expect(lines["schedNEC.16.loss.1"]).toBe("100.00");
    expect(lines["schedNEC.16.gain.1"]).toBeUndefined();

    expect(lines["schedNEC.16.gain.2"]).toBe("200.00");
    expect(lines["schedNEC.16.loss.3"]).toBe("200.00");
    expect(lines["schedNEC.16.gain.4"]).toBe("50.00");
  });

  it("does NOT print a 6th lot on the form (that lot belongs on the attachment)", () => {
    expect(lines["schedNEC.16.kind.5"]).toBeUndefined();
    expect(lines["schedNEC.16.gain.5"]).toBeUndefined();
  });
});

describe("Schedule NEC line 16 overflow attachment", () => {
  it("carries exactly the lots beyond the first 5", () => {
    const overflow = income.capitalGainsTransactions.slice(5);
    expect(overflow.map((tx) => tx.description)).toEqual(["Foxtrot", "Golf", "Hotel"]);
    expect(overflow.map((tx) => tx.realizedGainLoss)).toEqual([300, -150, 500]);
  });

  it("renders the overflow lots to a PDF without throwing", async () => {
    const overflow = income.capitalGainsTransactions.slice(5);
    const bytes = await generateCapitalGainsAttachment({
      name: "Budi Hartono Santoso",
      tin: "123456789",
      transactions: overflow,
    });
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBe(1);
  });
});

describe("return packet assembly", () => {
  it("includes the Schedule NEC attachment last (bottom of packet), only when there's overflow", async () => {
    const forms = await generateReturnForms({ profile, residency, eligibilityInput, income });
    expect(forms.map((f) => f.id)).toEqual(["1040nr", "schedNEC", "schedOI", "f8843", "schedNEC-attachment"]);
  });

  it("merges every form's pages into one PDF, preserving each form's page count", async () => {
    const forms = await generateReturnForms({ profile, residency, eligibilityInput, income });
    let expectedPages = 0;
    for (const form of forms) {
      expectedPages += (await PDFDocument.load(form.bytes)).getPageCount();
    }
    const merged = await mergeReturnForms(forms);
    expect((await PDFDocument.load(merged)).getPageCount()).toBe(expectedPages);
  });
});

// End-to-end proof of the wash-sale fix through the real chain a fresh
// extraction takes: raw extracted lots (washSaleLossDisallowed populated,
// realizedGainLoss unset) -> withRealizedGainLoss (persist step) ->
// computeIncomeEngine -> computeScheduleNEC. Uses a case where the wash-sale
// add-back flips a net LOSS into a taxable GAIN, so a regression can't pass by
// accident.
describe("Schedule NEC reflects wash-sale loss disallowed after a fresh extraction", () => {
  // Lot A: proceeds 700 - cost 1000 = -300 raw, but 500 is a disallowed wash
  // sale -> allowed +200. Lot B: +200. Raw net would be -100 (a loss, NOT
  // taxable); wash-adjusted net is +400 (taxable).
  const rawDocs: F1099BData[] = [
    {
      payerName: "Robinhood",
      transactions: [
        { description: "Micron", dateAcquired: "2025-01-01", dateSold: "2025-06-01", proceeds: 700, costBasis: 1000, washSaleLossDisallowed: 500, realizedGainLoss: 0, isShortTerm: true, box4FederalTaxWithheld: 0 },
        { description: "Apple", dateAcquired: "2025-01-01", dateSold: "2025-06-01", proceeds: 500, costBasis: 300, washSaleLossDisallowed: 0, realizedGainLoss: 0, isShortTerm: true, box4FederalTaxWithheld: 0 },
      ],
    },
  ];

  const persisted = withRealizedGainLoss(rawDocs); // what the income route writes to the DB

  it("without the add-back this would be a non-taxable net loss", () => {
    const rawNet = rawDocs.flatMap((d) => d.transactions).reduce((s, t) => s + (t.proceeds - t.costBasis), 0);
    expect(rawNet).toBe(-100); // a loss -> line 9 would be blank / -0-
  });

  it("with the add-back the Schedule NEC shows a taxable +400 gain", () => {
    const washIncome = computeIncomeEngine({
      taxYear: 2025,
      profile,
      residency,
      w2s: [],
      f1042s: [],
      f1099ints: [],
      f1099divs: [],
      f1099bs: persisted,
      f1099das: [],
      charitableContributions: 0,
    });
    expect(washIncome.capitalGainsNet).toBe(400);
    expect(washIncome.capitalGainsTaxable).toBe(true);

    const lines = computeScheduleNEC({ profile, income: washIncome });
    expect(lines["schedNEC.9.c"]).toBe("400.00");
    expect(lines["schedNEC.18"]).toBe("400.00");
  });
});
