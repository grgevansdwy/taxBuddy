import type { F1099BData, F1099DAData } from "@/lib/types";

// realizedGainLoss is arithmetic, never AI-extracted or client-supplied, so it
// can't diverge from the numbers it summarizes. It's the ALLOWED gain/loss:
// proceeds - costBasis, plus any wash-sale loss disallowed added back. A
// disallowed loss isn't deductible, so adding it back raises the taxable gain —
// this is what makes the capital-gains total foot to the 1099's own "Net gain
// or loss" grand total (which likewise adds box 1g/1i back to proceeds - cost).
// Shared by app/api/documents/income/route.ts (persist time) so 1099-B and
// 1099-DA lots are derived identically.
export function withRealizedGainLoss<T extends F1099BData | F1099DAData>(docs: T[]): T[] {
  return docs.map((doc) => ({
    ...doc,
    transactions: doc.transactions.map((tx) => ({
      ...tx,
      realizedGainLoss: tx.proceeds - tx.costBasis + (tx.washSaleLossDisallowed ?? 0),
    })),
  }));
}
