import type { F1099BData, F1099DAData } from "@/lib/types";

// Cents-level tolerance for reconciling the derived gain/loss against the
// broker's own printed figure — absorbs rounding, not real differences.
const RECONCILE_TOLERANCE = 0.01;

// realizedGainLoss is arithmetic, never AI-extracted or client-supplied, so it
// can't diverge from the numbers it summarizes. It's the ALLOWED gain/loss:
// proceeds - costBasis, plus any wash-sale loss disallowed added back. A
// disallowed loss isn't deductible, so adding it back raises the taxable gain —
// this is what makes the capital-gains total foot to the 1099's own "Net gain
// or loss" grand total (which likewise adds box 1g/1i back to proceeds - cost).
// Shared by app/api/documents/income/route.ts (persist time) so 1099-B and
// 1099-DA lots are derived identically.
//
// Guardrail: box 1g (wash sale loss disallowed) is the one flaky input here —
// when the broker prints "..." in that column, the extractor sometimes grabs
// the number in the ADJACENT "Gain or loss" column instead, which then gets
// added back and roughly DOUBLES the lot's gain. The broker also prints the
// allowed gain/loss itself (reportedGainLoss), which the reader gets right, so
// we reconcile against it: pick whichever wash-sale interpretation foots to the
// broker's number, and zero out a phantom wash sale. Reported is only a CHECK —
// realizedGainLoss stays a derived quantity, never the raw extracted figure.
export function withRealizedGainLoss<T extends F1099BData | F1099DAData>(docs: T[]): T[] {
  return docs.map((doc) => ({
    ...doc,
    transactions: doc.transactions.map((tx) => {
      const raw = tx.proceeds - tx.costBasis; // gain/loss before any wash-sale add-back
      const wash = tx.washSaleLossDisallowed ?? 0;
      const reported = tx.reportedGainLoss;

      if (reported != null) {
        // Extracted wash sale already foots to the broker's figure → trust it.
        if (Math.abs(raw + wash - reported) <= RECONCILE_TOLERANCE) {
          return { ...tx, washSaleLossDisallowed: wash, realizedGainLoss: raw + wash };
        }
        // Raw gain/loss alone foots → there was no real wash sale; the extracted
        // box 1g was a phantom copy of the gain/loss column. Drop it.
        if (Math.abs(raw - reported) <= RECONCILE_TOLERANCE) {
          return { ...tx, washSaleLossDisallowed: 0, realizedGainLoss: raw };
        }
        // Neither foots: proceeds/basis (or the reported figure itself) was
        // mis-read. Fall through to the plain derivation as a best effort — the
        // document-level total is the backstop for this rarer case.
      }

      return { ...tx, realizedGainLoss: raw + wash };
    }),
  }));
}

export interface CapitalGainsReconciliation {
  ok: boolean;
  expected: number; // Σ of the brokers' own printed section totals
  actual: number; // Σ realizedGainLoss over those same documents' lots
  delta: number; // actual − expected (0 when they foot)
}

// Document-level backstop to the per-lot reconciliation above: compares the sum
// of the extracted lots against the broker's own printed grand-total net
// gain/loss. Because that total is independent of the individual rows, it
// catches DROPPED or DUPLICATED lots — which the per-row reportedGainLoss check
// can't see (a missing row is missing from both sides of that comparison).
// Only documents that actually printed a total participate; returns null when
// none did, so this never fires a false alarm on statements without one.
export function reconcileCapitalGainsTotals(
  docs: (F1099BData | F1099DAData)[]
): CapitalGainsReconciliation | null {
  const checkable = docs.filter((doc) => doc.reportedNetGainLoss != null);
  if (checkable.length === 0) return null;

  const round2 = (n: number) => Math.round(n * 100) / 100;
  const expected = round2(checkable.reduce((s, doc) => s + (doc.reportedNetGainLoss ?? 0), 0));
  const actual = round2(
    checkable.flatMap((doc) => doc.transactions).reduce((s, tx) => s + tx.realizedGainLoss, 0)
  );
  const delta = round2(actual - expected);
  return { ok: Math.abs(delta) <= RECONCILE_TOLERANCE, expected, actual, delta };
}
