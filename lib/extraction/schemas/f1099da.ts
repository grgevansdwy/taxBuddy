import { z } from "zod";

// Output contract for the 1099-DA extraction spec in lib/ai/extractionSpecs.ts.
// Form 1099-DA (Digital Asset Proceeds From Broker Transactions) is the new
// crypto/digital-asset counterpart to Form 1099-B — same shape deliberately,
// since Schedule NEC line 16 ("Capital Gains and Losses") doesn't distinguish
// a stock sale from a digital-asset disposal; both just need a description,
// dates, proceeds, and cost basis. realizedGainLoss is NOT extracted, for the
// same reason as f1099b.ts: derived downstream as proceeds - costBasis so a
// mis-read figure can never diverge from the two numbers it summarizes.
export const F1099DAExtractionSchema = z.object({
  sectionPresent: z.boolean(),
  payerName: z.string(),
  transactions: z.array(
    z.object({
      description: z.string(), // e.g. "Bitcoin" or "0.031 BTC"
      dateAcquired: z.string().nullable(), // ISO yyyy-mm-dd, null if "various"/unknown
      dateSold: z.string(), // ISO yyyy-mm-dd
      proceeds: z.number(),
      costBasis: z.number(),
      washSaleLossDisallowed: z.number(), // box 1i (digital-asset wash sale); 0 if none
      isShortTerm: z.boolean(),
      box4FederalTaxWithheld: z.number(),
    })
  ),
  confidence: z.number().min(0).max(1),
});

export type F1099DAExtraction = z.infer<typeof F1099DAExtractionSchema>;
