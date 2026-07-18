// Key-level provenance for every Form 1040-NR line that lib/rules/forms/f1040nr.ts
// fills. This is the ONE piece the engine doesn't already expose: the engine
// flattens each computed number to a plain string and loses the "where did this
// come from" trail (which W-2/1099 box, which interview question, which treaty
// article, which upstream line). This map restores it, keyed by the exact same
// semantic line keys computeF1040NR emits ("1040nr.1a", "1040nr.24", …).
//
// LIVING GUARANTEE: the *numbers* shown in the viz always come from running the
// real engine (they can't drift). This *annotation* layer is authored by hand,
// so tests/golden/provenance1040nr.test.ts asserts these keys stay in lock-step
// with the engine's produced line set — add/remove a line in the engine without
// updating this map and the build fails.
//
// codeRef points at the file+lines that actually compute the number, so an
// auditor can jump straight from a form field to the logic behind it.

export type SourceRef =
  // A box on an uploaded tax document.
  | { kind: "document"; doc: "W-2" | "1099-DIV" | "1099-B" | "1099-INT" | "1042-S" | "I-94" | "passport" | "manual"; box?: string; note?: string }
  // An answer the filer gives in the interview.
  | { kind: "interview"; question: string; field: string }
  // A US income-tax-treaty article that changes the number.
  | { kind: "treaty"; article: string; citation?: string; note: string }
  // A statutory / tax-year config input (brackets, IRS Tax Table, flat NEC rate, day thresholds).
  | { kind: "config"; note: string }
  // Another 1040-NR line this one is derived from — makes the panel walkable upstream.
  | { kind: "line"; line: string; note?: string };

export interface LineProvenance {
  line: string; // printed line number, e.g. "1a", "25b", "37"
  label: string; // human label, matches the form's printed line label
  formula: string; // plain-English formula
  engineFields: string[]; // IncomeEngineResult fields that back this line
  sources: SourceRef[];
  codeRef: string; // file:lines where the number is computed
  section: "filer" | "income" | "tax" | "payments" | "result";
}

const ID_WAGE_TREATY: SourceRef = {
  kind: "treaty",
  article: "US–Indonesia Art 19(1)(b)(iii)",
  citation: "US-Indonesia Art 19(1)(b)(iii)",
  note: "First $2,000/yr of a student's US wages is exempt.",
};
const ID_SCHOLARSHIP_TREATY: SourceRef = {
  kind: "treaty",
  article: "US–Indonesia Art 19(1)(b)(ii)",
  citation: "Pub 901 (9-2024); US-Indonesia Art 19(1)(b)(ii)",
  note: "Scholarship/grant income fully exempt (unlimited). $0 here — this filer has no 1042-S.",
};
const ID_DIVIDEND_TREATY: SourceRef = {
  kind: "treaty",
  article: "US–Indonesia Art 11(2)",
  citation: "Tax Treaty Table 1 (5-2023); US-Indonesia Art 11(2)",
  note: "Dividends taxed at a reduced flat 15% on Schedule NEC (vs. the 30% default).",
};

export const PROVENANCE_1040NR: Record<string, LineProvenance> = {
  // ---------------- Filer identity (page 1 header) ----------------
  "1040nr.firstName": {
    line: "—", label: "First name and middle initial", section: "filer",
    formula: "First name (+ middle initials) split out of the filer's full legal name.",
    engineFields: [],
    sources: [{ kind: "document", doc: "I-94", note: "Legal name, confirmed at onboarding." }],
    codeRef: "lib/rules/forms/f1040nr.ts:17,22 (splitLegalName)",
  },
  "1040nr.lastName": {
    line: "—", label: "Last name", section: "filer",
    formula: "Last token of the filer's full legal name.",
    engineFields: [],
    sources: [{ kind: "document", doc: "I-94", note: "Legal name, confirmed at onboarding." }],
    codeRef: "lib/rules/forms/f1040nr.ts:17,23 (splitLegalName)",
  },
  "1040nr.tin": {
    line: "—", label: "Identifying number (SSN/ITIN)", section: "filer",
    formula: "SSN/ITIN with dashes stripped (the PDF field is a 9-digit comb).",
    engineFields: [],
    sources: [{ kind: "document", doc: "manual", note: "Entered by the filer; formatSsnDigits removes dashes." }],
    codeRef: "lib/rules/forms/f1040nr.ts:24 (formatSsnDigits)",
  },
  "1040nr.usAddress.line1": {
    line: "—", label: "Home address (number and street)", section: "filer",
    formula: "US mailing address, line 1.",
    engineFields: [],
    sources: [{ kind: "document", doc: "manual", note: "Entered by the filer at onboarding." }],
    codeRef: "lib/rules/forms/f1040nr.ts:25",
  },
  "1040nr.usAddress.aptNo": {
    line: "—", label: "Apt. no.", section: "filer",
    formula: "US mailing address, line 2 (apt/unit).",
    engineFields: [],
    sources: [{ kind: "document", doc: "manual" }],
    codeRef: "lib/rules/forms/f1040nr.ts:26",
  },
  "1040nr.usAddress.city": {
    line: "—", label: "City, town or post office", section: "filer",
    formula: "US mailing address city.",
    engineFields: [],
    sources: [{ kind: "document", doc: "manual" }],
    codeRef: "lib/rules/forms/f1040nr.ts:27",
  },
  "1040nr.usAddress.state": {
    line: "—", label: "State", section: "filer",
    formula: "US mailing address state.",
    engineFields: [],
    sources: [{ kind: "document", doc: "manual" }],
    codeRef: "lib/rules/forms/f1040nr.ts:28",
  },
  "1040nr.usAddress.zip": {
    line: "—", label: "ZIP code", section: "filer",
    formula: "US mailing address postal code.",
    engineFields: [],
    sources: [{ kind: "document", doc: "manual" }],
    codeRef: "lib/rules/forms/f1040nr.ts:29",
  },
  "1040nr.filingStatus.single": {
    line: "—", label: "Filing status: Single", section: "filer",
    formula: "Checked when filingStatus ≠ married_nra.",
    engineFields: [],
    sources: [{ kind: "interview", question: "Are you married to a nonresident alien?", field: "profile.filingStatus" }],
    codeRef: "lib/rules/forms/f1040nr.ts:30",
  },
  "1040nr.filingStatus.mfs": {
    line: "—", label: "Filing status: Married filing separately", section: "filer",
    formula: "Checked when filingStatus = married_nra.",
    engineFields: [],
    sources: [{ kind: "interview", question: "Are you married to a nonresident alien?", field: "profile.filingStatus" }],
    codeRef: "lib/rules/forms/f1040nr.ts:31",
  },
  "1040nr.digitalAssets": {
    line: "—", label: "Digital assets Yes/No", section: "filer",
    formula: "Yes when the filer reported receiving/selling/exchanging crypto.",
    engineFields: [],
    sources: [{ kind: "interview", question: "Did you receive, sell, or exchange any digital assets (crypto)?", field: "profile.digitalAssets" }],
    codeRef: "lib/rules/forms/f1040nr.ts:32",
  },
  "1040nr.occupation": {
    line: "—", label: "Your occupation (Sign Here, page 2)", section: "filer",
    formula: 'Hardcoded "Student" — every filer in this app\'s scope is an F-1 student.',
    engineFields: [],
    sources: [{ kind: "config", note: "Fixed to \"Student\" for this app's F-1 scope." }],
    codeRef: "lib/rules/forms/f1040nr.ts:33",
  },

  // ---------------- Income effectively connected (page 1) ----------------
  "1040nr.1a": {
    line: "1a", label: "Wages (Form(s) W-2, box 1)", section: "income",
    formula: "line 1a = Σ W-2 box 1 (all employers) − treaty-exempt wages.",
    engineFields: ["wagesGross", "wagesTreatyExempt", "wagesTaxable"],
    sources: [
      { kind: "document", doc: "W-2", box: "Box 1", note: "Wages, tips, other compensation — summed across all W-2s." },
      ID_WAGE_TREATY,
      { kind: "line", line: "1040nr.1k", note: "The exempted portion goes on line 1k, not here." },
    ],
    codeRef: "lib/rules/income.ts:110-114",
  },
  "1040nr.1z": {
    line: "1z", label: "Add lines 1a–1h", section: "income",
    formula: "line 1z = line 1a (lines 1b–1h never apply in this app's income scope, so 1z = 1a).",
    engineFields: ["wagesTaxable"],
    sources: [{ kind: "line", line: "1040nr.1a" }],
    codeRef: "lib/rules/forms/f1040nr.ts:35",
  },
  "1040nr.1k": {
    line: "1k", label: "Total income exempt by treaty (Schedule OI, item L)", section: "income",
    formula: "line 1k = treaty-exempt wages + treaty-exempt scholarship (must equal Schedule OI item L total).",
    engineFields: ["wagesTreatyExempt", "scholarshipTreatyExempt", "totalTreatyExemptIncome"],
    sources: [
      ID_WAGE_TREATY,
      ID_SCHOLARSHIP_TREATY,
      { kind: "document", doc: "W-2", box: "Box 1", note: "The wages the exemption is applied against." },
    ],
    codeRef: "lib/rules/income.ts:282; forms/f1040nr.ts:36",
  },
  "1040nr.8": {
    line: "8", label: "Additional income — taxable scholarship (Schedule 1, 8r equiv.)", section: "income",
    formula: "line 8 = 1042-S code-16 gross income − treaty-exempt scholarship. $0 here: no 1042-S.",
    engineFields: ["scholarship1042SReported", "scholarshipTreatyExempt", "scholarshipTaxable"],
    sources: [
      { kind: "document", doc: "1042-S", box: "Box 2 (income code 16)", note: "Taxable scholarship reported by the school. None for this filer." },
      ID_SCHOLARSHIP_TREATY,
    ],
    codeRef: "lib/rules/income.ts:137-148",
  },
  "1040nr.9": {
    line: "9", label: "Total effectively connected income", section: "income",
    formula: "line 9 = taxable wages (1z) + taxable scholarship (8).",
    engineFields: ["effectivelyConnectedIncome"],
    sources: [
      { kind: "line", line: "1040nr.1z" },
      { kind: "line", line: "1040nr.8" },
    ],
    codeRef: "lib/rules/income.ts:259",
  },
  "1040nr.11a": {
    line: "11a", label: "Adjusted gross income", section: "income",
    formula: "line 11a = line 9 (this app models no line-10 adjustments).",
    engineFields: ["effectivelyConnectedIncome"],
    sources: [{ kind: "line", line: "1040nr.9" }],
    codeRef: "lib/rules/forms/f1040nr.ts:44",
  },

  // ---------------- Tax and credits (page 2) ----------------
  "1040nr.11b": {
    line: "11b", label: "AGI carried to page 2", section: "tax",
    formula: "line 11b = line 11a.",
    engineFields: ["effectivelyConnectedIncome"],
    sources: [{ kind: "line", line: "1040nr.11a" }],
    codeRef: "lib/rules/forms/f1040nr.ts:45",
  },
  "1040nr.12": {
    line: "12", label: "Itemized deductions (Schedule A) or India standard deduction", section: "tax",
    formula: "line 12 = charitable contributions (itemized). Indonesia grants no standard deduction; only India uses max(charitable, $15,000).",
    engineFields: ["charitableContributions", "usesStandardDeduction", "deduction"],
    sources: [
      { kind: "interview", question: "How much did you give to charity this year?", field: "charitableContributions" },
      { kind: "treaty", article: "US–India Art 21(2)", note: "Standard deduction is India-only; Indonesia never qualifies." },
      { kind: "config", note: "2025 standard deduction amount (used only when the treaty allows it)." },
    ],
    codeRef: "lib/rules/income.ts:240-244",
  },
  "1040nr.15": {
    line: "15", label: "Taxable income", section: "tax",
    formula: "line 15 = max(0, line 11b − line 12).",
    engineFields: ["taxableIncome"],
    sources: [
      { kind: "line", line: "1040nr.11b" },
      { kind: "line", line: "1040nr.12" },
    ],
    codeRef: "lib/rules/income.ts:260",
  },
  "1040nr.16": {
    line: "16", label: "Tax", section: "tax",
    formula: "line 16 = IRS Tax Table (taxable income < $100k) / Tax Computation Worksheet (≥ $100k) on line 15. Single brackets; married-NRA uses MFS.",
    engineFields: ["effectivelyConnectedTax"],
    sources: [
      { kind: "line", line: "1040nr.15" },
      { kind: "config", note: "2025 single/MFS brackets + IRS Tax Table (row-midpoint, rounded to the dollar)." },
    ],
    codeRef: "lib/rules/income.ts:262,376-380",
  },
  "1040nr.18": {
    line: "18", label: "Add lines 16 and 17", section: "tax",
    formula: "line 18 = line 16 (this app models no line-17 additional taxes).",
    engineFields: ["effectivelyConnectedTax"],
    sources: [{ kind: "line", line: "1040nr.16" }],
    codeRef: "lib/rules/forms/f1040nr.ts:49",
  },
  "1040nr.22": {
    line: "22", label: "Tax after credits", section: "tax",
    formula: "line 22 = line 16 (no credits on lines 19–21 modeled).",
    engineFields: ["effectivelyConnectedTax"],
    sources: [{ kind: "line", line: "1040nr.16" }],
    codeRef: "lib/rules/forms/f1040nr.ts:50",
  },
  "1040nr.23a": {
    line: "23a", label: "Tax on income not effectively connected (Schedule NEC)", section: "tax",
    formula: "line 23a = dividends tax + capital-gains tax, both from Schedule NEC.",
    engineFields: ["dividendsTax", "capitalGainsTax", "necTax"],
    sources: [
      { kind: "document", doc: "1099-DIV", box: "Box 1a", note: "Ordinary dividends taxed at the treaty NEC rate." },
      ID_DIVIDEND_TREATY,
      { kind: "document", doc: "1099-B", box: "Box 1d − 1e", note: "Proceeds − cost basis = realized gain." },
      { kind: "config", note: "IRC §871(a)(2): capital gains taxable only if present ≥183 days; flat 30% NEC rate." },
    ],
    codeRef: "lib/rules/income.ts:189-221,263",
  },
  "1040nr.23d": {
    line: "23d", label: "Total Schedule NEC tax", section: "tax",
    formula: "line 23d = line 23a (only line 23a is populated in this app's scope).",
    engineFields: ["necTax"],
    sources: [{ kind: "line", line: "1040nr.23a" }],
    codeRef: "lib/rules/forms/f1040nr.ts:52",
  },
  "1040nr.24": {
    line: "24", label: "Total tax", section: "tax",
    formula: "line 24 = line 22 + line 23a.",
    engineFields: ["totalTax"],
    sources: [
      { kind: "line", line: "1040nr.22" },
      { kind: "line", line: "1040nr.23a" },
    ],
    codeRef: "lib/rules/income.ts:264",
  },

  // ---------------- Payments (page 2) ----------------
  "1040nr.25a": {
    line: "25a", label: "Withheld from Form(s) W-2", section: "payments",
    formula: "line 25a = Σ W-2 box 2 (federal income tax withheld).",
    engineFields: ["wagesWithheld"],
    sources: [{ kind: "document", doc: "W-2", box: "Box 2", note: "Federal income tax withheld, summed across W-2s." }],
    codeRef: "lib/rules/income.ts:111",
  },
  "1040nr.25b": {
    line: "25b", label: "Withheld from Form(s) 1099", section: "payments",
    formula: "line 25b = interest withheld (1099-INT box 4) + dividends withheld (1099-DIV box 4) + capital-gains withheld (1099-B box 4).",
    engineFields: ["interestWithheld", "dividendsWithheld", "capitalGainsWithheld"],
    sources: [
      { kind: "document", doc: "1099-INT", box: "Box 4", note: "Withheld even though the interest itself is exempt." },
      { kind: "document", doc: "1099-DIV", box: "Box 4" },
      { kind: "document", doc: "1099-B", box: "Box 4" },
    ],
    codeRef: "lib/rules/forms/f1040nr.ts:19,55",
  },
  "1040nr.25d": {
    line: "25d", label: "Total withholding (25a + 25b + 25c)", section: "payments",
    formula: "line 25d = line 25a + line 25b.",
    engineFields: ["wagesWithheld", "interestWithheld", "dividendsWithheld", "capitalGainsWithheld"],
    sources: [
      { kind: "line", line: "1040nr.25a" },
      { kind: "line", line: "1040nr.25b" },
    ],
    codeRef: "lib/rules/forms/f1040nr.ts:56",
  },
  "1040nr.25g": {
    line: "25g", label: "Withheld from Form(s) 1042-S", section: "payments",
    formula: "line 25g = Σ 1042-S box 7a (code-16 rows). $0 here: no 1042-S.",
    engineFields: ["scholarship1042SWithheld"],
    sources: [{ kind: "document", doc: "1042-S", box: "Box 7a", note: "Scholarship withholding. None for this filer." }],
    codeRef: "lib/rules/income.ts:139",
  },
  "1040nr.33": {
    line: "33", label: "Total payments", section: "payments",
    formula: "line 33 = wages withheld + non-wage 1099 withholding + 1042-S withholding.",
    engineFields: ["totalWithholding"],
    sources: [
      { kind: "line", line: "1040nr.25d" },
      { kind: "line", line: "1040nr.25g" },
    ],
    codeRef: "lib/rules/income.ts:265-267",
  },

  // ---------------- Result: refund or amount owed (mutually exclusive) ----------------
  "1040nr.34": {
    line: "34", label: "Overpayment (refund)", section: "result",
    formula: "line 34 = line 33 − line 24, when line 33 ≥ line 24 (otherwise blank; see line 37).",
    engineFields: ["refundOrDue"],
    sources: [
      { kind: "line", line: "1040nr.33" },
      { kind: "line", line: "1040nr.24" },
    ],
    codeRef: "lib/rules/income.ts:268; forms/f1040nr.ts:61-66",
  },
  "1040nr.35a": {
    line: "35a", label: "Amount refunded to you", section: "result",
    formula: "line 35a = line 34 (full overpayment refunded; no amount applied to next year).",
    engineFields: ["refundOrDue"],
    sources: [{ kind: "line", line: "1040nr.34" }],
    codeRef: "lib/rules/forms/f1040nr.ts:66",
  },
  "1040nr.37": {
    line: "37", label: "Amount you owe", section: "result",
    formula: "line 37 = line 24 − line 33, when line 24 > line 33 (otherwise blank; see lines 34/35a).",
    engineFields: ["refundOrDue"],
    sources: [
      { kind: "line", line: "1040nr.24" },
      { kind: "line", line: "1040nr.33" },
    ],
    codeRef: "lib/rules/income.ts:268; forms/f1040nr.ts:68",
  },
};

// The refund-vs-owe lines are mutually exclusive: for any given filer the
// engine emits EITHER {34, 35a} OR {37}, never all three. The drift-guard test
// exempts these from the "every provenance key must be produced" direction.
export const CONDITIONAL_RESULT_KEYS = ["1040nr.34", "1040nr.35a", "1040nr.37"] as const;
