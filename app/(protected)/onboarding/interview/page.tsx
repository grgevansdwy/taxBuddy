"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { WizardShell } from "@/components/onboarding/wizard-shell";
import { WizardNavRow } from "@/components/onboarding/wizard-nav-row";
import { CharitableContributionCard } from "@/components/onboarding/charitable-contribution-card";
import { W2Slot } from "@/components/onboarding/income-docs/w2-slot";
import { Consolidated1099Slot } from "@/components/onboarding/income-docs/consolidated-1099-slot";
import { Income1042SSlot } from "@/components/onboarding/income-docs/income-1042s-slot";
import { CURRENT_SUPPORTED_TAX_YEAR } from "@/lib/config/taxYear";
import { fetchFiling } from "@/lib/client/fetchFiling";
import type {
  F1042SData,
  F1099BData,
  F1099DAData,
  F1099DIVData,
  F1099INTData,
  InterviewAnswers,
  W2Data,
} from "@/lib/types";

type YesNo = "yes" | "no";
// "" = not yet answered; we no longer pre-select a default so the user has to
// choose each answer themselves.
type YesNoUnset = YesNo | "";
type ScholarshipCoverage = InterviewAnswers["scholarshipCoverage"];

export default function InterviewPage() {
  const router = useRouter();
  const [isHydrating, setIsHydrating] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [workedInUs, setWorkedInUs] = useState<YesNoUnset>("");
  const [onOPT, setOnOPT] = useState<YesNoUnset>("");
  const [scholarshipCoverage, setScholarshipCoverage] = useState<ScholarshipCoverage | "">("");
  const [digitalAssets, setDigitalAssets] = useState<YesNoUnset>("");
  const [interestIncome, setInterestIncome] = useState(false);
  const [dividendIncome, setDividendIncome] = useState(false);
  const [soldAssets, setSoldAssets] = useState(false);

  // Charitable contributions are part of this one form now — a normal field
  // saved with everything else on Continue (previously a separate blur-save to
  // /api/reduction, which made it feel like a different form).
  const [charitableContributions, setCharitableContributions] = useState(0);

  // Income-doc uploads live here, each revealed under the answer that requires
  // it, so parsing overlaps with the rest of this form instead of stalling the
  // Documents step. The slots save straight to the filing (via
  // /api/documents/income); these arrays seed them and stay in sync so we can
  // clear a doc if its triggering answer is later removed.
  const [f1042s, setF1042s] = useState<F1042SData[]>([]);
  const [f1099ints, setF1099ints] = useState<F1099INTData[]>([]);
  const [f1099divs, setF1099divs] = useState<F1099DIVData[]>([]);
  const [f1099bs, setF1099bs] = useState<F1099BData[]>([]);
  const [f1099das, setF1099das] = useState<F1099DAData[]>([]);
  const [w2s, setW2s] = useState<W2Data[]>([]);

  // Whether each income slot has a file mid-parse — combined with the saved-data
  // checks below, this lets the "File" button light up as soon as every required
  // doc is present, and hold the actual filing until parsing lands.
  const [w2Processing, setW2Processing] = useState(false);
  const [f1042sProcessing, setF1042sProcessing] = useState(false);
  const [f1099Processing, setF1099Processing] = useState(false);
  const [isFiling, setIsFiling] = useState(false);
  const filedRef = useRef(false);

  const show1099 = interestIncome || dividendIncome || soldAssets;
  const has1099Data = f1099ints.length + f1099divs.length + f1099bs.length + f1099das.length > 0;

  // This is the final step now, so it gates the actual filing on the required
  // income docs being present (uploaded or still parsing) and, before finalizing,
  // fully parsed. Which docs are required follows directly from the answers.
  const needsW2 = workedInUs === "yes";
  const needs1042s = scholarshipCoverage === "tuition_and_living";
  const needs1099 = show1099;

  const answersComplete =
    workedInUs !== "" &&
    scholarshipCoverage !== "" &&
    digitalAssets !== "" &&
    !(workedInUs === "yes" && onOPT === "");

  const w2Ready = !needsW2 || w2s.length > 0;
  const f1042sReady = !needs1042s || f1042s.length > 0;
  const f1099Ready = !needs1099 || has1099Data;
  const incomeReady = w2Ready && f1042sReady && f1099Ready;

  const w2Present = !needsW2 || w2s.length > 0 || w2Processing;
  const f1042sPresent = !needs1042s || f1042s.length > 0 || f1042sProcessing;
  const f1099Present = !needs1099 || has1099Data || f1099Processing;
  const incomePresent = w2Present && f1042sPresent && f1099Present;

  const missingDocs = [
    needsW2 && !w2s.length && !w2Processing ? "W-2" : null,
    needs1042s && !f1042s.length && !f1042sProcessing ? "1042-S" : null,
    needs1099 && !has1099Data && !f1099Processing ? "1099" : null,
  ].filter((d): d is string => Boolean(d));

  const activelyFiling = isFiling && incomePresent;

  // Best-effort persist of a cleared income array — the Documents step re-reads
  // the filing and is the safety net if this doesn't land.
  async function persistIncome(field: string, value: unknown[]) {
    try {
      await fetch("/api/documents/income", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ field, value }),
      });
    } catch {
      /* ignore — Documents step reconciles */
    }
  }

  // Removing a triggering answer discards the doc it required, preserving the
  // invariant the old flow had for free (a doc could only be uploaded once its
  // answer was given) — otherwise a de-selected income type would leave phantom
  // income on the return.
  function handleWorkedInUsChange(value: YesNo) {
    setWorkedInUs(value);
    if (value === "no" && w2s.length > 0) {
      setW2s([]);
      void persistIncome("w2s", []);
    }
  }

  function handleScholarshipChange(value: ScholarshipCoverage) {
    setScholarshipCoverage(value);
    if (value !== "tuition_and_living" && f1042s.length > 0) {
      setF1042s([]);
      void persistIncome("f1042s", []);
    }
  }

  function clear1099() {
    setF1099ints([]);
    setF1099divs([]);
    setF1099bs([]);
    setF1099das([]);
    void persistIncome("f1099ints", []);
    void persistIncome("f1099divs", []);
    void persistIncome("f1099bs", []);
    void persistIncome("f1099das", []);
  }

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

        setF1042s(data.f1042s ?? []);
        setF1099ints(data.f1099ints ?? []);
        setF1099divs(data.f1099divs ?? []);
        setF1099bs(data.f1099bs ?? []);
        setF1099das(data.f1099das ?? []);
        setW2s(data.w2s ?? []);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Something went wrong."))
      .finally(() => setIsHydrating(false));
  }, []);

  // Save the interview (and compute the checklist) now — this doesn't depend on
  // the income docs parsing — then arm filing. isFiling flips only after the
  // save succeeds, so the finalize effect below can't run before it.
  async function handleFileYourTax() {
    if (!answersComplete) {
      setError("Please answer all the questions before continuing.");
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      const interview: InterviewAnswers = {
        workedInUs: workedInUs === "yes",
        onOPT: workedInUs === "yes" && onOPT === "yes",
        hasSSN: false,
        hasOrAppliedItin: false,
        scholarshipCoverage: scholarshipCoverage as ScholarshipCoverage,
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
          charitableContributions,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? "Something went wrong.");
      }
      setIsFiling(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setIsSubmitting(false);
    }
  }

  // Finalize once the user has committed AND every required income doc has
  // finished parsing (incomeReady) — the button is intentionally clickable
  // before the last extraction lands, so this may fire a beat later.
  useEffect(() => {
    if (!activelyFiling || !incomeReady || filedRef.current) return;
    filedRef.current = true;
    (async () => {
      try {
        const res = await fetch("/api/documents/file", { method: "POST" });
        if (!res.ok) throw new Error("Couldn't finish filing — try again.");
        router.push("/dashboard");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong.");
        setIsFiling(false);
        filedRef.current = false;
      }
    })();
  }, [activelyFiling, incomeReady, router]);

  if (isHydrating) {
    return (
      <WizardShell step={4} totalSteps={4} title="A few questions about your year">
        <p className="text-sm text-muted-foreground">Loading...</p>
      </WizardShell>
    );
  }

  return (
    <WizardShell step={4} totalSteps={4} title="A few questions about your year">
      <div className="space-y-6">
        <div className="space-y-2">
          <Label>Did you work in the US this year (on-campus, CPT, or OPT)?</Label>
          <RadioGroup
            value={workedInUs}
            onValueChange={(v) => handleWorkedInUsChange(v as YesNo)}
            className="flex gap-4"
          >
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

        {workedInUs === "yes" && (
          <div className="space-y-1.5">
            <Label>Your W-2</Label>
            <W2Slot initialValue={w2s} onItemsChange={setW2s} onProcessingChange={setW2Processing} />
          </div>
        )}

        <div className="space-y-2">
          <Label>Did you receive a scholarship or fellowship?</Label>
          <RadioGroup
            value={scholarshipCoverage}
            onValueChange={(v) => handleScholarshipChange(v as ScholarshipCoverage)}
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

          {scholarshipCoverage === "tuition_and_living" && (
            <div className="space-y-1.5 pt-2">
              <Label>Your 1042-S</Label>
              <Income1042SSlot
                initialValue={f1042s}
                onItemsChange={setF1042s}
                onProcessingChange={setF1042sProcessing}
              />
            </div>
          )}
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
            <Checkbox
              checked={interestIncome}
              onCheckedChange={(c) => {
                const next = c === true;
                setInterestIncome(next);
                if (!next && !dividendIncome && !soldAssets && has1099Data) clear1099();
              }}
            />
            Bank interest (savings, CDs, high-yield accounts)
          </label>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={dividendIncome}
              onCheckedChange={(c) => {
                const next = c === true;
                setDividendIncome(next);
                if (!next && !interestIncome && !soldAssets && has1099Data) clear1099();
              }}
            />
            Dividends
          </label>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={soldAssets}
              onCheckedChange={(c) => {
                const next = c === true;
                setSoldAssets(next);
                if (!next && !interestIncome && !dividendIncome && has1099Data) clear1099();
              }}
            />
            Sold stocks, crypto, or other assets (for a gain or loss)
          </label>

          {show1099 && (
            <div className="space-y-1.5 pt-2">
              <Label>Your 1099</Label>
              <p className="text-xs text-muted-foreground">
                Your bank/broker&apos;s combined statement works (INT/DIV/B sections together). Add more than
                one if you have several.
              </p>
              <Consolidated1099Slot
                initialInts={f1099ints}
                initialDivs={f1099divs}
                initialBs={f1099bs}
                initialDas={f1099das}
                onIntsChange={setF1099ints}
                onDivsChange={setF1099divs}
                onBsChange={setF1099bs}
                onDasChange={setF1099das}
                onProcessingChange={setF1099Processing}
              />
            </div>
          )}
        </div>

        <CharitableContributionCard value={charitableContributions} onChange={setCharitableContributions} />

        {missingDocs.length > 0 && (
          <p className="text-xs text-muted-foreground">Add your {missingDocs.join(", ")} to file.</p>
        )}
        {activelyFiling && !incomeReady && (
          <p className="text-xs text-muted-foreground">
            Finishing up your documents — we&apos;ll file as soon as they&apos;re ready.
          </p>
        )}
        {error && <p className="text-sm text-destructive">{error}</p>}

        <WizardNavRow
          step={4}
          onContinue={handleFileYourTax}
          continueLabel={
            isSubmitting
              ? "Working it out..."
              : activelyFiling
                ? incomeReady
                  ? "Filing..."
                  : "Almost there..."
                : "File your Tax! →"
          }
          disabled={isSubmitting || activelyFiling || !incomePresent}
        />
      </div>
    </WizardShell>
  );
}
