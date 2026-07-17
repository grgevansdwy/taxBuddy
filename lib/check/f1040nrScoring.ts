import { z } from "zod";
import { parsePdfToMarkdown } from "@/lib/parsing/llamaParse";
import { runMarkdownExtraction } from "@/lib/ai/runMarkdownExtraction";
import type { IncomeEngineResult } from "@/lib/rules/income";

// Funnel-local extraction + scoring for the "Already filed? Let's check your
// work" step. Deliberately NOT added to lib/ai/extractionSpecs.ts: those specs
// read INPUT income documents to BUILD a return; this reads a filer's already
// FILLED 1040-NR to grade it, which is a funnel concern, so it lives here and
// drives the generic runMarkdownExtraction runner directly.
//
// We read the filer's own numbers off their return, independently recompute
// the correct numbers with the real Stage 5 engine (lib/rules/income.ts) run
// on the same income documents, and diff the two line by line.

// The self-reported values we pull off the uploaded 1040-NR. Every line is
// nullable because a filer can legitimately leave a line blank.
const Filed1040NRSchema = z.object({
  tin: z.string(), // filer's SSN/ITIN — used only to fingerprint for dedup, never stored raw
  line1a: z.number().nullable(), // wages
  line8: z.number().nullable(), // taxable scholarship (Schedule 1 8r → 1040-NR line 8)
  line9: z.number().nullable(), // total effectively connected income
  line12: z.number().nullable(), // deduction (itemized / India standard)
  line15: z.number().nullable(), // taxable income
  line16: z.number().nullable(), // tax
  line23a: z.number().nullable(), // Schedule NEC tax
  line24: z.number().nullable(), // total tax
  line25d: z.number().nullable(), // withholding from W-2 / 1099
  line25g: z.number().nullable(), // withholding from 1042-S (Form 8805/8288-A group)
  line33: z.number().nullable(), // total payments
  line34: z.number().nullable(), // overpayment / refund
  line37: z.number().nullable(), // amount you owe
  confidence: z.number().min(0).max(1),
});

export type Filed1040NR = z.infer<typeof Filed1040NRSchema>;

const FILED_1040NR_JSON_SCHEMA = {
  type: "object",
  properties: {
    tin: { type: "string", description: "The filer's identifying number (SSN or ITIN) printed at the top of the form." },
    line1a: { type: ["number", "null"], description: "Line 1a: total wages from Form(s) W-2 box 1." },
    line8: { type: ["number", "null"], description: "Line 8: taxable scholarship/fellowship income from Schedule 1." },
    line9: { type: ["number", "null"], description: "Line 9: total effectively connected income (total income)." },
    line12: { type: ["number", "null"], description: "Line 12: itemized deductions (Schedule A) or, for India, the standard deduction." },
    line15: { type: ["number", "null"], description: "Line 15: taxable income." },
    line16: { type: ["number", "null"], description: "Line 16: tax." },
    line23a: { type: ["number", "null"], description: "Line 23a: tax on income not effectively connected, from Schedule NEC." },
    line24: { type: ["number", "null"], description: "Line 24: total tax." },
    line25d: { type: ["number", "null"], description: "Line 25d: federal income tax withheld from Form(s) W-2 and 1099." },
    line25g: { type: ["number", "null"], description: "Line 25g: federal tax withheld from Form(s) 1042-S / 8805 / 8288-A." },
    line33: { type: ["number", "null"], description: "Line 33: total payments." },
    line34: { type: ["number", "null"], description: "Line 34: overpayment (the refund amount), if line 33 exceeds line 24." },
    line37: { type: ["number", "null"], description: "Line 37: amount you owe, if line 24 exceeds line 33." },
    confidence: { type: "number", description: "Overall confidence (0-1) that every value above was read correctly." },
  },
  required: [
    "tin", "line1a", "line8", "line9", "line12", "line15", "line16",
    "line23a", "line24", "line25d", "line25g", "line33", "line34", "line37", "confidence",
  ],
  additionalProperties: false,
} as const;

export async function extractFiled1040NR(file: { buffer: Buffer; fileName: string }): Promise<Filed1040NR> {
  const markdown = await parsePdfToMarkdown(file);
  return runMarkdownExtraction({
    systemPrompt:
      "You read the values a nonresident alien filer has already entered on a completed US Form 1040-NR " +
      "(U.S. Nonresident Alien Income Tax Return). Report the number actually printed on each requested line, " +
      "exactly as written — do NOT recompute, correct, or infer a value that isn't there. If a line is blank, " +
      "return null for it.",
    jsonSchemaName: "record_filed_1040nr",
    jsonSchema: FILED_1040NR_JSON_SCHEMA as unknown as Record<string, unknown>,
    documents: [{ title: "Filed Form 1040-NR", markdown }],
    instruction: "Read the values the filer entered on the Form 1040-NR above.",
    schema: Filed1040NRSchema,
  });
}

// ---------------- Scoring ----------------

export interface ScoreLine {
  line: string; // "1a", "12", ...
  label: string;
  filed: number | null; // what the filer wrote (null = left blank)
  correct: number; // what the engine computes
  match: boolean;
  delta: number; // correct - filed (positive = filer under-reported this line)
}

export interface ScoreResult {
  lines: ScoreLine[];
  matchedCount: number;
  totalCount: number;
  accuracyPct: number; // matchedCount / totalCount, rounded
  final: {
    filedRefundOrDue: number | null; // line34 - line37 as the filer reported it
    correctRefundOrDue: number; // engine's refundOrDue (positive = refund)
    match: boolean;
    delta: number; // correct - filed: extra refund (or reduced amount owed) we found
  };
}

function dollarsEqual(a: number, b: number): boolean {
  return Math.round(a) === Math.round(b);
}

// Compare the filer's self-reported lines against the engine's recomputation
// of the same return from their income documents.
export function scoreFiled1040NR(filed: Filed1040NR, income: IncomeEngineResult): ScoreResult {
  const nonWageWithholding = income.interestWithheld + income.dividendsWithheld + income.capitalGainsWithheld;

  // Each row pairs a filed line with the engine value that belongs on it —
  // the same mapping lib/rules/forms/f1040nr.ts uses to FILL these lines.
  const rows: { line: string; label: string; filed: number | null; correct: number }[] = [
    { line: "1a", label: "Wages (line 1a)", filed: filed.line1a, correct: income.wagesTaxable },
    { line: "8", label: "Taxable scholarship (line 8)", filed: filed.line8, correct: income.scholarshipTaxable },
    { line: "9", label: "Total income (line 9)", filed: filed.line9, correct: income.effectivelyConnectedIncome },
    { line: "12", label: "Deduction (line 12)", filed: filed.line12, correct: income.deduction },
    { line: "15", label: "Taxable income (line 15)", filed: filed.line15, correct: income.taxableIncome },
    { line: "16", label: "Tax (line 16)", filed: filed.line16, correct: income.effectivelyConnectedTax },
    { line: "23a", label: "Schedule NEC tax (line 23a)", filed: filed.line23a, correct: income.necTax },
    { line: "24", label: "Total tax (line 24)", filed: filed.line24, correct: income.totalTax },
    { line: "25d", label: "Withholding — W-2/1099 (line 25d)", filed: filed.line25d, correct: income.wagesWithheld + nonWageWithholding },
    { line: "25g", label: "Withholding — 1042-S (line 25g)", filed: filed.line25g, correct: income.scholarship1042SWithheld },
    { line: "33", label: "Total payments (line 33)", filed: filed.line33, correct: income.totalWithholding },
  ];

  const lines: ScoreLine[] = rows.map((row) => {
    const filedVal = row.filed ?? 0;
    return {
      ...row,
      match: dollarsEqual(filedVal, row.correct),
      delta: Math.round(row.correct - filedVal),
    };
  });

  const matchedCount = lines.filter((l) => l.match).length;
  const totalCount = lines.length;

  // The filer's bottom line: refund (line 34) is positive, amount owed (line
  // 37) is negative — same sign convention as the engine's refundOrDue.
  const filedRefundOrDue =
    filed.line34 != null || filed.line37 != null ? (filed.line34 ?? 0) - (filed.line37 ?? 0) : null;
  const correctRefundOrDue = income.refundOrDue;

  return {
    lines,
    matchedCount,
    totalCount,
    accuracyPct: Math.round((matchedCount / totalCount) * 100),
    final: {
      filedRefundOrDue,
      correctRefundOrDue,
      match: dollarsEqual(filedRefundOrDue ?? 0, correctRefundOrDue),
      delta: Math.round(correctRefundOrDue - (filedRefundOrDue ?? 0)),
    },
  };
}
