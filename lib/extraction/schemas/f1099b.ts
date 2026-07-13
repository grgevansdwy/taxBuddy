import { z } from "zod";

// Output contract for the 1099-B extraction tool call in lib/ai/extractF1099B.ts.
// realizedGainLoss is deliberately NOT extracted — it's derived downstream as
// proceeds - costBasis (see lib/rules/forms/scheduleNEC.ts) so a mis-read gain/loss
// figure can never diverge from the two numbers it's supposed to summarize.
// See f1099int.ts's comment on sectionPresent — same "Consolidated 1099" reasoning applies here.
export const F1099BExtractionSchema = z.object({
  sectionPresent: z.boolean(),
  payerName: z.string(),
  transactions: z.array(
    z.object({
      description: z.string(), // e.g. "100 sh. AAPL"
      dateAcquired: z.string().nullable(), // ISO yyyy-mm-dd, null if "various"/inherited
      dateSold: z.string(), // ISO yyyy-mm-dd
      proceeds: z.number(), // box 1d
      costBasis: z.number(), // box 1e
      isShortTerm: z.boolean(), // box 2: true if reported as short-term
      box4FederalTaxWithheld: z.number(),
    })
  ),
  confidence: z.number().min(0).max(1),
});

export type F1099BExtraction = z.infer<typeof F1099BExtractionSchema>;
