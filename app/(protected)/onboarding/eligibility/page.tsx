"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Spinner } from "@/components/ui/spinner";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { WizardShell } from "@/components/onboarding/wizard-shell";
import {
  WizardNavRow,
  WizardBackOnly,
} from "@/components/onboarding/wizard-nav-row";
import { FileDropSlot } from "@/components/onboarding/file-drop-slot";
import { CURRENT_SUPPORTED_TAX_YEAR } from "@/lib/config/taxYear";
import { formatIsoDate } from "@/lib/format";
import { fetchFiling } from "@/lib/client/fetchFiling";
import type { I94Extraction } from "@/lib/extraction/schemas/i94";

type SubStep = "upload" | "confirm" | "blocked";
type YesNo = "yes" | "no";
// "" = not yet answered; we no longer pre-select a default so the user has to
// choose each answer themselves.
type YesNoUnset = YesNo | "";

const SELECTABLE_TAX_YEARS = Array.from(
  { length: 6 },
  (_, i) => CURRENT_SUPPORTED_TAX_YEAR - i,
);

export default function EligibilityPage() {
  const router = useRouter();
  const [isHydrating, setIsHydrating] = useState(true);
  const [subStep, setSubStep] = useState<SubStep>("upload");
  const [i94File, setI94File] = useState<File | null>(null);
  const [travelHistoryFile, setTravelHistoryFile] = useState<File | null>(null);
  const [visaClass, setVisaClass] = useState("");
  const [firstEntryDate, setFirstEntryDate] = useState("");
  const [passportNumber, setPassportNumber] = useState("");
  const [travelHistory, setTravelHistory] = useState<
    I94Extraction["travelHistory"]
  >([]);
  const [hadEarlierFJMQVisa, setHadEarlierFJMQVisa] = useState<YesNoUnset>("");
  const [hasGreenCard, setHasGreenCard] = useState<YesNoUnset>("");
  const [appliedForGreenCard, setAppliedForGreenCard] = useState<YesNoUnset>("");
  const [appliedForGreenCardExplanation, setAppliedForGreenCardExplanation] =
    useState("");
  const [changedVisaType, setChangedVisaType] = useState<YesNoUnset>("");
  const [incomeOnlyInWashington, setIncomeOnlyInWashington] =
    useState<YesNoUnset>("");
  const [reasoning, setReasoning] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Rehydrate from Supabase on mount so back-navigation from a later step
  // doesn't show empty fields for work the user already did.
  useEffect(() => {
    fetchFiling()
      .then((data) => {
        const saved = data.eligibilityInput;
        if (saved) {
          setVisaClass(saved.visaClass);
          setFirstEntryDate(saved.firstEntryDate);
          setTravelHistory(saved.travelHistory);
          setPassportNumber(
            (data.profile?.passportNumber as { value?: string } | undefined)
              ?.value ?? "",
          );
          setHadEarlierFJMQVisa(saved.hadEarlierFJMQVisa ? "yes" : "no");
          setHasGreenCard(saved.hasGreenCard ? "yes" : "no");
          setAppliedForGreenCard(saved.appliedForGreenCard ? "yes" : "no");
          setAppliedForGreenCardExplanation(
            saved.appliedForGreenCardExplanation ?? "",
          );
          setChangedVisaType(saved.changedVisaType ? "yes" : "no");
          setIncomeOnlyInWashington(
            saved.incomeOnlyInWashington === false ? "no" : "yes",
          );
          setSubStep("confirm");
        }
      })
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Something went wrong."),
      )
      .finally(() => setIsHydrating(false));
  }, []);

  async function handleExtract() {
    if (!i94File || !travelHistoryFile) return;
    setIsSubmitting(true);
    setError(null);
    try {
      // Upload and call extraction layer
      const formData = new FormData();
      formData.append("taxYear", String(CURRENT_SUPPORTED_TAX_YEAR));
      formData.append("i94", i94File);
      formData.append("travelHistory", travelHistoryFile);
      const res = await fetch("/api/documents/extract/i94", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? "Extraction failed.");
      }

      // Unpack Extraction into states (prefill next form)
      const data = (await res.json()) as I94Extraction;
      setVisaClass(data.visaClass);
      setFirstEntryDate(data.firstEntryDate);
      setPassportNumber(data.passportNumber);
      setTravelHistory(data.travelHistory);

      // Define function to Store the raw files so they're on file for later extraction/reference,
      const uploadFile = (docType: string, file: File) => {
        const uploadForm = new FormData();
        uploadForm.append("docType", docType);
        uploadForm.append("file", file);
        return fetch("/api/documents/upload", {
          method: "POST",
          body: uploadForm,
        });
      };

      // The upload begins here
      await Promise.all([
        uploadFile("i94", i94File),
        uploadFile("travel_history", travelHistoryFile),
        // Persist name/DOB/citizenship right away so the profile page arrives
        // pre-filled — the user only confirms them there, never types them.
        fetch("/api/documents/i94-identity", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            legalName: data.legalName,
            dob: data.dob,
            citizenship: data.citizenship,
          }),
        }),
      ]);

      setSubStep("confirm");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Extraction failed.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleConfirm() {
    const unanswered = [
      hadEarlierFJMQVisa,
      hasGreenCard,
      appliedForGreenCard,
      changedVisaType,
      incomeOnlyInWashington,
    ].some((answer) => answer === "");
    if (unanswered) {
      setError("Please answer all the questions before continuing.");
      return;
    }

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
          hasGreenCard: hasGreenCard === "yes",
          appliedForGreenCard: appliedForGreenCard === "yes",
          appliedForGreenCardExplanation:
            appliedForGreenCard === "yes"
              ? appliedForGreenCardExplanation
              : undefined,
          changedVisaType: changedVisaType === "yes",
          incomeOnlyInWashington: incomeOnlyInWashington === "yes",
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? "Something went wrong.");
      }
      const result = (await res.json()) as {
        passed: boolean;
        reasoning: string;
      };
      setReasoning(result.reasoning);
      if (result.passed) {
        router.push("/onboarding/profile");
      } else {
        setSubStep("blocked");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isHydrating) {
    return (
      <WizardShell step={1} totalSteps={4} title="Let's check your eligibility">
        <p className="text-sm text-muted-foreground">Loading...</p>
      </WizardShell>
    );
  }

  if (subStep === "blocked") {
    return (
      <WizardShell step={1} totalSteps={4} title="We can't support this yet">
        <p className="text-sm text-foreground">{reasoning}</p>
        <WizardBackOnly step={1} />
      </WizardShell>
    );
  }

  if (subStep === "confirm") {
    return (
      <WizardShell step={1} totalSteps={4} title="Confirm what we found">
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="visaClass">Visa / status type</Label>
            <Input
              id="visaClass"
              value={visaClass}
              onChange={(e) => setVisaClass(e.target.value)}
            />
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
              Before{" "}
              {formatIsoDate(firstEntryDate, "your confirmed first entry date")}
              , were you ever in the US on an F, J, M, or Q visa?
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

          <div className="space-y-2">
            <Label>
              Are you a US lawful permanent resident (green card holder)?
            </Label>
            <RadioGroup
              value={hasGreenCard}
              onValueChange={(v) => setHasGreenCard(v as YesNo)}
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

          <div className="space-y-2">
            <Label>
              During {CURRENT_SUPPORTED_TAX_YEAR}, did you apply for, or take
              other affirmative steps to apply for, lawful permanent resident
              status in the United States?
            </Label>
            <RadioGroup
              value={appliedForGreenCard}
              onValueChange={(v) => setAppliedForGreenCard(v as YesNo)}
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

          {appliedForGreenCard === "yes" && (
            <div className="space-y-1.5">
              <Label htmlFor="appliedForGreenCardExplanation">Explain</Label>
              <Textarea
                id="appliedForGreenCardExplanation"
                value={appliedForGreenCardExplanation}
                onChange={(e) =>
                  setAppliedForGreenCardExplanation(e.target.value)
                }
              />
            </div>
          )}

          <div className="space-y-2">
            <Label>Have you ever changed your visa type?</Label>
            <RadioGroup
              value={changedVisaType}
              onValueChange={(v) => setChangedVisaType(v as YesNo)}
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

          <div className="space-y-2">
            <Label>
              Did you earn income only while physically working or living in
              Washington State?
            </Label>
            <RadioGroup
              value={incomeOnlyInWashington}
              onValueChange={(v) => setIncomeOnlyInWashington(v as YesNo)}
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
            step={1}
            onContinue={handleConfirm}
            continueLabel={isSubmitting ? "Checking..." : "Continue"}
            disabled={isSubmitting}
          />
        </div>
      </WizardShell>
    );
  }

  return (
    <>
      <WizardShell step={1} totalSteps={4} title="Let's check your eligibility">
        <div className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="taxYear">Tax year</Label>
          <Select value={String(CURRENT_SUPPORTED_TAX_YEAR)}>
            <SelectTrigger id="taxYear" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SELECTABLE_TAX_YEARS.map((year) => (
                <SelectItem
                  key={year}
                  value={String(year)}
                  disabled={year !== CURRENT_SUPPORTED_TAX_YEAR}
                >
                  {year}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground ml-1">
            <i>
              Only {CURRENT_SUPPORTED_TAX_YEAR} tax year is supported right now.
            </i>
          </p>
        </div>

        <FileDropSlot
          label="I-94"
          description="Your I-94 arrival/departure record"
          file={i94File}
          onChange={setI94File}
        />
        <FileDropSlot
          label="I-94 travel history"
          description="Your full travel history from i94.cbp.dhs.gov"
          file={travelHistoryFile}
          onChange={setTravelHistoryFile}
        />

        {error && <p className="text-sm text-destructive">{error}</p>}

        <WizardNavRow
          step={1}
          onContinue={handleExtract}
          continueLabel="Continue"
          disabled={!i94File || !travelHistoryFile || isSubmitting}
        />
        </div>
      </WizardShell>

      {/* While the I-94 + travel history are being read, dim and block the whole
          page with an overlay (form stays mounted underneath) so nothing else
          is clickable. */}
      {isSubmitting && (
        <div
          className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-black/50 backdrop-blur-sm"
          role="status"
          aria-live="polite"
        >
          <Spinner className="size-8 text-white" />
          <p className="text-sm text-white">
            Reading your I-94 and travel history — this can take up to 30 seconds.
          </p>
        </div>
      )}
    </>
  );
}
