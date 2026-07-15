// -------- types.ts ---------
// Core data model for AI extraction, calculation, and UI.
// Every module — extraction schemas, engine, PDF fill, UI — imports from here.
// ----------------------------

// ------------- Documents -------------
export type DocType =
  | "ead"
  | "i94"
  | "travel_history"
  | "i20"
  | "w2"
  | "f1042s"
  | "f1099int"
  | "f1099b"
  | "f1099div"
  // The upload checklist asks for one combined document (brokers issue a
  // single "Consolidated 1099" covering INT/DIV/B sections) — f1099int/b/div
  // above stay in the union because the extraction routes and F109xData
  // types are still per-section, just no longer separate upload asks.
  | "f1099combined"
  | "unknown";

export interface ExtractedField<T> {
  value: T;
  confidence: number; // 0–1 from extraction
  confirmed: boolean; // true after user's CONFIRM tap
  source: DocType;
}

// ------------- Common -------------
export interface Address {
  line1: string; //-
  line2?: string; //-
  city: string; //-
  state: string;  //-
  postalCode: string; //-
  country: string; //-
}

export interface ForeignAddress {
  line1: string; //-
  state?: string; //-
  postalCode: string;  //-
  country: string;  //-
}

export type FilingStatus = "single" | "married_nra";

export interface SchoolInfo {
  name: string;
  address: string; // institution's mailing address → Form 8843 line 9 (looked up online, not on the I-20)
  phone: string; // institution's general phone → Form 8843 line 9 (looked up online, not on the I-20)
  dsoName: string; // from the I-20
  dsoAddress: string; // international student office address, printed on the I-20 as "school address" → Form 8843 line 10
  dsoPhone: string; // international student office phone → Form 8843 line 10 (looked up online, not on the I-20)
}

// ------------- Filer Profile -------------
export interface FilerProfile {
  // Extracted from I-94 (confirmed)
  legalName: ExtractedField<string>;  //-
  dob: ExtractedField<string>;
  citizenship: ExtractedField<string>;    // → Schedule OI A + B, Form 8843 line 2 + 3a
  passportNumber: ExtractedField<string>; // I-94 "Document Number" → Form 8843 line 3b

  // Manual input
  usAddress: Address;  //-
  foreignAddress: ForeignAddress;  //-
  filingStatus: FilingStatus;  //-
  ssnOrItin: string;  //-
  digitalAssets: boolean;  //-
  priorReturn: { filed: boolean; year?: number; form?: string };

  // Extracted from I-20
  school: SchoolInfo;
  sevisId: string;

  // Only collected at Stage 6 when refundOrDue > 0
  bankRouting?: string; // -
  bankAccount?: string; // -
  bankAccountType?: "checking" | "savings"; // -
}

// ---------- I-94 / Residency ----------
export interface I94TravelRow {
  date: string;
  type: "arrival" | "departure";
}

export interface ResidencyResult {
  exemptYearsUsed: number;
  isNonresident: boolean;
  firstEntryDate: string;
  daysPresent: {
    taxYear: number; // Form 8843 line 4b + Schedule OI item H
    prior1: number; // Form 8843 line 4c + Schedule OI item H
    prior2: number; // Form 8843 line 4d + Schedule OI item H
  };
  daysExcluded: number; // Form 8843 line 4e — for F-1 students, equals daysPresent.taxYear
  entryExitTaxYear: { entered: string; departed: string | null }[]; // Schedule OI item G
  visaHistory: Record<number, string>; // year → visa class, e.g. {2020: "F-1", 2021: "F-1"} for Form 8843 line 11
  reasoning: string; // plain-English explanation for the PASS/FAIL screen
}

// ---------- Income Documents ----------
// W-2 — one per employer
export interface W2Data {
  employerName: string;
  employerEin: string;
  employerAddress: string; // for FICA employer email + 1040-NR attachment
  box1: number; // wages, tips, other compensation -
  box2: number; // federal income tax withheld → 1040-NR line 25a - 
  box3: number; // social security wages
  box4: number; // social security tax withheld → FICA finding
  box5: number; // Medicare wages
  box6: number; // Medicare tax withheld → FICA finding
  box15State: string | null; // state abbreviation, null if WA or blank
  box17StateTaxWithheld: number | null; // state income tax → Schedule A deduction
}

// 1042-S — foreign person's US source income
export interface F1042SData {
  incomeCode: string; // box 1 (e.g., "16" = scholarship, "17" = independent services) - 
  grossIncome: number; // box 2 -
  exemptionCode: string | null; // box 3a
  exemptionRate: number | null; // box 3b — treaty rate (e.g., 0.00 for fully exempt)
  taxWithheld: number; // box 7a — federal tax withheld → 1040-NR line 25g
  countryCode: string; // box 12f — country code
  withholdingCredit: number; // box 10 — total withholding credit (combine 7a+8+9) - 
}

// 1099-INT — interest income
export interface F1099INTData {
  payerName: string;
  payerEin: string;
  box1InterestIncome: number; // interest income - 
  box4FederalTaxWithheld: number; // → 1040-NR line 25b even if interest is exempt - 
  box8TaxExemptInterest: number; // → 1040-NR line 2a (info only) - 
}

// 1099-DIV — dividends
export interface F1099DIVData {
  payerName: string;
  payerEin: string;
  box1aTotalOrdinaryDividends: number; // → Schedule NEC line 1a -
  box1bQualifiedDividends: number; // → 1040-NR line 3a (info), still taxed at 30% for NRA - 
  box4FederalTaxWithheld: number; // → 1040-NR line 25b
}

// 1099-B — proceeds from broker transactions
export interface F1099BTransaction {
  description: string; // e.g. "100 sh. AAPL"
  dateAcquired: string | null; // null if various/inherited
  dateSold: string;
  proceeds: number; // box 1d — sales price
  costBasis: number; // box 1e — cost or other basis
  realizedGainLoss: number; // proceeds - costBasis
  isShortTerm: boolean; // box 2: true if short-term
  box4FederalTaxWithheld: number;
}

export interface F1099BData {
  payerName: string;
  transactions: F1099BTransaction[];
}

// 1099-DA — proceeds from digital asset (crypto) broker transactions. Same
// transaction shape as 1099-B: Schedule NEC line 16 doesn't distinguish a
// stock sale from a digital-asset disposal, both just need description/
// dates/proceeds/basis, so income.ts combines f1099bs and f1099das into the
// same capital-gains total and the same attachment rows.
export interface F1099DAData {
  payerName: string;
  transactions: F1099BTransaction[];
}

// ---------- Engine Input ----------
export interface FilingInput {
  taxYear: number;
  profile: FilerProfile;
  residency: ResidencyResult;

  // Income documents
  w2s: W2Data[];
  f1042s: F1042SData[];
  f1099ints: F1099INTData[];
  f1099divs: F1099DIVData[];
  f1099bs: F1099BData[];
  f1099das: F1099DAData[];

  // Manual inputs
  charitableContributions: number; // Schedule A line 4
}

// ---------- Rule Data (mirrors Supabase rows) ----------
export interface TaxYearConfig {
  brackets_single: [number, number, number][]; // [floor, ceiling, rate]
  brackets_mfs: [number, number, number][];
  standard_deduction: number; // only used when treaty allows (India)
  nec_default_rate: number; // 0.30 (30%)
  capital_gains_presence_days: number; // 183
  filing_deadline_wages: string; // "2026-04-15"
  filing_deadline_no_wages: string; // "2026-06-15"
  mailing_address_1040nr_refund: string;
  mailing_address_1040nr_payment: string;
  mailing_address_843: string;
  payment_url: string; // IRS Direct Pay URL
}

export interface TreatyRule {
  country_code: string; // ISO 3166 alpha-2
  tax_year: number;
  income_type: "wages" | "scholarship" | "dividends" | "capital_gains" | "interest";
  article: string; // e.g. "21(2)", "20(c)"
  exempt_amount: number | null; // null = unlimited
  nec_treaty_rate: number | null; // e.g., 0.15 for 15% on dividends, null = use default 30%
  time_limit_years: number | null; // null = no limit (China quirk)
  allows_standard_deduction: boolean; // true only for India
  citation: string; // "Pub 901; US-India Art 21(2)"
}

// ---------- Engine Output ----------
export interface TraceEvent {
  rule: string;
  inputs: Record<string, unknown>;
  output: number | string | boolean;
  citation?: string;
}

export type FindingKind =
  | "fica" // W-2 boxes 4+6 nonzero for exempt NRA
  | "scholarship" // taxable scholarship reported on 1042-S income code 16
  | "treaty" // treaty benefit applied
  | "exempt_interest" // bank interest exempt under §871(i)
  | "completeness" // income summary confirmation
  | "capital_gains_183" // 183-day rule applied to capital gains
  | "dividend_nec" // dividends routed to Schedule NEC
  | "state_crosscheck"; // W-2 box 15 shows taxable state

export interface Finding {
  id: string;
  kind: FindingKind;
  headline: string;
  amountUsd?: number;
  detail: string;
}

export type FormId =
  | "1040nr"
  | "schedOI"
  | "f8843"
  | "schedA"
  | "schedNEC"
  | "f8833"
  | "instructionPDF"; // branded cover sheet

export interface ComputedReturn {
  lines: Record<string, number | string>;
  // Keys follow the pattern: "1040nr.1a", "1040nr.25a", "schedOI.A",
  // "f8843.4b", "schedNEC.1a", "schedA.4", etc.
  refundOrDue: number; // positive = refund, negative = balance due
  findings: Finding[];
  trace: TraceEvent[];
  forms: FormId[]; // which forms to generate
}

// ---------- Stage 0 Eligibility ----------
export interface EligibilityInput {
  taxYear: number;
  currentSupportedTaxYear: number;
  visaClass: string; // confirmed extraction from I-94
  firstEntryDate: string; // confirmed extraction from I-94, ISO yyyy-mm-dd
  travelHistory: I94TravelRow[]; // confirmed extraction from travel history
  hadEarlierFJMQVisa: boolean; // ASK
  hasGreenCard: boolean; // ASK
  appliedForGreenCard: boolean; // ASK → Form 8843 line 13
  appliedForGreenCardExplanation?: string; // ASK, only if appliedForGreenCard → Form 8843 line 14
  changedVisaType: boolean; // ASK — true (ever changed visa type) fails the gate
  incomeOnlyInWashington: boolean; // ASK — false (earned income outside WA) fails the gate
}

export interface EligibilityResult {
  passed: boolean; // overall Stage 0 gate (visa + green card + tax year + 5-year rule)
  reasoning: string; // plain-English PASS/NO-PASS explanation for the UI
  residency: ResidencyResult;
}

// What actually gets persisted in the eligibility_page column: the
// confirmed input plus what evaluateEligibility() computed from it. Kept
// separate from EligibilityInput (the pure function-argument shape) so
// evaluateEligibility()'s signature doesn't have to accept the thing it's
// about to produce.
export interface EligibilityPageData extends EligibilityInput {
  residency: ResidencyResult;
}

// ---------- Stage 1 Interview ----------
export interface InterviewAnswers {
  workedInUs: boolean;
  onOPT: boolean; // only meaningful if workedInUs
  hasSSN: boolean;
  hasOrAppliedItin: boolean; // only meaningful if !hasSSN
  scholarshipCoverage: "none" | "tuition_only" | "tuition_and_living";
  interestIncome: boolean;
  dividendIncome: boolean;
  soldAssets: boolean;
  // Optional: saved separately via /api/reduction (which merges rather than
  // replaces interview_answers), so a checklist POST that omits these never
  // clobbers what's already there.
  charitableContributions?: number; // Schedule A line 4
  charitableContributionsConfirmed?: boolean; // true only once the user has actively saved (0 counts)
}

// ---------- Wizard ----------
export type Stage =
  | "eligibility" // Stage 0 — residency check
  | "profile" // Stage 1a — filer identity
  | "interview" // Stage 1b — situation questions
  | "documents" // Stage 2 — upload + extraction
  | "review" // Stage 3+4+5 — findings, computation, summary
  | "file" // Stage 6 — PDF download + instructions
  | "blocked"; // routed out (not F-1, resident, etc.)