import type {
  F1042SData,
  F1099BData,
  F1099BTransaction,
  F1099DAData,
  F1099DIVData,
  F1099INTData,
  Finding,
  FilerProfile,
  ResidencyResult,
  TraceEvent,
  TreatyRule,
  W2Data,
} from "@/lib/types";
import { TAX_YEAR_CONFIG } from "@/lib/config/taxYear";
import { findTreatyRuleForCountryName } from "@/lib/rules/treaties";
import { reconcileCapitalGainsTotals } from "@/lib/rules/capitalGains";

// Stage 5 — the actual math. Pure and deterministic: every number here is
// arithmetic or a bracket/treaty-table lookup, never an LLM call (Split Brain
// principle — see AI Agent Tax Business Proposal.pdf, Stage 4). The 5 PDF
// form modules in lib/rules/forms/ format these numbers into line strings;
// this file just computes them once so every form agrees with every other.
//
// Scope: passive income (interest/dividends/capital gains) + scholarship +
// wages (box 1 only — no FICA, no state tax) — see lib/rules/forms/f8843.ts's
// sibling modules for the same scoping note.

const SCHOLARSHIP_INCOME_CODE = "16"; // 1042-S box 1, per F1042SData's own comment in lib/types.ts

export interface IncomeEngineResult {
  // ---- Wages (Form 1040-NR line 1a — treaty exemption is a per-year dollar cap, if the country has one) ----
  wagesGross: number; // sum of W-2 box1 across all employers
  wagesTreatyExempt: number;
  wagesTaxable: number; // wagesGross - wagesTreatyExempt
  wagesWithheld: number; // sum of W-2 box2 → 1040-NR line 25a
  wagesTreatyRule: TreatyRule | null;

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
  capitalGainsTransactions: F1099BTransaction[]; // every lot, 1099-B and 1099-DA combined, in document order — line 16's itemized rows + the overflow attachment both read from this

  // ---- Deduction (Schedule A or India standard deduction) ----
  charitableContributions: number;
  usesStandardDeduction: boolean;
  deduction: number;

  // ---- Totals ----
  hasReportableIncome: boolean; // any taxable income at all — false means Form 8843 is the only form this filer needs
  totalTreatyExemptIncome: number; // wagesTreatyExempt + scholarshipTreatyExempt — feeds both 1040-NR line 1k and Schedule OI item L's total, so they can never drift apart
  effectivelyConnectedIncome: number; // = wagesTaxable + scholarshipTaxable
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
  w2s: W2Data[];
  f1042s: F1042SData[];
  f1099ints: F1099INTData[];
  f1099divs: F1099DIVData[];
  f1099bs: F1099BData[];
  f1099das: F1099DAData[];
  charitableContributions: number;
}): IncomeEngineResult {
  const { taxYear, profile, residency, w2s, f1042s, f1099ints, f1099divs, f1099bs, f1099das, charitableContributions } =
    args;
  const config = TAX_YEAR_CONFIG;
  const country = profile.citizenship?.value ?? "";
  const findings: Finding[] = [];
  const trace: TraceEvent[] = [];

  // ---------- Wages ----------
  // Treaty exemption (if the country has one) is a flat per-year dollar cap
  // on services connected to study/research/training or necessary for
  // maintenance — e.g. Indonesia's Art 19(1)(b)(iii), $2,000/year. Adding
  // another country's wage exemption is just a new row in treaties.ts.
  const wagesGross = sum(w2s.map((w2) => w2.box1));
  const wagesWithheld = sum(w2s.map((w2) => w2.box2));
  const wagesTreatyRule = findTreatyRuleForCountryName(country, "wages", taxYear);
  const wagesTreatyExempt = wagesTreatyRule ? Math.min(wagesGross, wagesTreatyRule.exempt_amount ?? Infinity) : 0;
  const wagesTaxable = wagesGross - wagesTreatyExempt;

  if (wagesTreatyExempt > 0) {
    findings.push({
      id: "wages-treaty-exempt",
      kind: "treaty",
      headline: `$${wagesTreatyExempt} of your wages is exempt under the US-${country} treaty.`,
      amountUsd: wagesTreatyExempt,
      detail: wagesTreatyRule?.citation ?? "",
    });
    trace.push({
      rule: "treaty.wages",
      inputs: { country, wagesGross },
      output: wagesTreatyExempt,
      citation: wagesTreatyRule?.citation,
    });
  }

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
  // 1099-B (stocks/ETFs) and 1099-DA (digital assets) feed the same total —
  // Schedule NEC line 16 doesn't distinguish a stock sale from a crypto sale.
  const allTransactions = [...f1099bs, ...f1099das].flatMap((doc) => doc.transactions);
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

    // Backstop: the summed lots must foot to the broker's own printed grand
    // total. A mismatch means rows were dropped or duplicated in extraction —
    // surface it for review rather than silently filing a wrong capital gain.
    const reconciliation = reconcileCapitalGainsTotals([...f1099bs, ...f1099das]);
    if (reconciliation && !reconciliation.ok) {
      // One finding per statement that doesn't foot, so the filer knows exactly
      // which broker's document to re-check. Per-document reconciliation means an
      // aggregate offset can no longer mask a real mismatch here.
      reconciliation.mismatched.forEach((docRec, i) => {
        findings.push({
          id: `capital-gains-reconciliation-${i}`,
          kind: "capital_gains_reconciliation",
          headline: `Your ${docRec.payerName} 1099 sales add up to $${round2(docRec.actual)}, but that statement's own total says $${round2(docRec.expected)} — please re-check the uploaded document.`,
          amountUsd: Math.abs(docRec.delta) || undefined,
          detail:
            "The summed transactions don't match the broker's printed grand-total net gain/loss, which usually means a row was missed or double-counted while reading the PDF.",
        });
      });
      trace.push({
        rule: "scheduleNEC.capitalGainsReconciliation",
        inputs: { documents: reconciliation.documents },
        output: reconciliation.delta,
      });
    }
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
  // Wage treaty exemptions (e.g. Indonesia's Art 19(1)(b)(iii)) are their own
  // standard exception per the Form 8833 instructions — student/trainee
  // compensation articles never require 8833 — so wagesTreatyExempt never
  // factors in here.
  const needsForm8833 =
    (scholarshipTreatyExempt > 0 && !scholarshipExemptSubstantiatedBy1042S) || !!usesStandardDeduction;

  // ---------- Totals ----------
  const effectivelyConnectedIncome = wagesTaxable + scholarshipTaxable;
  const taxableIncome = Math.max(0, effectivelyConnectedIncome - deduction);
  const brackets = profile.filingStatus === "married_nra" ? config.brackets_mfs : config.brackets_single;
  const effectivelyConnectedTax = taxForIncome(taxableIncome, brackets);
  const necTax = dividendsTax + capitalGainsTax;
  const totalTax = round2(effectivelyConnectedTax + necTax);
  const totalWithholding = round2(
    wagesWithheld + interestWithheld + dividendsWithheld + capitalGainsWithheld + scholarship1042SWithheld
  );
  const refundOrDue = round2(totalWithholding - totalTax);

  const totalIncomeSummary = wagesTaxable + scholarshipTaxable + interestExempt + dividendsGross + capitalGainsNet;
  if (totalIncomeSummary > 0) {
    findings.push({
      id: "income-completeness",
      kind: "completeness",
      headline: `Total US income found: $${round2(wagesTaxable + scholarshipTaxable + dividendsGross + Math.max(capitalGainsNet, 0))} taxable, plus $${interestExempt} exempt bank interest.`,
      amountUsd: totalIncomeSummary,
      detail: "Confirm this covers everything, or add anything missing.",
    });
  }

  const hasReportableIncome = wagesTaxable > 0 || scholarshipTaxable > 0 || dividendsGross > 0 || capitalGainsTaxable;
  const totalTreatyExemptIncome = round2(wagesTreatyExempt + scholarshipTreatyExempt);

  return {
    hasReportableIncome,
    totalTreatyExemptIncome,
    wagesGross,
    wagesTreatyExempt,
    wagesTaxable,
    wagesWithheld,
    wagesTreatyRule,
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
    capitalGainsTransactions: allTransactions,
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

// Form 1040-NR line 16 ("Tax"): for taxable income under $100,000, the
// instructions mandate reading the discrete IRS Tax Table, not applying
// bracketTax's continuous formula directly to the exact dollar amount. The
// Tax Table buckets income into rows — $10-wide below $25, $25-wide from $25
// up to $3,000, $50-wide from $3,000 up to $100,000 — and every income in a
// row pays the tax on that row's midpoint, rounded to the nearest whole
// dollar (50–99 cents rounds up). Verified against the 2025 Form 1040-NR
// Sample Table in the instructions (Single, $25,300–$25,350 row: midpoint
// $25,325 → bracketTax = $2,800.50 → table value $2,801). At $100,000 and
// above, the instructions switch to the Tax Computation Worksheet, which is
// just bracketTax evaluated at the exact income and rounded to the dollar —
// no table lookup.
function taxTableRowMidpoint(taxableIncome: number): number {
  if (taxableIncome < 5) return 0; // "At least 0 But less than 5" row — always $0 tax
  if (taxableIncome < 25) {
    const floor = taxableIncome < 15 ? 5 : 15;
    return floor + 5;
  }
  if (taxableIncome < 3000) {
    const floor = Math.floor((taxableIncome - 25) / 25) * 25 + 25;
    return floor + 12.5;
  }
  const floor = Math.floor(taxableIncome / 50) * 50;
  return floor + 25;
}

function roundToDollar(value: number): number {
  return Math.floor(value + 0.5); // IRS convention: 50-99 cents rounds up
}

function taxForIncome(taxableIncome: number, brackets: readonly [number, number, number][]): number {
  if (taxableIncome <= 0) return 0;
  const lookupIncome = taxableIncome < 100000 ? taxTableRowMidpoint(taxableIncome) : taxableIncome;
  return roundToDollar(bracketTax(lookupIncome, brackets));
}
