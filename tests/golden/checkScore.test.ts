import { describe, it, expect } from "vitest";
import { runFunnelEngine } from "@/lib/check/engine";
import { scoreFiled1040NR, type Filed1040NR } from "@/lib/check/f1040nrScoring";
import { fingerprintSsn, normalizeSsn, extractSsnFromMarkdown } from "@/lib/check/fingerprint";

// Scoring is pure (no LLM): given the numbers a filer wrote and the income
// docs, the engine recomputes the correct return and we diff them. This
// guards the mapping and the "final value" the funnel promises.
describe("scoreFiled1040NR", () => {
  // Indonesia F-1, $30k wages / $2,500 withheld. Indonesia has no standard
  // deduction and no wage exemption over $2,000... actually Art 19(1)(b)(iii)
  // exempts $2,000 of wages. Engine: wagesTaxable $28,000, no deduction.
  const income = runFunnelEngine({
    country: "Indonesia",
    w2s: [{ employerName: "UIUC", employerEin: "1", employerAddress: "", box1: 30000, box2: 2500, box3: 0, box4: 0, box5: 0, box6: 0, box15State: null, box17StateTaxWithheld: null }],
  });

  it("flags the line the filer got wrong and computes the extra refund", () => {
    // Filer forgot the $2,000 wage-treaty exemption: reported full $30k wages,
    // no deduction, and computed tax/refund off that.
    const filed: Filed1040NR = {
      tin: "123-45-6789",
      line1a: 30000, // WRONG — should be 28,000 (treaty)
      line8: 0,
      line9: 30000, // WRONG
      line12: 0,
      line15: 30000, // WRONG
      line16: income.effectivelyConnectedTax + 240, // roughly higher tax
      line23a: 0,
      line24: income.effectivelyConnectedTax + 240,
      line25d: 2500,
      line25g: 0,
      line33: 2500,
      line34: 0, // refund they claimed
      line37: null,
      confidence: 1,
    };

    const result = scoreFiled1040NR(filed, income);
    const byLine = Object.fromEntries(result.lines.map((l) => [l.line, l]));

    // Wages line is flagged, and the delta points to the $2,000 exemption.
    expect(byLine["1a"].match).toBe(false);
    expect(byLine["1a"].correct).toBe(28000);
    expect(byLine["1a"].delta).toBe(-2000); // correct is $2,000 lower than filed

    // Withholding lines match (they read those straight off the W-2).
    expect(byLine["25d"].match).toBe(true);

    // Bottom line: engine says a bigger refund than the filer claimed.
    expect(result.final.correctRefundOrDue).toBe(income.refundOrDue);
    expect(result.final.delta).toBe(Math.round(income.refundOrDue - 0));
    expect(result.matchedCount).toBeLessThan(result.totalCount);
  });

  it("a perfectly-filed return scores 100% with a zero final delta", () => {
    const nonWage = income.interestWithheld + income.dividendsWithheld + income.capitalGainsWithheld;
    const filed: Filed1040NR = {
      tin: "123-45-6789",
      line1a: income.wagesTaxable,
      line8: income.scholarshipTaxable,
      line9: income.effectivelyConnectedIncome,
      line12: income.deduction,
      line15: income.taxableIncome,
      line16: income.effectivelyConnectedTax,
      line23a: income.necTax,
      line24: income.totalTax,
      line25d: income.wagesWithheld + nonWage,
      line25g: income.scholarship1042SWithheld,
      line33: income.totalWithholding,
      line34: income.refundOrDue >= 0 ? income.refundOrDue : 0,
      line37: income.refundOrDue < 0 ? -income.refundOrDue : 0,
      confidence: 1,
    };

    const result = scoreFiled1040NR(filed, income);
    expect(result.matchedCount).toBe(result.totalCount);
    expect(result.accuracyPct).toBe(100);
    expect(result.final.match).toBe(true);
    expect(result.final.delta).toBe(0);
  });
});

describe("SSN fingerprint (privacy dedup)", () => {
  it("normalizes only genuine 9-digit values", () => {
    expect(normalizeSsn("123-45-6789")).toBe("123456789");
    expect(normalizeSsn("123 45 6789")).toBe("123456789");
    expect(normalizeSsn("12-3456789")).toBe("123456789");
    expect(normalizeSsn("1234")).toBeNull();
    expect(normalizeSsn("")).toBeNull();
  });

  it("pulls a dashed SSN out of document markdown but not an EIN", () => {
    expect(extractSsnFromMarkdown("Employee SSN 987-65-4321 blah")).toBe("987654321");
    expect(extractSsnFromMarkdown("Employer EIN 12-3456789")).toBeNull(); // EIN is 2-7, not 3-2-4
    expect(extractSsnFromMarkdown("no id here")).toBeNull();
  });

  it("is deterministic, keyed, and irreversible-shaped (hex digest, same in → same out)", () => {
    process.env.CHECK_FINGERPRINT_SECRET = "test-pepper";
    const a = fingerprintSsn("123-45-6789");
    const b = fingerprintSsn("123456789");
    expect(a).toBe(b); // normalization means dashed and bare match
    expect(a).toMatch(/^[a-f0-9]{64}$/); // SHA-256 hex, not the SSN itself
    expect(a).not.toContain("123456789");

    // Different pepper → different digest (proves it's actually keyed).
    process.env.CHECK_FINGERPRINT_SECRET = "other-pepper";
    expect(fingerprintSsn("123-45-6789")).not.toBe(a);
  });

  it("returns null (skip dedup) when the SSN or pepper is unusable", () => {
    process.env.CHECK_FINGERPRINT_SECRET = "test-pepper";
    expect(fingerprintSsn("1234")).toBeNull();
    delete process.env.CHECK_FINGERPRINT_SECRET;
    expect(fingerprintSsn("123-45-6789")).toBeNull();
  });
});
