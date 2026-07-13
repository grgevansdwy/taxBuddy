import { z } from "zod";

// Output contract for the 1042-S extraction tool call in lib/ai/extractF1042S.ts.
// Maps 1:1 onto F1042SData in lib/types.ts. One 1042-S document → one record;
// a student with multiple 1042-S forms extracts each separately.
export const F1042SExtractionSchema = z.object({
  incomeCode: z.string(), // box 1, e.g. "16" = scholarship/fellowship, "20" = wages under treaty
  grossIncome: z.number(), // box 2
  exemptionCode: z.string().nullable(), // box 3a — chapter 3 exemption code, null if not exempt
  exemptionRate: z.number().nullable(), // box 3b — treaty rate, e.g. 0.00 for fully exempt
  taxWithheld: z.number(), // box 7a — federal tax withheld
  countryCode: z.string(), // box 12f — recipient's country code
  withholdingCredit: z.number(), // box 10 — total withholding credit
  confidence: z.number().min(0).max(1),
});

export type F1042SExtraction = z.infer<typeof F1042SExtractionSchema>;
