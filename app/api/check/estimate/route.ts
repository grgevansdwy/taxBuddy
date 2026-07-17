import { NextResponse } from "next/server";
import { CURRENT_SUPPORTED_TAX_YEAR } from "@/lib/config/taxYear";
import { runFunnelEngine, type FunnelIncomeInput } from "@/lib/check/engine";

// Public, NO-AUTH refund estimate for the pre-signup funnel. It runs the SAME
// Stage 5 engine (lib/rules/income.ts) the real app runs — nothing is
// re-implemented — over the income documents extracted by /api/check/extract.
// See lib/check/engine.ts for the assumptions the funnel makes in place of the
// background documents the app collects (residency, filing status, etc.).

export const runtime = "nodejs";

export async function POST(request: Request) {
  let body: FunnelIncomeInput;
  try {
    body = (await request.json()) as FunnelIncomeInput;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const income = runFunnelEngine(body);

  return NextResponse.json({
    taxYear: CURRENT_SUPPORTED_TAX_YEAR,
    refundOrDue: income.refundOrDue,
    hasReportableIncome: income.hasReportableIncome,
    wagesGross: income.wagesGross,
    wagesTaxable: income.wagesTaxable,
    wagesTreatyExempt: income.wagesTreatyExempt,
    wagesWithheld: income.wagesWithheld,
    scholarshipTaxable: income.scholarshipTaxable,
    scholarshipTreatyExempt: income.scholarshipTreatyExempt,
    interestExempt: income.interestExempt,
    dividendsGross: income.dividendsGross,
    dividendsTax: income.dividendsTax,
    capitalGainsNet: income.capitalGainsNet,
    capitalGainsTax: income.capitalGainsTax,
    capitalGainsTaxable: income.capitalGainsTaxable,
    deduction: income.deduction,
    usesStandardDeduction: income.usesStandardDeduction,
    taxableIncome: income.taxableIncome,
    effectivelyConnectedTax: income.effectivelyConnectedTax,
    necTax: income.necTax,
    totalTax: income.totalTax,
    totalWithholding: income.totalWithholding,
    findings: income.findings,
  });
}
