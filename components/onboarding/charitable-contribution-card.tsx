"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// Controlled currency field for the interview form. It owns only the formatted
// display string (and cursor bookkeeping); the numeric value lives in the
// parent and is saved with the rest of the interview form on Continue — no
// separate save/confirm step of its own.

// Formats a raw typed value into "$1,234.56" as the user types — strips
// anything that isn't a digit or the first decimal point, caps decimals at
// 2 places, and inserts thousands separators.
function formatCurrency(raw: string): string {
  let cleaned = raw.replace(/[^0-9.]/g, "");
  const firstDot = cleaned.indexOf(".");
  if (firstDot !== -1) {
    cleaned = cleaned.slice(0, firstDot + 1) + cleaned.slice(firstDot + 1).replace(/\./g, "");
  }
  if (cleaned === "" || cleaned === ".") return "";

  const [rawInt, rawDec] = cleaned.split(".");
  const intPart = (rawInt || "0").replace(/^0+(?=\d)/, "").replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const decPart = rawDec !== undefined ? rawDec.slice(0, 2) : undefined;

  return `$${intPart}${decPart !== undefined ? `.${decPart}` : ""}`;
}

function parseCurrency(formatted: string): number {
  return Number(formatted.replace(/[^0-9.]/g, "")) || 0;
}

// Stage 3 "Tax Reduction" ask (AI Agent Tax Business Proposal.pdf) — the one
// manual figure Schedule A / the standard-deduction comparison need.
export function CharitableContributionCard({
  value,
  onChange,
}: {
  value: number;
  onChange: (amount: number) => void;
}) {
  const [amount, setAmount] = useState(() => formatCurrency(String(value || "")));

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const input = e.target;
    const cursorPos = input.selectionStart ?? input.value.length;
    const digitsBeforeCursor = input.value.slice(0, cursorPos).replace(/[^0-9]/g, "").length;

    const formatted = formatCurrency(input.value);
    const totalDigits = (formatted.match(/[0-9]/g) ?? []).length;

    // Cursor was at or past the last digit (typing/deleting at the end, the
    // common case) — always land at the true end, past any trailing "." or
    // "," the formatter added. Using the digit-counting loop here too would
    // stop right after the last digit and land *before* a trailing decimal
    // point, so the next keystroke would insert into the integer part.
    let newPos: number;
    if (formatted === "") {
      newPos = 0;
    } else if (digitsBeforeCursor >= totalDigits) {
      newPos = formatted.length;
    } else if (digitsBeforeCursor === 0) {
      newPos = 1; // right after "$"
    } else {
      newPos = formatted.length;
      let seen = 0;
      for (let i = 0; i < formatted.length; i++) {
        if (/[0-9]/.test(formatted[i])) seen++;
        if (seen === digitsBeforeCursor) {
          newPos = i + 1;
          break;
        }
      }
    }

    input.value = formatted;
    input.setSelectionRange(newPos, newPos);
    setAmount(formatted);
    onChange(parseCurrency(formatted));
  }

  return (
    <div className="space-y-2">
      <Label htmlFor="charitable-contributions">
        Did you make any charitable contributions (cash or check) to a US charity this year?
      </Label>
      <p className="text-xs text-muted-foreground">Enter 0 if none — this affects your itemized deduction.</p>
      <Input
        id="charitable-contributions"
        type="text"
        inputMode="decimal"
        placeholder="$0.00"
        value={amount}
        onChange={handleChange}
      />
    </div>
  );
}
