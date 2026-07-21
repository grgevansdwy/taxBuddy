import { z } from "zod";

// Output contract for the 1099-B extraction spec in lib/ai/extractionSpecs.ts.
// realizedGainLoss is deliberately NOT extracted — it's derived downstream as
// proceeds - costBasis + washSaleLossDisallowed (see app/api/documents/income/route.ts)
// so a mis-read gain/loss figure can never diverge from the numbers it summarizes.
// washSaleLossDisallowed (box 1g) IS extracted: a disallowed loss must be added
// back to reach the taxable gain, and it's not derivable from proceeds/basis.
// reportedGainLoss captures the broker's own printed "Gain or loss(-)" column —
// verification-only, used by withRealizedGainLoss to catch a mis-read box 1g,
// never fed into the tax math itself.
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
      washSaleLossDisallowed: z.number(), // box 1g (amount marked "W"); 0 if none
      reportedGainLoss: z.number(), // broker's printed "Gain or loss(-)" figure — verification-only
      isShortTerm: z.boolean(), // box 2: true if reported as short-term
      box4FederalTaxWithheld: z.number(),
    })
  ),
  // The section's printed grand-total net gain/loss ("Totals"/"Grand total"
  // row), if the page shows one; null otherwise. Used only to reconcile the
  // summed lots downstream — never fed into the tax math.
  reportedNetGainLoss: z.number().nullable(),
  confidence: z.number().min(0).max(1),
});

export type F1099BExtraction = z.infer<typeof F1099BExtractionSchema>;
