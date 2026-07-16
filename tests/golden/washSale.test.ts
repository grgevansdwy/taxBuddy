import { describe, it, expect } from "vitest";
import { withRealizedGainLoss } from "@/lib/rules/capitalGains";
import type { F1099BData, F1099DAData } from "@/lib/types";

// These numbers are the real Robinhood consolidated 1099 grand totals (see
// "Robinhood Markets Consolidated Form 1099.pdf"), the case that exposed both
// bugs. They stand in for the per-lot sums so the test asserts the exact
// figures the form should show.
const STOCK_PROCEEDS = 64_393.51;
const STOCK_COST = 62_876.31;
const STOCK_WASH = 477.92; // box 1g wash-sale loss disallowed
const CRYPTO_PROCEEDS = 4_734.51;
const CRYPTO_COST = 4_499.71;

function mkDoc<T extends F1099BData | F1099DAData>(
  proceeds: number,
  costBasis: number,
  washSaleLossDisallowed: number
): T {
  return {
    payerName: "Robinhood",
    transactions: [
      {
        description: "lot",
        dateAcquired: "2025-01-01",
        dateSold: "2025-06-01",
        proceeds,
        costBasis,
        washSaleLossDisallowed,
        realizedGainLoss: 0, // recomputed by withRealizedGainLoss
        isShortTerm: true,
        box4FederalTaxWithheld: 0,
      },
    ],
  } as T;
}

describe("withRealizedGainLoss (wash-sale add-back)", () => {
  it("adds a disallowed loss back into the allowed gain (a loss becomes a smaller loss / a gain)", () => {
    // proceeds - cost = -300 (a $300 loss), but $500 of it is a disallowed
    // wash sale, so the allowed loss is only -300 + 500 = +200.
    const [doc] = withRealizedGainLoss([mkDoc<F1099BData>(700, 1000, 500)]);
    expect(doc.transactions[0].realizedGainLoss).toBe(200);
  });

  it("is a no-op when there's no wash sale (allowed = proceeds - cost)", () => {
    const [doc] = withRealizedGainLoss([mkDoc<F1099BData>(500, 300, 0)]);
    expect(doc.transactions[0].realizedGainLoss).toBe(200);
  });

  it("reaches the 1099-B's own Net gain grand total (1,995.12), not the raw proceeds - cost (1,517.20)", () => {
    const [doc] = withRealizedGainLoss([mkDoc<F1099BData>(STOCK_PROCEEDS, STOCK_COST, STOCK_WASH)]);
    // proceeds - cost = 1,517.20; + wash 477.92 = 1,995.12
    expect(Math.round(doc.transactions[0].realizedGainLoss * 100) / 100).toBe(1_995.12);
  });
});

describe("Robinhood consolidated 1099 nets to the correct taxable capital gain", () => {
  // Bug A guarded the extractor so crypto rows land ONLY in f1099das, never
  // also in f1099bs. Here the arrays are disjoint (stock in B, crypto in DA),
  // as a correct extraction produces — the crypto gain must be counted once.
  it("stock (with wash sale) + crypto = 2,229.92, counting crypto exactly once", () => {
    const bs = withRealizedGainLoss([mkDoc<F1099BData>(STOCK_PROCEEDS, STOCK_COST, STOCK_WASH)]);
    const das = withRealizedGainLoss([mkDoc<F1099DAData>(CRYPTO_PROCEEDS, CRYPTO_COST, 0)]);

    const net = [...bs, ...das]
      .flatMap((doc) => doc.transactions)
      .reduce((sum, tx) => sum + tx.realizedGainLoss, 0);

    expect(Math.round(net * 100) / 100).toBe(2_229.92); // NOT 1,986.80 (crypto twice) or 1,752.01 (no wash sale)
  });
});
