import { describe, it, expect } from "vitest";
import { computeIncomeEngine } from "@/lib/rules/income";
import { computeF1040NR } from "@/lib/rules/forms/f1040nr";
import { PROVENANCE_1040NR, CONDITIONAL_RESULT_KEYS } from "@/lib/audit/provenance1040nr";
import { engineArgs, profile } from "@/lib/audit/fixtures/indonesiaStudent";

// Drift guard for the Logic Viz audit tool (app/(protected)/dev/logic-viz).
//
// The viz's NUMBERS come live from the engine, so they can never be stale. The
// only hand-authored layer is lib/audit/provenance1040nr.ts (the per-line
// "where does this come from" map). This test keeps that map in lock-step with
// the engine's actual line set: if someone adds/removes/renames a 1040-NR line
// in the engine without updating the provenance map, the build fails here.

const income = computeIncomeEngine(engineArgs);
const lines = computeF1040NR({ profile, income });
const conditional = new Set<string>(CONDITIONAL_RESULT_KEYS);

describe("1040-NR provenance map ↔ engine line set", () => {
  it("every line the engine fills has a provenance entry", () => {
    const missing = Object.keys(lines).filter((key) => !PROVENANCE_1040NR[key]);
    expect(missing, `engine lines with no provenance entry: ${missing.join(", ")}`).toEqual([]);
  });

  it("every provenance entry (except the refund/owe alternatives) is a line the engine actually fills", () => {
    const orphaned = Object.keys(PROVENANCE_1040NR).filter((key) => !(key in lines) && !conditional.has(key));
    expect(orphaned, `provenance entries that no longer map to a filled line: ${orphaned.join(", ")}`).toEqual([]);
  });

  it("exactly one side of the mutually-exclusive refund/owe pair is filled", () => {
    const filledResultKeys = CONDITIONAL_RESULT_KEYS.filter((key) => key in lines);
    // Non-scholarship fixture owes $ → only line 37 is present.
    expect(filledResultKeys).toEqual(["1040nr.37"]);
  });

  it("every 'line' source points at a real provenance key", () => {
    for (const [key, prov] of Object.entries(PROVENANCE_1040NR)) {
      for (const src of prov.sources) {
        if (src.kind !== "line") continue;
        expect(PROVENANCE_1040NR[src.line], `${key} references unknown upstream line ${src.line}`).toBeDefined();
      }
    }
  });

  it("every provenance entry has a non-empty formula and code reference", () => {
    for (const [key, prov] of Object.entries(PROVENANCE_1040NR)) {
      expect(prov.formula.length, `${key} formula`).toBeGreaterThan(0);
      expect(prov.codeRef.length, `${key} codeRef`).toBeGreaterThan(0);
    }
  });

  it("every engineField named in the provenance map exists on the engine result", () => {
    for (const [key, prov] of Object.entries(PROVENANCE_1040NR)) {
      for (const field of prov.engineFields) {
        expect(field in income, `${key} references unknown engine field "${field}"`).toBe(true);
      }
    }
  });
});

// Golden values for THIS fixture — doubles as the worked example the viz shows,
// so a consultant can check the arithmetic and any engine change that moves a
// number surfaces here.
describe("Indonesian non-scholarship fixture — expected 1040-NR values", () => {
  it("wages: $6,000 gross → $2,000 treaty-exempt → $4,000 taxable", () => {
    expect(lines["1040nr.1a"]).toBe("4,000.00");
    expect(lines["1040nr.1k"]).toBe("2,000.00");
  });

  it("no scholarship → line 8 is 0.00, and no Form 8833 is required", () => {
    expect(lines["1040nr.8"]).toBe("0.00");
    expect(income.needsForm8833).toBe(false);
  });

  it("deduction is itemized-only (Indonesia gets no standard deduction)", () => {
    expect(income.usesStandardDeduction).toBe(false);
    expect(lines["1040nr.12"]).toBe("0.00");
    expect(lines["1040nr.15"]).toBe("4,000.00");
  });

  it("Schedule NEC tax flows to line 23a (15% dividends + 30% capital gain)", () => {
    expect(income.dividendsTax).toBe(75); // 500 × 15%
    expect(income.capitalGainsTax).toBe(300); // 1000 × 30%
    expect(lines["1040nr.23a"]).toBe("375.00");
  });

  it("totals: tax, payments, and amount owed", () => {
    expect(lines["1040nr.24"]).toBe("778.00"); // 403 graduated + 375 NEC
    expect(lines["1040nr.25a"]).toBe("600.00");
    expect(lines["1040nr.25b"]).toBe("75.00");
    expect(lines["1040nr.33"]).toBe("675.00");
    expect(lines["1040nr.37"]).toBe("103.00"); // owes 778 − 675
  });

  it("exempt bank interest is seen by the engine but lands on no 1040-NR line", () => {
    expect(income.interestExempt).toBe(200);
    // No line key carries it:
    const carriesInterest = Object.values(lines).includes("200.00");
    expect(carriesInterest).toBe(false);
  });
});
