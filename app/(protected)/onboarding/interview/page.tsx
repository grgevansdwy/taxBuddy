"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { WizardShell } from "@/components/onboarding/wizard-shell";
import { WizardNavRow } from "@/components/onboarding/wizard-nav-row";
import { CharitableContributionCard } from "@/components/onboarding/charitable-contribution-card";
import { CURRENT_SUPPORTED_TAX_YEAR } from "@/lib/config/taxYear";
import { fetchFiling } from "@/lib/client/fetchFiling";
import type { InterviewAnswers } from "@/lib/types";

type YesNo = "yes" | "no";
type ScholarshipCoverage = InterviewAnswers["scholarshipCoverage"];

export default function InterviewPage() {
  const router = useRouter();
  const [isHydrating, setIsHydrating] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [workedInUs, setWorkedInUs] = useState<YesNo>("no");
  const [onOPT, setOnOPT] = useState<YesNo>("no");
  const [scholarshipCoverage, setScholarshipCoverage] = useState<ScholarshipCoverage>("none");
  const [digitalAssets, setDigitalAssets] = useState<YesNo>("no");
  const [interestIncome, setInterestIncome] = useState(false);
  const [dividendIncome, setDividendIncome] = useState(false);
  const [soldAssets, setSoldAssets] = useState(false);

  const [charitableContributions, setCharitableContributions] = useState(0);
  const [charitableConfirmed, setCharitableConfirmed] = useState(false);

  // Rehydrate from Supabase on mount so back-navigation from a later step
  // doesn't show empty fields for work the user already did.
  useEffect(() => {
    fetchFiling()
      .then((data) => {
        const answers = data.interviewAnswers;
        if (answers && Object.keys(answers).length > 0) {
          setWorkedInUs(answers.workedInUs ? "yes" : "no");
          setOnOPT(answers.onOPT ? "yes" : "no");
          if (answers.scholarshipCoverage) setScholarshipCoverage(answers.scholarshipCoverage);
          setInterestIncome(Boolean(answers.interestIncome));
          setDividendIncome(Boolean(answers.dividendIncome));
          setSoldAssets(Boolean(answers.soldAssets));
        }
        if (typeof data.profile?.digitalAssets === "boolean") {
          setDigitalAssets(data.profile.digitalAssets ? "yes" : "no");
        }
        setCharitableContributions(data.charitableContributions ?? 0);
        setCharitableConfirmed(data.charitableContributionsConfirmed ?? false);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Something went wrong."))
      .finally(() => setIsHydrating(false));
  }, []);

  async function handleSubmit() {
    setIsSubmitting(true);
    setError(null);
    try {
      const interview: InterviewAnswers = {
        workedInUs: workedInUs === "yes",
        onOPT: workedInUs === "yes" && onOPT === "yes",
        hasSSN: false,
        hasOrAppliedItin: false,
        scholarshipCoverage,
        interestIncome,
        dividendIncome,
        soldAssets,
      };
      const res = await fetch("/api/documents/checklist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taxYear: CURRENT_SUPPORTED_TAX_YEAR,
          ...interview,
          digitalAssets: digitalAssets === "yes",
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? "Something went wrong.");
      }
      router.push("/onboarding/documents");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isHydrating) {
    return (
      <WizardShell step={3} totalSteps={4} title="A few questions about your year">
        <p className="text-sm text-muted-foreground">Loading...</p>
      </WizardShell>
    );
  }

  return (
    <WizardShell step={3} totalSteps={4} title="A few questions about your year">
      <div className="space-y-6">
        <div className="space-y-2">
          <Label>Did you work in the US this year (on-campus, CPT, or OPT)?</Label>
          <RadioGroup value={workedInUs} onValueChange={(v) => setWorkedInUs(v as YesNo)} className="flex gap-4">
            <label className="flex items-center gap-2 text-sm">
              <RadioGroupItem value="yes" /> Yes
            </label>
            <label className="flex items-center gap-2 text-sm">
              <RadioGroupItem value="no" /> No
            </label>
          </RadioGroup>
        </div>

        {workedInUs === "yes" && (
          <div className="space-y-2">
            <Label>Are you on OPT?</Label>
            <RadioGroup value={onOPT} onValueChange={(v) => setOnOPT(v as YesNo)} className="flex gap-4">
              <label className="flex items-center gap-2 text-sm">
                <RadioGroupItem value="yes" /> Yes
              </label>
              <label className="flex items-center gap-2 text-sm">
                <RadioGroupItem value="no" /> No
              </label>
            </RadioGroup>
          </div>
        )}

        <div className="space-y-2">
          <Label>Did you receive a scholarship or fellowship?</Label>
          <RadioGroup
            value={scholarshipCoverage}
            onValueChange={(v) => setScholarshipCoverage(v as ScholarshipCoverage)}
            className="flex flex-col gap-2"
          >
            <label className="flex items-center gap-2 text-sm">
              <RadioGroupItem value="none" /> No
            </label>
            <label className="flex items-center gap-2 text-sm">
              <RadioGroupItem value="tuition_only" /> Yes, it covered tuition only
            </label>
            <label className="flex items-center gap-2 text-sm">
              <RadioGroupItem value="tuition_and_living" /> Yes, it covered tuition &amp; living expenses
            </label>
          </RadioGroup>
        </div>

        <div className="space-y-2">
          <Label>Did you receive, sell, or exchange any digital assets (crypto) this year?</Label>
          <p className="text-xs text-muted-foreground">
            Required on every return regardless of amount — includes receiving, selling, trading, or being paid in
            crypto. This is different from selling investments for a gain, which we&apos;ll ask about next.
          </p>
          <RadioGroup value={digitalAssets} onValueChange={(v) => setDigitalAssets(v as YesNo)} className="flex gap-4">
            <label className="flex items-center gap-2 text-sm">
              <RadioGroupItem value="yes" /> Yes
            </label>
            <label className="flex items-center gap-2 text-sm">
              <RadioGroupItem value="no" /> No
            </label>
          </RadioGroup>
        </div>

        <div className="space-y-2">
          <Label>Did you earn any interest, dividends, or investment income in the US?</Label>
          <p className="text-xs text-muted-foreground">
            This is about income from investments, separate from the digital-assets question you already
            answered — check any that apply and we&apos;ll request the matching tax form.
          </p>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={interestIncome} onCheckedChange={(c) => setInterestIncome(c === true)} />
            Bank interest (savings, CDs, high-yield accounts)
          </label>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={dividendIncome} onCheckedChange={(c) => setDividendIncome(c === true)} />
            Dividends
          </label>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={soldAssets} onCheckedChange={(c) => setSoldAssets(c === true)} />
            Sold stocks, crypto, or other assets (for a gain or loss)
          </label>
        </div>

        <CharitableContributionCard
          initialValue={charitableContributions}
          wasAlreadySaved={charitableConfirmed}
          onConfirmed={() => setCharitableConfirmed(true)}
        />

        {error && <p className="text-sm text-destructive">{error}</p>}

        <WizardNavRow
          step={3}
          onContinue={handleSubmit}
          continueLabel={isSubmitting ? "Working it out..." : "Continue"}
          disabled={isSubmitting || !charitableConfirmed}
        />
      </div>
    </WizardShell>
  );
}
