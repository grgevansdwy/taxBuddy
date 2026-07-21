import { describe, it, expect } from "vitest";
import { withRealizedGainLoss, reconcileCapitalGainsTotals } from "@/lib/rules/capitalGains";
import type { F1099BData, F1099BTransaction } from "@/lib/types";

// Real lots from "Robinhood Markets Consolidated Form 1099.pdf". This statement
// prints "..." in the wash-sale column for lots with no wash sale, so the
// extractor sometimes copied the ADJACENT "Gain or loss" value into
// washSaleLossDisallowed — which then gets added back and DOUBLES the gain
// (Amazon 31.01 -> 62.02, Apple 322.54 -> 645.08). withRealizedGainLoss now
// reconciles the derived figure against the broker's printed reportedGainLoss
// and drops the phantom wash sale. See lib/rules/capitalGains.ts.

function lot(fields: Partial<F1099BTransaction> & { proceeds: number; costBasis: number }): F1099BTransaction {
  return {
    description: "lot",
    dateAcquired: "2025-01-21",
    dateSold: "2025-01-30",
    washSaleLossDisallowed: 0,
    realizedGainLoss: 0,
    reportedGainLoss: null,
    isShortTerm: true,
    box4FederalTaxWithheld: 0,
    ...fields,
  };
}

function doc(...transactions: F1099BTransaction[]): F1099BData {
  return { payerName: "Robinhood", transactions };
}

describe("withRealizedGainLoss reconciles against the broker's printed gain/loss", () => {
  it("drops a phantom wash sale (extractor copied the gain into box 1g)", () => {
    // Amazon 01/30: proceeds 1,175.81, cost 1,144.80, printed gain 31.01, no
    // real wash sale — but box 1g was mis-read as 31.01. Without the fix the
    // derived gain would be 62.02.
    const [d] = withRealizedGainLoss([
      doc(lot({ proceeds: 1175.81, costBasis: 1144.8, washSaleLossDisallowed: 31.01, reportedGainLoss: 31.01 })),
    ]);
    expect(d.transactions[0].washSaleLossDisallowed).toBe(0);
    expect(round2(d.transactions[0].realizedGainLoss)).toBe(31.01);
  });

  it("drops a phantom wash sale on a larger lot (Apple, 322.54 not 645.08)", () => {
    const [d] = withRealizedGainLoss([
      doc(lot({ proceeds: 3682.54, costBasis: 3360.0, washSaleLossDisallowed: 322.54, reportedGainLoss: 322.54 })),
    ]);
    expect(d.transactions[0].washSaleLossDisallowed).toBe(0);
    expect(round2(d.transactions[0].realizedGainLoss)).toBe(322.54);
  });

  it("keeps a REAL wash sale that foots to the printed figure (Micron 02/18)", () => {
    // proceeds 2,669.67, cost 2,418.70 -> raw 250.97; box 1g 21.73 'W' is real,
    // and raw + wash = 272.70 = the printed gain, so it must be kept.
    const [d] = withRealizedGainLoss([
      doc(lot({ proceeds: 2669.67, costBasis: 2418.7, washSaleLossDisallowed: 21.73, reportedGainLoss: 272.7 })),
    ]);
    expect(round2(d.transactions[0].washSaleLossDisallowed)).toBe(21.73);
    expect(round2(d.transactions[0].realizedGainLoss)).toBe(272.7);
  });

  it("nets the three lots to 626.25 (phantom wash sales removed), not 1,240.26", () => {
    const [d] = withRealizedGainLoss([
      doc(
        lot({ proceeds: 1175.81, costBasis: 1144.8, washSaleLossDisallowed: 31.01, reportedGainLoss: 31.01 }),
        lot({ proceeds: 3682.54, costBasis: 3360.0, washSaleLossDisallowed: 322.54, reportedGainLoss: 322.54 }),
        lot({ proceeds: 2669.67, costBasis: 2418.7, washSaleLossDisallowed: 21.73, reportedGainLoss: 272.7 }),
      ),
    ]);
    const net = d.transactions.reduce((sum, tx) => sum + tx.realizedGainLoss, 0);
    expect(round2(net)).toBe(626.25); // 31.01 + 322.54 + 272.70
  });

  it("falls back to the plain derivation when reportedGainLoss is absent (older data)", () => {
    // No reportedGainLoss -> derive as proceeds - cost + wash, unchanged behavior.
    const [d] = withRealizedGainLoss([
      doc(lot({ proceeds: 700, costBasis: 1000, washSaleLossDisallowed: 500, reportedGainLoss: null })),
    ]);
    expect(d.transactions[0].realizedGainLoss).toBe(200); // -300 + 500
  });
});

describe("reconcileCapitalGainsTotals (document-level backstop)", () => {
  it("returns null when no document printed a grand total (no false alarms)", () => {
    const d = doc(lot({ proceeds: 500, costBasis: 300, reportedGainLoss: 200 }));
    expect(reconcileCapitalGainsTotals([d])).toBeNull();
  });

  it("foots when the summed lots match the broker's printed total", () => {
    const d: F1099BData = {
      payerName: "Robinhood",
      reportedNetGainLoss: 626.25, // 31.01 + 322.54 + 272.70
      transactions: withRealizedGainLoss([
        doc(
          lot({ proceeds: 1175.81, costBasis: 1144.8, washSaleLossDisallowed: 31.01, reportedGainLoss: 31.01 }),
          lot({ proceeds: 3682.54, costBasis: 3360.0, washSaleLossDisallowed: 322.54, reportedGainLoss: 322.54 }),
          lot({ proceeds: 2669.67, costBasis: 2418.7, washSaleLossDisallowed: 21.73, reportedGainLoss: 272.7 }),
        ),
      ])[0].transactions,
    };
    const result = reconcileCapitalGainsTotals([d]);
    expect(result?.ok).toBe(true);
    expect(round2(result!.delta)).toBe(0);
  });

  it("flags a mismatch when a lot is dropped during extraction", () => {
    // Broker's printed total expects three lots (626.25) but only two survived.
    const d: F1099BData = {
      payerName: "Robinhood",
      reportedNetGainLoss: 626.25,
      transactions: withRealizedGainLoss([
        doc(
          lot({ proceeds: 1175.81, costBasis: 1144.8, reportedGainLoss: 31.01 }),
          lot({ proceeds: 3682.54, costBasis: 3360.0, reportedGainLoss: 322.54 }),
        ),
      ])[0].transactions,
    };
    const result = reconcileCapitalGainsTotals([d]);
    expect(result?.ok).toBe(false);
    expect(round2(result!.actual)).toBe(353.55); // 31.01 + 322.54 — the missing lot's 272.70 is gone
    expect(round2(result!.delta)).toBe(-272.7);
  });
});

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
