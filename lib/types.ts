// -------- types.ts ---------
// Core data model for AI extraction, calculation result, frontend user interface. It validates data types.
// ----------------------------

import { StyledString } from "next/dist/build/swc/types";

// ------------- Documents -------------
export type DocType =
  | "ead"
  | "i94"
  | "i20"
  | "w2"
  | "f1042s"
  | "f1098t"
  | "f1099int"
  | "f1099b"
  | "f1099div"
  | "unknown";

export interface ExtractedField<T> {
  value: T;
  confidenced: number; // 0 - 1 from extraction
  confirmed: boolean; // true if user tap confirmed
  source: DocType;
}

// ------------- Fields -------------
export interface Address {
  line1: string;
  line2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

export type FilingStatus = "single" | "married_nra";

export interface SchoolInfo {
  name: string;
  address: string;
  phone: string;
  dsoName: string;
}

export interface FilerProfile {
  legalName: ExtractedField<string>;
  dob: ExtractedField<string>;
  citizenship: ExtractedField<string>;
  taxResidenceCountry: string;
  usAddress: Address;
  foreignAddress: Address;
  filingStatus: FilingStatus;
  ssnOrItin: string;
  digitalAssets: boolean;
  priorReturn: { filed: boolean; year?: number; form?: "1040" | "1040nr" };
  school: SchoolInfo;
}

// ---------- residency ----------
export interface I94Entry {
  entryDate: string;
  exitDate: string | null;
  visaClass: string;
}

export interface ResidencyResult {
  exemptYearsUsed: number;
  isNonresident: boolean;
  firstEntryDate: string;
  daysPresent: { taxYear: number; prior1: number; prior2: number };
  reasoning: string;
}

// ---------- income documents ----------
export interface W2Data {
  employerName: string;
  employerEin: string;
  box1: number;
  box2: number;
  box3: number;
  box4: number;
  box5: number;
  box6: number;
  box15State: string | null;
}

export interface F1042SData {
  incomeCode: string;
  grossIncome: number;
  exemptionCode: string | null;
  taxWithheld: number; // box 7
  countryCode: string;
}

export interface F1098TData {
  box1: number;
  box5: number;
}

// --- Added 1099 Passive Income Data Structures ---
export interface F1099INTData {
  payerName: string;
  payerEin: string;
  box1InterestIncome: number;
  box4FederalTaxWithheld: number;
  box8ExemptInterest: number; // Vital for international students
}

export interface F1099DIVData {
  payerName: string;
  payerEin: string;
  box1aTotalOrdinaryDividends: number;
  box1bQualifiedDividends: number;
  box4FederalTaxWithheld: number;
}

export interface F1099BProceeds {
  description: string;
  dateAcquired: string | null; // null if inherited/various
  dateSold: string;
  proceeds: number; // box 1d
  costBasis: number; // box 1e
  realizedGainLoss: number;
  isShortTerm: boolean; // true if held <= 1 year
  box4FederalTaxWithheld: number;
}

export interface F1099BData {
  payerName: string;
  transactions: F1099BProceeds[];
}

// ---------- engine input ----------
export interface FilingInput {
  taxYear: number;
  profile: FilerProfile;
  residency: ResidencyResult;
  w2s: W2Data[];
  f1042s: F1042SData[];
  f1098t: F1098TData | null;
  charitableContributions: number;
  // Included 1099 data packets for the engine to ingest
  f1099ints: F1099INTData[];
  f1099divs: F1099DIVData[];
  f1099bs: F1099BData[];
}

// ---------- rule data (mirrors Supabase rows) ----------
export interface TaxYearConfig {
  brackets_single: [number, number, number][]; // [floor, ceiling, rate]
  brackets_mfs: [number, number, number][];
  standard_deduction: number;
  nec_default_rate: number;
  capital_gains_presence_days: number;
  filing_deadline_wages: string;
  filing_deadline_no_wages: string;
  mailing_address_1040nr_refund: string;
  mailing_address_1040nr_payment: string;
  mailing_address_843: string;
  payment_url: string;
}

export interface TreatyRule {
  country_code: string;
  tax_year: number;
  income_type: "wages" | "scholarship";
  article: string;
  exempt_amount: number | null; // null = unlimited
  time_limit_years: number | null; // null = no limit
  allows_standard_deduction: boolean;
  citation: string;
}

// ---------- engine output ----------
export interface TraceEvent {
  rule: string;
  inputs: Record<string, unknown>;
  output: number | string | boolean;
  citation?: string;
}

export type FindingKind =
  | "fica"
  | "scholarship"
  | "treaty"
  | "exempt_interest"
  | "completeness"
  | "capital_gains_183"
  | "dividend_nec"; // Added finding kinds for passive income tracking

export interface Finding {
  id: string;
  kind: FindingKind;
  headline: string;
  amountUsd?: number;
  detail: string;
}

// Added 'schedNEC' to generation list for passive income tracking
export type FormId = "1040nr" | "schedOI" | "f8843" | "schedA" | "schedNEC";

export interface ComputedReturn {
  lines: Record<string, number | string>; // '1040nr.11', 'f8843.partI.days'
  refundOrDue: number; // positive = refund
  findings: Finding[];
  trace: TraceEvent[];
  forms: FormId[];
}

// ---------- wizard ----------
export type Stage =
  | "eligibility"
  | "profile"
  | "interview"
  | "documents"
  | "review"
  | "file"
  | "blocked";
