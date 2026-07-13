"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
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
import { EXTRACTION_CONFIDENCE_THRESHOLD } from "@/lib/config/extraction";
import { formatIsoDate } from "@/lib/format";
import { fetchFiling } from "@/lib/client/fetchFiling";
import type { I94Extraction } from "@/lib/extraction/schemas/i94";

type SubStep = "upload" | "confirm" | "blocked";
type YesNo = "yes" | "no";

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
  const [extraction, setExtraction] = useState<I94Extraction | null>(null);
  const [visaClass, setVisaClass] = useState("");
  const [firstEntryDate, setFirstEntryDate] = useState("");
  const [documentNumber, setDocumentNumber] = useState("");
  const [travelHistory, setTravelHistory] = useState<
    I94Extraction["travelHistory"]
  >([]);
  const [hadEarlierFJMQVisa, setHadEarlierFJMQVisa] = useState<YesNo>("no");
  const [hasGreenCard, setHasGreenCard] = useState<YesNo>("no");
  const [appliedForGreenCard, setAppliedForGreenCard] = useState<YesNo>("no");
  const [appliedForGreenCardExplanation, setAppliedForGreenCardExplanation] =
    useState("");
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
          setDocumentNumber(
            (data.profile?.passportNumber as { value?: string } | undefined)
              ?.value ?? "",
          );
          setHadEarlierFJMQVisa(saved.hadEarlierFJMQVisa ? "yes" : "no");
          setHasGreenCard(saved.hasGreenCard ? "yes" : "no");
          setAppliedForGreenCard(saved.appliedForGreenCard ? "yes" : "no");
          setAppliedForGreenCardExplanation(
            saved.appliedForGreenCardExplanation ?? "",
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
      const data = (await res.json()) as I94Extraction;
      setExtraction(data);
      setVisaClass(data.visaClass);
      setFirstEntryDate(data.firstEntryDate);
      setDocumentNumber(data.documentNumber);
      setTravelHistory(data.travelHistory);

      // Store the raw files so they're on file for later extraction/reference,
      // independent of whether the user finishes confirming this step.
      const uploadFile = (docType: string, file: File) => {
        const uploadForm = new FormData();
        uploadForm.append("docType", docType);
        uploadForm.append("file", file);
        return fetch("/api/documents/upload", {
          method: "POST",
          body: uploadForm,
        });
      };
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
          documentNumber,
          travelHistory,
          hadEarlierFJMQVisa: hadEarlierFJMQVisa === "yes",
          hasGreenCard: hasGreenCard === "yes",
          appliedForGreenCard: appliedForGreenCard === "yes",
          appliedForGreenCardExplanation:
            appliedForGreenCard === "yes"
              ? appliedForGreenCardExplanation
              : undefined,
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
          {extraction && (
            <Badge
              variant={
                extraction.confidence >= EXTRACTION_CONFIDENCE_THRESHOLD
                  ? "secondary"
                  : "destructive"
              }
            >
              {Math.round(extraction.confidence * 100)}% confidence
            </Badge>
          )}

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
            <Label htmlFor="documentNumber">I-94 document number</Label>
            <Input
              id="documentNumber"
              value={documentNumber}
              onChange={(e) => setDocumentNumber(e.target.value)}
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
          continueLabel={isSubmitting ? "Reading documents..." : "Continue"}
          disabled={!i94File || !travelHistoryFile || isSubmitting}
        />
        {isSubmitting && (
          <p className="text-center text-xs text-muted-foreground">
            This can take up to 30 seconds.
          </p>
        )}
      </div>
    </WizardShell>
  );
}
