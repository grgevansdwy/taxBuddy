"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { WizardShell } from "@/components/onboarding/wizard-shell";
import { WizardNavRow, WizardBackOnly } from "@/components/onboarding/wizard-nav-row";
import { CURRENT_SUPPORTED_TAX_YEAR } from "@/lib/config/taxYear";
import { formatIsoDate } from "@/lib/format";
import { fetchFiling } from "@/lib/client/fetchFiling";
import type { I94TravelRow } from "@/lib/types";

type YesNo = "yes" | "no";
type YesNoUnset = YesNo | "";
type SubStep = "loading" | "confirm" | "blocked";

// The eligibility inputs the documents step drafted into eligibility_page,
// plus the ready marker + passport the draft rides along (neither is on the
// typed EligibilityInput, so we read them off a loose shape).
interface DraftedEligibility {
  visaClass?: string;
  firstEntryDate?: string;
  passportNumber?: string;
  travelHistory?: I94TravelRow[];
  hadEarlierFJMQVisa?: boolean;
  hasGreenCard?: boolean;
  appliedForGreenCard?: boolean;
  appliedForGreenCardExplanation?: string;
  changedVisaType?: boolean;
  incomeOnlyInWashington?: boolean;
  eligibilityDraftReady?: boolean;
}

const POLL_INTERVAL_MS = 1500;
const POLL_MAX_ATTEMPTS = 20; // ~30s — reads are long done by the time profile is filled

export default function ConfirmPage() {
  const router = useRouter();
  const [subStep, setSubStep] = useState<SubStep>("loading");
  const [loadError, setLoadError] = useState<string | null>(null);

  const [visaClass, setVisaClass] = useState("");
  const [firstEntryDate, setFirstEntryDate] = useState("");
  const [passportNumber, setPassportNumber] = useState("");
  const [travelHistory, setTravelHistory] = useState<I94TravelRow[]>([]);
  const [hadEarlierFJMQVisa, setHadEarlierFJMQVisa] = useState<YesNoUnset>("");

  // Answers carried from the questions step — needed to run the decision, not
  // shown here.
  const answers = useRef<{
    hasGreenCard: boolean;
    appliedForGreenCard: boolean;
    appliedForGreenCardExplanation?: string;
    changedVisaType: boolean;
    incomeOnlyInWashington: boolean;
  } | null>(null);

  const [reasoning, setReasoning] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Poll the filing until the documents step has finished writing its draft
  // (marked by eligibilityDraftReady) — or, on a back-navigation revisit, until
  // the decision has already run (residency present). In practice the reads are
  // long finished by the time the profile form is done, so this resolves on the
  // first fetch.
  useEffect(() => {
    let cancelled = false;
    let attempts = 0;

    function populate(draft: DraftedEligibility, passportFromProfile: string) {
      setVisaClass(draft.visaClass ?? "");
      setFirstEntryDate(draft.firstEntryDate ?? "");
      setPassportNumber(draft.passportNumber ?? passportFromProfile);
      setTravelHistory(draft.travelHistory ?? []);
      if (typeof draft.hadEarlierFJMQVisa === "boolean") {
        setHadEarlierFJMQVisa(draft.hadEarlierFJMQVisa ? "yes" : "no");
      }
      answers.current = {
        hasGreenCard: Boolean(draft.hasGreenCard),
        appliedForGreenCard: Boolean(draft.appliedForGreenCard),
        appliedForGreenCardExplanation: draft.appliedForGreenCardExplanation,
        changedVisaType: Boolean(draft.changedVisaType),
        incomeOnlyInWashington: draft.incomeOnlyInWashington !== false,
      };
      setSubStep("confirm");
    }

    async function poll() {
      try {
        const data = await fetchFiling();
        if (cancelled) return;
        const draft = (data.eligibilityInput as DraftedEligibility | null) ?? null;
        const passportFromProfile =
          (data.profile?.passportNumber as { value?: string } | undefined)?.value ?? "";
        // Ready when the draft's answers have landed, or (revisit) the decision
        // has already been computed.
        if (draft && (draft.eligibilityDraftReady || data.residency)) {
          populate(draft, passportFromProfile);
          return;
        }
        if (++attempts >= POLL_MAX_ATTEMPTS) {
          setLoadError(
            "We're still reading your documents. Give it a moment and refresh, or go back and re-upload.",
          );
          return;
        }
        setTimeout(poll, POLL_INTERVAL_MS);
      } catch (err) {
        if (cancelled) return;
        setLoadError(err instanceof Error ? err.message : "Something went wrong.");
      }
    }

    poll();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleConfirm() {
    if (hadEarlierFJMQVisa === "") {
      setError("Please answer the question before continuing.");
      return;
    }
    if (!answers.current) return;

    setIsSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/eligibility", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taxYear: CURRENT_SUPPORTED_TAX_YEAR,
          visaClass,
          firstEntryDate,
          passportNumber,
          travelHistory,
          hadEarlierFJMQVisa: hadEarlierFJMQVisa === "yes",
          hasGreenCard: answers.current.hasGreenCard,
          appliedForGreenCard: answers.current.appliedForGreenCard,
          appliedForGreenCardExplanation: answers.current.appliedForGreenCardExplanation,
          changedVisaType: answers.current.changedVisaType,
          incomeOnlyInWashington: answers.current.incomeOnlyInWashington,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? "Something went wrong.");
      }
      const result = (await res.json()) as { passed: boolean; reasoning: string };
      setReasoning(result.reasoning);
      if (result.passed) {
        router.push("/onboarding/interview");
      } else {
        setSubStep("blocked");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (subStep === "loading") {
    return (
      <WizardShell step={3} totalSteps={4} title="Confirm what we found">
        {loadError ? (
          <div className="space-y-3">
            <p className="text-sm text-destructive">{loadError}</p>
            <WizardBackOnly step={3} />
          </div>
        ) : (
          <div
            className="flex items-center gap-2 text-sm text-muted-foreground"
            role="status"
            aria-live="polite"
          >
            <Spinner className="size-4" />
            Finishing reading your documents…
          </div>
        )}
      </WizardShell>
    );
  }

  if (subStep === "blocked") {
    return (
      <WizardShell step={3} totalSteps={4} title="We can't support this yet">
        <p className="text-sm text-foreground">{reasoning}</p>
        <WizardBackOnly step={3} />
      </WizardShell>
    );
  }

  return (
    <WizardShell step={3} totalSteps={4} title="Confirm what we found">
      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="visaClass">Visa / status type</Label>
          <Input id="visaClass" value={visaClass} onChange={(e) => setVisaClass(e.target.value)} />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="firstEntryDate">First entry date</Label>
          <Input
            id="firstEntryDate"
            type="date"
            value={firstEntryDate}
            onChange={(e) => setFirstEntryDate(e.target.value)}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="passportNumber">Passport number</Label>
          <Input
            id="passportNumber"
            value={passportNumber}
            onChange={(e) => setPassportNumber(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label>
            Before {formatIsoDate(firstEntryDate, "your confirmed first entry date")}, were you ever in
            the US on an F, J, M, or Q visa?
          </Label>
          <RadioGroup
            value={hadEarlierFJMQVisa}
            onValueChange={(v) => setHadEarlierFJMQVisa(v as YesNo)}
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

        {error && <p className="text-sm text-destructive">{error}</p>}

        <WizardNavRow
          step={3}
          onContinue={handleConfirm}
          continueLabel={isSubmitting ? "Checking..." : "Continue"}
          disabled={isSubmitting}
        />
      </div>
    </WizardShell>
  );
}
