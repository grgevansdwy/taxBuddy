import { describe, it, expect } from "vitest";
import { PDFDocument } from "pdf-lib";
import { generateCapitalGainsAttachment } from "@/lib/pdf/generateCapitalGainsAttachment";
import type { F1099BTransaction } from "@/lib/types";

function mkTx(description: string, proceeds: number, costBasis: number): F1099BTransaction {
  return {
    description,
    dateAcquired: "2025-01-01",
    dateSold: "2025-06-01",
    proceeds,
    costBasis,
    washSaleLossDisallowed: 0,
    realizedGainLoss: proceeds - costBasis,
    isShortTerm: true,
    box4FederalTaxWithheld: 0,
  };
}

describe("generateCapitalGainsAttachment", () => {
  it("fits a short list on one page with no thrown errors", async () => {
    const transactions = Array.from({ length: 5 }, (_, i) => mkTx(`Stock ${i}`, 100 + i, 50 + i));
    const bytes = await generateCapitalGainsAttachment({ name: "George E Daenuwy", tin: "128973000", transactions });
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBe(1);
  });

  it("paginates once a page fills up, repeating the header on each page", async () => {
    // Long descriptions (matching real broker output, which includes CUSIP +
    // "Symbol:") force 2-line wraps — this specifically regresses a bug where
    // row height wasn't adjusted for wrapped lines, so a wrapped row overlapped
    // the row below it instead of triggering a new page.
    const transactions = Array.from({ length: 40 }, (_, i) =>
      mkTx(`EXXON MOBIL CORPORATION ${i} COMMON STOCK / CUSIP: 30231G10${i} / Symbol:`, 1000 + i, 900 + i)
    );
    const bytes = await generateCapitalGainsAttachment({ name: "George E Daenuwy", tin: "128973000", transactions });
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBeGreaterThan(1);
  });

  it("handles an empty transaction list without throwing", async () => {
    const bytes = await generateCapitalGainsAttachment({ name: "George E Daenuwy", tin: "128973000", transactions: [] });
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBe(1);
  });
});
