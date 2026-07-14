"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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
// manual figure Schedule A / the standard-deduction comparison need. Saves
// automatically on blur (no explicit Save button); `confirmed` only flips
// once a save has actually succeeded, so the documents page can gate "File
// your Tax!" on it rather than assuming no donations.
export function CharitableContributionCard({
  initialValue,
  wasAlreadySaved,
  onConfirmed,
}: {
  initialValue: number;
  wasAlreadySaved: boolean;
  onConfirmed: () => void;
}) {
  const [amount, setAmount] = useState(() => formatCurrency(String(initialValue || "")));
  const [confirmed, setConfirmed] = useState(wasAlreadySaved);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    setConfirmed(false);
  }

  async function handleBlur() {
    setIsSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/reduction", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ charitableContributions: parseCurrency(amount) }),
      });
      if (!res.ok) throw new Error("Couldn't save this.");
      setConfirmed(true);
      onConfirmed();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setIsSaving(false);
    }
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
        onBlur={handleBlur}
      />
      {isSaving && <p className="text-xs text-muted-foreground">Saving…</p>}
      {!isSaving && confirmed && <p className="text-xs text-muted-foreground">Saved</p>}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
