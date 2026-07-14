import { z } from "zod";

// Output contract for the 1099-INT extraction spec in lib/ai/extractionSpecs.ts.
// Maps 1:1 onto F1099INTData in lib/types.ts. Brokers often issue one
// "Consolidated 1099" PDF covering INT/DIV/B sections together, and not
// every section is always present — sectionPresent lets the caller tell a
// real "no interest income" from "this document doesn't have an INT section
// at all," instead of fabricating a $0 entry for a section that isn't there.
export const F1099IntExtractionSchema = z.object({
  sectionPresent: z.boolean(),
  payerName: z.string(),
  payerEin: z.string(),
  box1InterestIncome: z.number(),
  box4FederalTaxWithheld: z.number(),
  box8TaxExemptInterest: z.number(),
  confidence: z.number().min(0).max(1),
});

export type F1099IntExtraction = z.infer<typeof F1099IntExtractionSchema>;
