import type {
  F1042SData,
  F1099BData,
  F1099DIVData,
  F1099INTData,
  Finding,
  FilerProfile,
  ResidencyResult,
  TraceEvent,
  TreatyRule,
} from "@/lib/types";
import { TAX_YEAR_CONFIG } from "@/lib/config/taxYear";
import { findTreatyRuleForCountryName } from "@/lib/rules/treaties";

// Stage 5 — the actual math. Pure and deterministic: every number here is
// arithmetic or a bracket/treaty-table lookup, never an LLM call (Split Brain
// principle — see AI Agent Tax Business Proposal.pdf, Stage 4). The 5 PDF
// form modules in lib/rules/forms/ format these numbers into line strings;
// this file just computes them once so every form agrees with every other.
//
// Scope: passive income (interest/dividends/capital gains) + scholarship
// only. No wages, no FICA — see lib/rules/forms/f8843.ts's sibling modules
// for the same scoping note.

const SCHOLARSHIP_INCOME_CODE = "16"; // 1042-S box 1, per F1042SData's own comment in lib/types.ts

export interface IncomeEngineResult {
  // ---- Scholarship (Form 1040-NR Schedule 1 line 8r equivalent) ----
  scholarshipTreatyExempt: number; // portion excluded under a student-article treaty
  scholarshipTaxable: number; // scholarship1042SReported - treatyExempt
  scholarship1042SReported: number; // sum of income-code-16 1042-S gross income — the taxable scholarship amount itself
  scholarship1042SWithheld: number;
  scholarshipExemptSubstantiatedBy1042S: boolean; // true if a 1042-S already documents the treaty claim

  // ---- Interest (statutorily exempt for NRAs — §871(h)/(i), not treaty-dependent) ----
  interestExempt: number; // total box1, none of it taxable
  interestWithheld: number; // box4, still a withholding credit despite being exempt

  // ---- Dividends (Schedule NEC line 1a) ----
  dividendsGross: number; // total box1a
  dividendsTreatyRate: number | null; // null = no treaty, use default NEC rate
  dividendsTax: number;
  dividendsWithheld: number;

  // ---- Capital gains (Schedule NEC line 9, 183-day rule) ----
  capitalGainsNet: number; // sum of realizedGainLoss across all transactions (can be negative)
  capitalGainsPresentDays: number;
  capitalGainsTaxable: boolean; // true only if presentDays >= threshold AND net > 0
  capitalGainsTax: number;
  capitalGainsWithheld: number;

  // ---- Deduction (Schedule A or India standard deduction) ----
  charitableContributions: number;
  usesStandardDeduction: boolean;
  deduction: number;

  // ---- Totals ----
  effectivelyConnectedIncome: number; // = scholarshipTaxable (no wages this phase)
  taxableIncome: number;
  effectivelyConnectedTax: number; // graduated-bracket tax
  necTax: number; // dividendsTax + capitalGainsTax
  totalTax: number;
  totalWithholding: number;
  refundOrDue: number; // positive = refund

  treatyRule: TreatyRule | null; // the scholarship-article rule actually applied, if any
  needsForm8833: boolean;

  findings: Finding[];
  trace: TraceEvent[];
}

export function computeIncomeEngine(args: {
  taxYear: number;
  profile: Partial<FilerProfile>;
  residency: ResidencyResult;
  f1042s: F1042SData[];
  f1099ints: F1099INTData[];
  f1099divs: F1099DIVData[];
  f1099bs: F1099BData[];
  charitableContributions: number;
}): IncomeEngineResult {
  const { taxYear, profile, residency, f1042s, f1099ints, f1099divs, f1099bs, charitableContributions } = args;
  const config = TAX_YEAR_CONFIG;
  const country = profile.citizenship?.value ?? "";
  const findings: Finding[] = [];
  const trace: TraceEvent[] = [];

  // ---------- Scholarship ----------
  // Taxable scholarship income comes straight from the school's own 1042-S
  // (income code 16) — they've already computed the excess-over-qualified-
  // expenses amount and withheld against it, so there's no separate "excess
  // over tuition" calculation to do here.
  const scholarship1042s = f1042s.filter((doc) => doc.incomeCode === SCHOLARSHIP_INCOME_CODE);
  const scholarship1042SReported = sum(scholarship1042s.map((doc) => doc.grossIncome));
  const scholarship1042SWithheld = sum(scholarship1042s.map((doc) => doc.taxWithheld));
  const scholarshipExemptSubstantiatedBy1042S = scholarship1042s.some(
    (doc) => doc.exemptionCode !== null && (doc.exemptionRate ?? 1) < 1
  );

  const scholarshipTreatyRule = findTreatyRuleForCountryName(country, "scholarship", taxYear);
  const scholarshipTreatyExempt = scholarshipTreatyRule
    ? Math.min(scholarship1042SReported, scholarshipTreatyRule.exempt_amount ?? Infinity)
    : 0;
  const scholarshipTaxable = scholarship1042SReported - scholarshipTreatyExempt;

  if (scholarship1042SReported > 0) {
    findings.push({
      id: "scholarship-taxable",
      kind: "scholarship",
      headline: `Your school reported $${scholarship1042SReported} in taxable scholarship income on Form 1042-S.`,
      amountUsd: scholarship1042SReported,
      detail: `$${scholarship1042SWithheld} was withheld.`,
    });
  }
  if (scholarshipTreatyExempt > 0) {
    findings.push({
      id: "scholarship-treaty-exempt",
      kind: "treaty",
      headline: `$${scholarshipTreatyExempt} of your scholarship is exempt under the US-${country} treaty.`,
      amountUsd: scholarshipTreatyExempt,
      detail: scholarshipTreatyRule?.citation ?? "",
    });
    trace.push({
      rule: "treaty.scholarship",
      inputs: { country, scholarship1042SReported },
      output: scholarshipTreatyExempt,
      citation: scholarshipTreatyRule?.citation,
    });
  }

  // ---------- Interest (always exempt, never taxed) ----------
  const interestExempt = sum(f1099ints.map((doc) => doc.box1InterestIncome));
  const interestWithheld = sum(f1099ints.map((doc) => doc.box4FederalTaxWithheld));
  if (interestExempt > 0) {
    findings.push({
      id: "exempt-interest",
      kind: "exempt_interest",
      headline: `$${interestExempt} in bank interest is exempt from U.S. tax under §871(i).`,
      amountUsd: interestExempt,
      detail: "Portfolio/deposit interest paid to a nonresident alien isn't taxable, regardless of treaty.",
    });
  }

  // ---------- Dividends (Schedule NEC) ----------
  const dividendsGross = sum(f1099divs.map((doc) => doc.box1aTotalOrdinaryDividends));
  const dividendsWithheld = sum(f1099divs.map((doc) => doc.box4FederalTaxWithheld));
  const dividendTreatyRule = findTreatyRuleForCountryName(country, "dividends", taxYear);
  const dividendsTreatyRate = dividendTreatyRule?.nec_treaty_rate ?? null;
  const dividendsRate = dividendsTreatyRate ?? config.nec_default_rate;
  const dividendsTax = round2(dividendsGross * dividendsRate);
  if (dividendsGross > 0) {
    findings.push({
      id: "dividend-nec",
      kind: "dividend_nec",
      headline: `$${dividendsGross} in dividends is taxed at a flat ${(dividendsRate * 100).toFixed(0)}% on Schedule NEC.`,
      amountUsd: dividendsTax,
      detail: dividendTreatyRule
        ? `Reduced treaty rate under ${dividendTreatyRule.citation}.`
        : `No treaty benefit found for ${country || "this country"} — default 30% FDAP rate applies.`,
    });
    trace.push({
      rule: "scheduleNEC.dividends",
      inputs: { dividendsGross, rate: dividendsRate },
      output: dividendsTax,
      citation: dividendTreatyRule?.citation,
    });
  }

  // ---------- Capital gains (183-day rule, Schedule NEC) ----------
  const allTransactions = f1099bs.flatMap((doc) => doc.transactions);
  const capitalGainsNet = sum(allTransactions.map((tx) => tx.realizedGainLoss));
  const capitalGainsWithheld = sum(allTransactions.map((tx) => tx.box4FederalTaxWithheld));
  const capitalGainsPresentDays = residency.daysPresent.taxYear;
  const capitalGainsTaxable = capitalGainsPresentDays >= config.capital_gains_presence_days && capitalGainsNet > 0;
  const capitalGainsTax = capitalGainsTaxable ? round2(capitalGainsNet * config.nec_default_rate) : 0;
  if (allTransactions.length > 0) {
    findings.push({
      id: "capital-gains-183",
      kind: "capital_gains_183",
      headline: capitalGainsTaxable
        ? `Present ${capitalGainsPresentDays} days this year (≥${config.capital_gains_presence_days}), so your $${capitalGainsNet} net capital gain is taxable at 30% on Schedule NEC.`
        : `Present ${capitalGainsPresentDays} days this year (<${config.capital_gains_presence_days}), so your capital gains/losses aren't taxable.`,
      amountUsd: capitalGainsTax || undefined,
      detail: "IRC §871(a)(2): a nonresident alien's US-source capital gains are taxed only if present 183+ days in the tax year.",
    });
    trace.push({
      rule: "scheduleNEC.capitalGains183",
      inputs: { capitalGainsNet, capitalGainsPresentDays, threshold: config.capital_gains_presence_days },
      output: capitalGainsTax,
    });
  }

  // ---------- Deduction ----------
  const usesStandardDeduction =
    !!scholarshipTreatyRule?.allows_standard_deduction && charitableContributions < config.standard_deduction;
  const deduction = usesStandardDeduction
    ? Math.max(charitableContributions, config.standard_deduction)
    : charitableContributions;

  // ---------- Form 8833 need ----------
  // Standard exception to 8833 disclosure: a treaty-based scholarship
  // exemption already substantiated by the withholding agent's 1042-S. India's
  // Article 21(2) standard-deduction claim is never covered by that exception
  // (per the proposal's explicit "if india treaty" rule), so it always needs 8833.
  const needsForm8833 =
    (scholarshipTreatyExempt > 0 && !scholarshipExemptSubstantiatedBy1042S) || !!usesStandardDeduction;

  // ---------- Totals ----------
  const effectivelyConnectedIncome = scholarshipTaxable; // no wages this phase
  const taxableIncome = Math.max(0, effectivelyConnectedIncome - deduction);
  const brackets = profile.filingStatus === "married_nra" ? config.brackets_mfs : config.brackets_single;
  const effectivelyConnectedTax = round2(bracketTax(taxableIncome, brackets));
  const necTax = dividendsTax + capitalGainsTax;
  const totalTax = round2(effectivelyConnectedTax + necTax);
  const totalWithholding = round2(
    interestWithheld + dividendsWithheld + capitalGainsWithheld + scholarship1042SWithheld
  );
  const refundOrDue = round2(totalWithholding - totalTax);

  const totalIncomeSummary = scholarshipTaxable + interestExempt + dividendsGross + capitalGainsNet;
  if (totalIncomeSummary > 0) {
    findings.push({
      id: "income-completeness",
      kind: "completeness",
      headline: `Total US income found: $${round2(scholarshipTaxable + dividendsGross + Math.max(capitalGainsNet, 0))} taxable, plus $${interestExempt} exempt bank interest.`,
      amountUsd: totalIncomeSummary,
      detail: "Confirm this covers everything, or add anything missing.",
    });
  }

  return {
    scholarshipTreatyExempt,
    scholarshipTaxable,
    scholarship1042SReported,
    scholarship1042SWithheld,
    scholarshipExemptSubstantiatedBy1042S,
    interestExempt,
    interestWithheld,
    dividendsGross,
    dividendsTreatyRate,
    dividendsTax,
    dividendsWithheld,
    capitalGainsNet,
    capitalGainsPresentDays,
    capitalGainsTaxable,
    capitalGainsTax,
    capitalGainsWithheld,
    charitableContributions,
    usesStandardDeduction,
    deduction,
    effectivelyConnectedIncome,
    taxableIncome,
    effectivelyConnectedTax,
    necTax,
    totalTax,
    totalWithholding,
    refundOrDue,
    treatyRule: scholarshipTreatyRule,
    needsForm8833,
    findings,
    trace,
  };
}

function sum(values: number[]): number {
  return round2(values.reduce((total, value) => total + value, 0));
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

// Standard marginal-bracket tax: each [floor, ceiling, rate] slice taxes only
// the income that falls within it.
function bracketTax(taxableIncome: number, brackets: readonly [number, number, number][]): number {
  let tax = 0;
  for (const [floor, ceiling, rate] of brackets) {
    if (taxableIncome <= floor) break;
    const taxedInBracket = Math.min(taxableIncome, ceiling) - floor;
    tax += taxedInBracket * rate;
  }
  return tax;
}
