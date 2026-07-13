import type { FilerProfile } from "@/lib/types";
import type { IncomeEngineResult } from "@/lib/rules/income";
import { formatSsnDigits, formatUsdWhole, splitLegalName } from "@/lib/format";

// The form buckets each income line into a 10%/15%/30%/"other" rate column
// (a/b/c/d). Only 10/15/30 are pre-printed; anything else (e.g. India's 25%
// dividend rate) goes in column "d" with its rate written in once at the top
// of the column (schedNEC.d.rate) — every "d" amount on the form shares that
// one rate, which is fine since this engine only ever produces one non-
// standard rate at a time.
type RateColumn = "a" | "b" | "c" | "d";

function rateColumn(rate: number): RateColumn {
  if (rate === 0.1) return "a";
  if (rate === 0.15) return "b";
  if (rate === 0.3) return "c";
  return "d";
}

// Pure mapping from the Stage 5 income engine to Schedule NEC (Form 1040-NR)
// line values. Scope: dividends (line 1a) and capital gains (line 9, fed by
// the line 16-18 worksheet) — the only NEC-taxed income types in scope.
// Multiple 1099-B transactions are summarized directly into the line 17/18
// net-gain figures rather than itemized on line 16, which the form itself
// allows ("if necessary, attach statement of descriptive details").
export function computeScheduleNEC(args: { profile: Partial<FilerProfile>; income: IncomeEngineResult }): Record<string, string> {
  const { profile, income } = args;
  const { firstNameAndInitial, lastName } = splitLegalName(profile.legalName?.value);

  const lines: Record<string, string> = {
    "schedNEC.name": [firstNameAndInitial, lastName].filter(Boolean).join(" "),
    "schedNEC.tin": formatSsnDigits(profile.ssnOrItin),
  };

  const totals: Record<RateColumn, number> = { a: 0, b: 0, c: 0, d: 0 };
  const taxByColumn: Record<RateColumn, number> = { a: 0, b: 0, c: 0, d: 0 };

  if (income.dividendsGross > 0) {
    const rate = income.dividendsTreatyRate ?? 0.3;
    const col = rateColumn(rate);
    lines[`schedNEC.1a.${col}`] = formatUsdWhole(income.dividendsGross);
    totals[col] += income.dividendsGross;
    taxByColumn[col] += income.dividendsTax;
    if (col === "d") lines["schedNEC.d.rate"] = `${(rate * 100).toFixed(0)}`;
  }

  if (income.capitalGainsTaxable) {
    // No treaty entry overrides the capital-gains rate for any country in
    // TREATY_RULES, so this is always the statutory 30% default column.
    lines["schedNEC.17"] = formatUsdWhole(income.capitalGainsNet);
    lines["schedNEC.18"] = formatUsdWhole(income.capitalGainsNet);
    lines["schedNEC.9.c"] = formatUsdWhole(income.capitalGainsNet);
    totals.c += income.capitalGainsNet;
    taxByColumn.c += income.capitalGainsTax;
  }

  (Object.keys(totals) as RateColumn[]).forEach((col) => {
    if (totals[col] > 0) {
      lines[`schedNEC.13.${col}`] = formatUsdWhole(totals[col]);
      lines[`schedNEC.14.${col}`] = formatUsdWhole(taxByColumn[col]);
    }
  });

  lines["schedNEC.15"] = formatUsdWhole(income.necTax); // → Form 1040-NR line 23a

  return lines;
}
