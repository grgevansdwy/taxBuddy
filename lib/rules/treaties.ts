import type { TreatyRule } from "@/lib/types";

// Curated treaty data for the 5 most common F-1 source countries. Sourced from
// IRS Pub 901 (Rev. September 2024), "Students and Apprentices" narrative
// (scholarship article terms) and Tax Treaty Table 1 (Rev. May 2023, dividend
// withholding rates, "general"/non-corporate column). Any country not listed
// here falls back to no treaty benefit: 30% flat NEC rate, itemized deduction
// only, no Form 8833.
//
// IMPORTANT nuance baked into the `scholarship` rows: several treaties'
// student articles only exempt payments/remittances received FROM ABROAD for
// the student's maintenance — they do NOT reach US-source scholarship money
// paid by the US school itself (which is what 1098-T/1042-S report, and the
// only scholarship income this engine ever sees). China and South Korea are
// the exceptions: their treaties separately exempt "the grant, allowance, or
// award" with no abroad-sourcing restriction, so US-school scholarships are
// covered. India and Canada's articles are abroad-only, so exempt_amount is
// 0 here even though the treaty exists — India gets the standard-deduction
// consolation prize instead (allows_standard_deduction). Mexico's treaty has
// no Students/Apprentices article at all.
export const TREATY_RULES: TreatyRule[] = [
  // ---------- China, People's Republic of ----------
  {
    country_code: "CN",
    tax_year: 2025,
    income_type: "scholarship",
    article: "20(c)",
    exempt_amount: null, // unlimited — "grant, allowance, or award" not restricted to abroad
    nec_treaty_rate: null,
    time_limit_years: null, // "time reasonably necessary to complete the education or training"
    allows_standard_deduction: false,
    citation: "Pub 901 (9-2024) Students and Apprentices, China; US-China Art 20(c)",
  },
  {
    country_code: "CN",
    tax_year: 2025,
    income_type: "dividends",
    article: "9(2)",
    exempt_amount: null,
    nec_treaty_rate: 0.1, // flat 10%, same for general and qualifying-direct columns
    time_limit_years: null,
    allows_standard_deduction: false,
    citation: "Tax Treaty Table 1 (5-2023), China dividends; US-China Art 9(2)",
  },

  // ---------- India ----------
  {
    country_code: "IN",
    tax_year: 2025,
    income_type: "scholarship",
    article: "21(2)",
    exempt_amount: 0, // exemption is abroad-remittances only; excludes payments "paid by a U.S. ... resident" (the school)
    nec_treaty_rate: null,
    time_limit_years: null,
    allows_standard_deduction: true, // the actual benefit for India: standard deduction on Form 1040-NR
    citation: "Pub 901 (9-2024) Students and Apprentices, India; US-India Art 21(2)",
  },
  {
    country_code: "IN",
    tax_year: 2025,
    income_type: "dividends",
    article: "10(2)",
    exempt_amount: null,
    nec_treaty_rate: 0.25, // general portfolio rate; 15% column only applies to qualifying direct/corporate holdings
    time_limit_years: null,
    allows_standard_deduction: true,
    citation: "Tax Treaty Table 1 (5-2023), India dividends; US-India Art 10(2)",
  },

  // ---------- Korea, South ----------
  {
    country_code: "KR",
    tax_year: 2025,
    income_type: "scholarship",
    article: "21(1)",
    exempt_amount: null, // unlimited — "the grant, allowance, or award" not restricted to abroad
    nec_treaty_rate: null,
    time_limit_years: 5,
    allows_standard_deduction: false,
    citation: "Pub 901 (9-2024) Students and Apprentices, Korea, South; US-Korea Art 21(1)",
  },
  {
    country_code: "KR",
    tax_year: 2025,
    income_type: "dividends",
    article: "12(2)",
    exempt_amount: null,
    nec_treaty_rate: 0.15, // general column; 10% qualifying-direct column doesn't apply to individual portfolio holders
    time_limit_years: null,
    allows_standard_deduction: false,
    citation: "Tax Treaty Table 1 (5-2023), Korea South dividends; US-Korea Art 12(2)",
  },

  // ---------- Canada ----------
  {
    country_code: "CA",
    tax_year: 2025,
    income_type: "scholarship",
    article: "XX",
    exempt_amount: 0, // exemption is "amounts received from sources outside the United States" only
    nec_treaty_rate: null,
    time_limit_years: null,
    allows_standard_deduction: false,
    citation: "Pub 901 (9-2024) Students and Apprentices, Canada; US-Canada Art XX",
  },
  {
    country_code: "CA",
    tax_year: 2025,
    income_type: "dividends",
    article: "X(2)",
    exempt_amount: null,
    nec_treaty_rate: 0.15, // general column; 5% qualifying-direct column doesn't apply to individual portfolio holders
    time_limit_years: null,
    allows_standard_deduction: false,
    citation: "Tax Treaty Table 1 (5-2023), Canada dividends; US-Canada Art X(2)",
  },

  // ---------- Mexico ----------
  // No Students/Apprentices article in the US-Mexico treaty at all — no
  // scholarship row. Dividend rate still applies to any NRA with US
  // brokerage dividends, treaty or not.
  {
    country_code: "MX",
    tax_year: 2025,
    income_type: "dividends",
    article: "10(2)",
    exempt_amount: null,
    nec_treaty_rate: 0.1, // general column; 5% qualifying-direct column doesn't apply to individual portfolio holders
    time_limit_years: null,
    allows_standard_deduction: false,
    citation: "Tax Treaty Table 1 (5-2023), Mexico dividends; US-Mexico Art 10(2)",
  },
];

export function findTreatyRule(
  countryCode: string,
  incomeType: TreatyRule["income_type"],
  taxYear: number
): TreatyRule | null {
  return (
    TREATY_RULES.find(
      (rule) => rule.country_code === countryCode && rule.income_type === incomeType && rule.tax_year === taxYear
    ) ?? null
  );
}

// profile.citizenship.value holds the full name from lib/config/countries.ts
// (extracted from the passport), not an ISO code — this bridges the two.
// Only the 5 countries covered by TREATY_RULES are listed; any other name
// falls through to "no treaty" (findTreatyRule returns null).
const COUNTRY_NAME_TO_CODE: Record<string, string> = {
  China: "CN",
  India: "IN",
  "South Korea": "KR",
  Canada: "CA",
  Mexico: "MX",
};

export function findTreatyRuleForCountryName(
  countryName: string,
  incomeType: TreatyRule["income_type"],
  taxYear: number
): TreatyRule | null {
  const code = COUNTRY_NAME_TO_CODE[countryName];
  if (!code) return null;
  return findTreatyRule(code, incomeType, taxYear);
}
