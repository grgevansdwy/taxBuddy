import { describe, it, expect } from "vitest";
import fs from "fs/promises";
import path from "path";
import { PDFDocument, type PDFForm } from "pdf-lib";
import { computeIncomeEngine } from "@/lib/rules/income";
import { computeF1040NR } from "@/lib/rules/forms/f1040nr";
import { computeScheduleOI } from "@/lib/rules/forms/scheduleOI";
import { computeForm8843 } from "@/lib/rules/forms/f8843";
import { computeScheduleNEC } from "@/lib/rules/forms/scheduleNEC";
import { computeScheduleA } from "@/lib/rules/forms/scheduleA";
import { computeF8833 } from "@/lib/rules/forms/f8833";
import { F1040NR_FIELD_MAP } from "@/lib/pdf/fieldMaps/f1040nr";
import { SCHEDULE_OI_FIELD_MAP } from "@/lib/pdf/fieldMaps/scheduleOI";
import { F8843_FIELD_MAP } from "@/lib/pdf/fieldMaps/f8843";
import { SCHEDULE_NEC_FIELD_MAP } from "@/lib/pdf/fieldMaps/scheduleNEC";
import { SCHEDULE_A_FIELD_MAP } from "@/lib/pdf/fieldMaps/scheduleA";
import { F8833_FIELD_MAP } from "@/lib/pdf/fieldMaps/f8833";
import { fillPdfForm } from "@/lib/pdf/fillForm";
import type { PdfFieldEntry } from "@/lib/pdf/types";
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

// Synthetic Indonesian F-1 filer exercising every income type at once:
// wages above the treaty's $2,000 cap, scholarship fully treaty-exempt,
// dividends at Indonesia's 15% NEC rate, a taxable capital gain (183+ days
// present), and exempt bank interest. Numbers are chosen so every line is
// non-zero and distinguishable from every other, to catch fields silently
// swapped or dropped.
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

const w2s: W2Data[] = [
  {
    employerName: "UW Library",
    employerEin: "91-1234567",
    employerAddress: "Seattle, WA",
    box1: 3500, // $2,000 treaty-exempt, $1,500 taxable
    box2: 200,
    box3: 3500,
    box4: 217,
    box5: 3500,
    box6: 50.75,
    box15State: null,
    box17StateTaxWithheld: null,
  },
];

const f1042s: F1042SData[] = [
  {
    incomeCode: "16",
    grossIncome: 12000, // unlimited Indonesia scholarship exemption -> fully exempt
    exemptionCode: null, // NOT substantiated -> should force needsForm8833
    exemptionRate: null,
    taxWithheld: 0,
    countryCode: "ID",
    withholdingCredit: 0,
  },
];

const f1099ints: F1099INTData[] = [
  { payerName: "Bank", payerEin: "1", box1InterestIncome: 50, box4FederalTaxWithheld: 0, box8TaxExemptInterest: 0 },
];

const f1099divs: F1099DIVData[] = [
  { payerName: "Broker", payerEin: "2", box1aTotalOrdinaryDividends: 500, box1bQualifiedDividends: 0, box4FederalTaxWithheld: 75 },
];

const f1099bs: F1099BData[] = [
  {
    payerName: "Broker",
    transactions: [
      {
        description: "100 sh AAPL",
        dateAcquired: "2024-01-01",
        dateSold: "2025-06-01",
        proceeds: 2000,
        costBasis: 1000,
        washSaleLossDisallowed: 0,
        realizedGainLoss: 1000,
        isShortTerm: true,
        box4FederalTaxWithheld: 0,
      },
    ],
  },
];

const income = computeIncomeEngine({
  taxYear: 2025,
  profile,
  residency,
  w2s,
  f1042s,
  f1099ints,
  f1099divs,
  f1099bs,
  f1099das: [],
  charitableContributions: 500,
});

async function fillAndReadBack(templateName: string, fieldMap: Record<string, PdfFieldEntry>, computedLines: Record<string, string>) {
  const templateBytes = await fs.readFile(path.join(process.cwd(), "lib/pdf/templates", templateName));
  const filledBytes = await fillPdfForm(templateBytes, fieldMap, computedLines, { flatten: false });
  const filledDoc = await PDFDocument.load(filledBytes);
  const filledForm = filledDoc.getForm();

  const unmapped = Object.keys(computedLines).filter((key) => !fieldMap[key]);
  const actual: Record<string, string> = {};
  for (const [key, entry] of Object.entries(fieldMap)) {
    actual[key] = readActualValue(filledForm, entry);
  }
  return { unmapped, actual };
}

function readActualValue(form: PDFForm, entry: PdfFieldEntry): string {
  if (entry.type === "text") return form.getTextField(entry.field).getText() ?? "";
  if (entry.type === "checkboxSingle") return form.getCheckBox(entry.field).isChecked() ? "yes" : "";
  if (form.getCheckBox(entry.yesField).isChecked()) return "yes";
  if (form.getCheckBox(entry.noField).isChecked()) return "no";
  return "";
}

// checkboxSingle only ever *checks* a box for "yes" (fillForm.ts); "no" means
// "leave unchecked", which reads back as "" — same real-world state, so treat
// them as equal for that field type only. Every other field type compares exactly.
function assertLinesMatchPdf(
  computed: Record<string, string>,
  actual: Record<string, string>,
  fieldMap: Record<string, PdfFieldEntry>
) {
  for (const [key, expected] of Object.entries(computed)) {
    const entry = fieldMap[key];
    if (entry?.type === "checkboxSingle") {
      expect(actual[key] === "yes", `field ${key}`).toBe(expected === "yes");
    } else {
      expect(actual[key], `field ${key}`).toBe(expected);
    }
  }
}

describe("computeIncomeEngine (wages + scholarship + dividends + capital gains)", () => {
  it("computes expected wage figures", () => {
    expect(income.wagesGross).toBe(3500);
    expect(income.wagesTreatyExempt).toBe(2000);
    expect(income.wagesTaxable).toBe(1500);
    expect(income.wagesWithheld).toBe(200);
  });

  it("computes expected scholarship figures (unlimited Indonesia exemption)", () => {
    expect(income.scholarship1042SReported).toBe(12000);
    expect(income.scholarshipTreatyExempt).toBe(12000);
    expect(income.scholarshipTaxable).toBe(0);
  });

  it("computes expected dividend/capital-gains/interest figures", () => {
    expect(income.dividendsGross).toBe(500);
    expect(income.dividendsTreatyRate).toBe(0.15);
    expect(income.dividendsTax).toBe(75);
    expect(income.capitalGainsTaxable).toBe(true);
    expect(income.capitalGainsTax).toBe(300);
    expect(income.interestExempt).toBe(50);
  });

  it("aggregates totals correctly", () => {
    expect(income.effectivelyConnectedIncome).toBe(1500); // wagesTaxable + scholarshipTaxable(0)
    expect(income.taxableIncome).toBe(1000); // 1500 - 500 itemized deduction
    // Tax Table lookup, not a flat 1000 * 10%: taxable income $1,000 falls in
    // the $1,000-$1,025 row, taxed on its $1,012.50 midpoint (IRS mandates
    // the table, not the continuous formula, below $100,000 taxable income).
    expect(income.effectivelyConnectedTax).toBe(101); // 1012.50 * 10% = 101.25 -> rounds to 101
    expect(income.necTax).toBe(375); // 75 + 300
    expect(income.totalTax).toBe(476);
    expect(income.totalWithholding).toBe(275); // 200 wages + 75 dividends
    expect(income.refundOrDue).toBe(-201); // owes $201
    expect(income.totalTreatyExemptIncome).toBe(14000); // 2000 wages + 12000 scholarship
    expect(income.hasReportableIncome).toBe(true);
  });

  it("requires Form 8833 (unsubstantiated scholarship exemption), but not for the wage exemption", () => {
    expect(income.scholarshipExemptSubstantiatedBy1042S).toBe(false);
    expect(income.needsForm8833).toBe(true);
  });
});

describe("computeF1040NR", () => {
  const lines = computeF1040NR({ profile, income });

  it("wages: line 1a equals line 1z (only line 1a is ever populated in this app's scope)", () => {
    expect(lines["1040nr.1a"]).toBe("1,500.00");
    expect(lines["1040nr.1z"]).toBe(lines["1040nr.1a"]);
  });

  it("line 1k (treaty-exempt income) matches the engine's combined total", () => {
    expect(lines["1040nr.1k"]).toBe("14,000.00");
  });

  it("line 8 (scholarship) prints 0.00, not blank, since it's a genuine computed conclusion", () => {
    expect(lines["1040nr.8"]).toBe("0.00");
  });

  it("line 9 (total ECI) = wages taxable + scholarship taxable", () => {
    expect(lines["1040nr.9"]).toBe("1,500.00");
  });

  it("withholding lines 25a/25b/25d add up correctly", () => {
    expect(lines["1040nr.25a"]).toBe("200.00"); // wages withheld
    expect(lines["1040nr.25b"]).toBe("75.00"); // dividends withheld (interest/cap-gains withheld are 0 here)
    expect(lines["1040nr.25d"]).toBe("275.00"); // 25a + 25b
    expect(lines["1040nr.33"]).toBe("275.00");
  });

  it("balance due (not refund) since totalTax > totalWithholding", () => {
    expect(lines["1040nr.37"]).toBe("201.00");
    expect(lines["1040nr.34"]).toBeUndefined();
    expect(lines["1040nr.35a"]).toBeUndefined();
  });

  it("US address is filled in", () => {
    expect(lines["1040nr.usAddress.line1"]).toBe("123 Main St");
    expect(lines["1040nr.usAddress.city"]).toBe("Seattle");
    expect(lines["1040nr.usAddress.state"]).toBe("WA");
    expect(lines["1040nr.usAddress.zip"]).toBe("98105");
  });

  it("fills the real PDF template with no unmapped keys and matching values", async () => {
    const { unmapped, actual } = await fillAndReadBack("1040nr.pdf", F1040NR_FIELD_MAP, lines);
    expect(unmapped).toEqual([]);
    assertLinesMatchPdf(lines, actual, F1040NR_FIELD_MAP);
  });

  it("TIN field keeps its comb spacing (maxLength) since a 9-digit SSN fits within it", async () => {
    const templateBytes = await fs.readFile(path.join(process.cwd(), "lib/pdf/templates/1040nr.pdf"));
    const filledBytes = await fillPdfForm(templateBytes, F1040NR_FIELD_MAP, lines, { flatten: false });
    const filledDoc = await PDFDocument.load(filledBytes);
    const tinField = filledDoc.getForm().getTextField("topmostSubform[0].Page1[0].f1_16[0]");
    expect(tinField.getMaxLength()).toBeDefined(); // must NOT have been stripped
    expect(tinField.getText()).toBe("123456789"); // formatSsnDigits strips the dashes
  });
});

describe("computeScheduleOI", () => {
  const lines = computeScheduleOI({ profile, residency, eligibilityInput, income });

  it("item E prints the visa class with 'Student' appended", () => {
    expect(lines["schedOI.E"]).toBe("F-1 Student");
  });

  it("item I combines year and form into the single real blank", () => {
    expect(lines["schedOI.I"]).toBe("yes");
    expect(lines["schedOI.I.detail"]).toBe("2024, Form 1040-NR");
  });

  it("item L2/L3 are always answered, independent of L1", () => {
    expect(lines["schedOI.L2"]).toBe("no");
    expect(lines["schedOI.L3"]).toBe("no");
  });

  it("item L1 has one row for scholarship and one for wages, both for Indonesia", () => {
    expect(lines["schedOI.L.country.0"]).toBe("Indonesia");
    expect(lines["schedOI.L.article.0"]).toBe("19(1)(b)(ii)");
    expect(lines["schedOI.L.amount.0"]).toBe("12,000.00");

    expect(lines["schedOI.L.country.1"]).toBe("Indonesia");
    expect(lines["schedOI.L.article.1"]).toBe("19(1)(b)(iii)");
    expect(lines["schedOI.L.amount.1"]).toBe("2,000.00");

    // no third exempt-income type in this app yet
    expect(lines["schedOI.L.country.2"]).toBeUndefined();
  });

  it("item L total matches 1040-NR line 1k exactly", () => {
    const f1040nrLines = computeF1040NR({ profile, income });
    expect(lines["schedOI.L.total"]).toBe(f1040nrLines["1040nr.1k"]);
    expect(lines["schedOI.L.total"]).toBe("14,000.00");
  });

  it("item H shows the 3 years' days-present in the right order (prior2, prior1, taxYear)", () => {
    expect(lines["schedOI.H.2023"]).toBe("138");
    expect(lines["schedOI.H.2024"]).toBe("365");
    expect(lines["schedOI.H.2025"]).toBe("300");
  });

  it("fills the real PDF template with no unmapped keys and matching values", async () => {
    const { unmapped, actual } = await fillAndReadBack("scheduleOI.pdf", SCHEDULE_OI_FIELD_MAP, lines);
    expect(unmapped).toEqual([]);
    assertLinesMatchPdf(lines, actual, SCHEDULE_OI_FIELD_MAP);
  });
});

// Broad smoke test on the other 4 forms too, since fillForm.ts and
// treaties.ts changed this session and are shared by all 6 forms — just
// confirms nothing throws and nothing is silently unmapped.
describe("other forms still fill without error (smoke test)", () => {
  it("f8843", async () => {
    const lines = computeForm8843({ profile, residency, eligibilityInput, onlyForm8843: !income.hasReportableIncome });
    const { unmapped } = await fillAndReadBack("f8843.pdf", F8843_FIELD_MAP, lines);
    expect(unmapped).toEqual([]);
  });

  it("scheduleNEC", async () => {
    const lines = computeScheduleNEC({ profile, income });
    const { unmapped } = await fillAndReadBack("scheduleNEC.pdf", SCHEDULE_NEC_FIELD_MAP, lines);
    expect(unmapped).toEqual([]);
  });

  it("scheduleA", async () => {
    const lines = computeScheduleA({ profile, income });
    const { unmapped } = await fillAndReadBack("scheduleA.pdf", SCHEDULE_A_FIELD_MAP, lines);
    expect(unmapped).toEqual([]);
  });

  it("f8833", async () => {
    const lines = computeF8833({ profile, income });
    const { unmapped } = await fillAndReadBack("f8833.pdf", F8833_FIELD_MAP, lines);
    expect(unmapped).toEqual([]);
  });
});

describe("computeIncomeEngine merges 1099-B and 1099-DA into one capital-gains total", () => {
  const stockGain: F1099BData = {
    payerName: "Broker",
    transactions: [
      {
        description: "10 sh AAPL",
        dateAcquired: "2024-01-01",
        dateSold: "2025-06-01",
        proceeds: 500,
        costBasis: 300,
        washSaleLossDisallowed: 0,
        realizedGainLoss: 200,
        isShortTerm: true,
        box4FederalTaxWithheld: 0,
      },
    ],
  };
  const cryptoLoss: F1099DAData = {
    payerName: "Broker",
    transactions: [
      {
        description: "Bitcoin",
        dateAcquired: "2024-06-01",
        dateSold: "2025-02-01",
        proceeds: 100,
        costBasis: 150,
        washSaleLossDisallowed: 0,
        realizedGainLoss: -50,
        isShortTerm: true,
        box4FederalTaxWithheld: 0,
      },
    ],
  };

  it("combines both into capitalGainsNet, independent of which array a lot came from", () => {
    const income = computeIncomeEngine({
      taxYear: 2025,
      profile,
      residency,
      w2s: [],
      f1042s: [],
      f1099ints: [],
      f1099divs: [],
      f1099bs: [stockGain],
      f1099das: [cryptoLoss],
      charitableContributions: 0,
    });
    expect(income.capitalGainsNet).toBe(150); // 200 - 50
  });

  it("a 1099-DA-only filer (no 1099-B at all) still gets taxed on it", () => {
    const income = computeIncomeEngine({
      taxYear: 2025,
      profile,
      residency,
      w2s: [],
      f1042s: [],
      f1099ints: [],
      f1099divs: [],
      f1099bs: [],
      f1099das: [cryptoLoss],
      charitableContributions: 0,
    });
    expect(income.capitalGainsNet).toBe(-50);
    expect(income.capitalGainsTaxable).toBe(false); // net loss, never taxable regardless of days present
  });
});
