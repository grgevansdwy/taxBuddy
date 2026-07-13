"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// Stage 3 "Tax Reduction" ask (AI Agent Tax Business Proposal.pdf) — the one
// manual figure Schedule A / the standard-deduction comparison need. Shown
// as an explicit ASK + Save, not a silently-defaulted 0: `confirmed` only
// flips once the user has actually pressed Save, so the documents page can
// gate "File your Tax!" on it rather than assuming no donations.
export function CharitableContributionCard({
  initialValue,
  wasAlreadySaved,
  onConfirmed,
}: {
  initialValue: number;
  wasAlreadySaved: boolean;
  onConfirmed: () => void;
}) {
  const [amount, setAmount] = useState(String(initialValue || ""));
  const [confirmed, setConfirmed] = useState(wasAlreadySaved);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setIsSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/reduction", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ charitableContributions: Number(amount) || 0 }),
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
    <div className="space-y-2 rounded-2xl border border-input bg-input/10 px-4 py-4">
      <Label htmlFor="charitable-contributions">
        Did you make any charitable contributions (cash or check) to a US charity this year?
      </Label>
      <p className="text-xs text-muted-foreground">Enter 0 if none — this affects your itemized deduction.</p>
      <div className="flex items-end gap-2">
        <div className="flex-1 space-y-1">
          <Input
            id="charitable-contributions"
            type="number"
            value={amount}
            onChange={(e) => {
              setAmount(e.target.value);
              setConfirmed(false);
            }}
          />
        </div>
        <Button type="button" size="sm" onClick={handleSave} disabled={isSaving}>
          {isSaving ? "Saving..." : confirmed ? "Saved ✓" : "Save"}
        </Button>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
