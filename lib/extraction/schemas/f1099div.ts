import { z } from "zod";

// Output contract for the 1099-DIV extraction spec in lib/ai/extractionSpecs.ts.
// Maps 1:1 onto F1099DIVData in lib/types.ts. See f1099int.ts's comment on
// sectionPresent — same "Consolidated 1099" reasoning applies here.
export const F1099DivExtractionSchema = z.object({
  sectionPresent: z.boolean(),
  payerName: z.string(),
  payerEin: z.string(),
  box1aTotalOrdinaryDividends: z.number(),
  box1bQualifiedDividends: z.number(),
  box4FederalTaxWithheld: z.number(),
  confidence: z.number().min(0).max(1),
});

export type F1099DivExtraction = z.infer<typeof F1099DivExtractionSchema>;
