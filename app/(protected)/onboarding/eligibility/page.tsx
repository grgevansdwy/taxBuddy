"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { fetchFiling } from "@/lib/client/fetchFiling";
import { answerBasedBlockReason, computeFirstF1EntryDate } from "@/lib/rules/eligibility";
import type { I94Extraction } from "@/lib/extraction/schemas/i94";
import type { I20ExtractResponse } from "@/app/api/documents/extract/i20/route";
import type { SchoolInfo } from "@/lib/types";

type SubStep = "upload" | "questions" | "blocked";
type YesNo = "yes" | "no";
// "" = not yet answered; we no longer pre-select a default so the user has to
// choose each answer themselves.
type YesNoUnset = YesNo | "";

const SELECTABLE_TAX_YEARS = Array.from(
  { length: 6 },
  (_, i) => CURRENT_SUPPORTED_TAX_YEAR - i,
);

async function saveEligibilityDraft(fields: Record<string, unknown>) {
  await fetch("/api/eligibility/draft", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(fields),
  });
}

export default function EligibilityPage() {
  const router = useRouter();
  const [isHydrating, setIsHydrating] = useState(true);
  const [subStep, setSubStep] = useState<SubStep>("upload");
  const [i94File, setI94File] = useState<File | null>(null);
  const [travelHistoryFile, setTravelHistoryFile] = useState<File | null>(null);
  // The I-20 is uploaded here (not later) because its "Earliest Admission Date"
  // is needed to compute the F-1 first-entry date the eligibility check depends
  // on — see computeFirstF1EntryDate.
  const [i20File, setI20File] = useState<File | null>(null);

  // File objects can't survive a page reload, but the raw uploads are saved in
  // Supabase (documents_upload). On resume we rehydrate just the file *names*
  // from there so the slots show what's already uploaded instead of looking
  // empty — the user can proceed without re-uploading, or drop a new file to
  // replace it. Keyed by the same DocType the upload route stored them under.
  const [i20SavedName, setI20SavedName] = useState<string | null>(null);
  const [i94SavedName, setI94SavedName] = useState<string | null>(null);
  const [travelSavedName, setTravelSavedName] = useState<string | null>(null);

  // Only the answer-based (document-independent) questions live on this step now.
  // The document-derived confirmation (visa class, entry date, passport, F/J/M/Q)
  // and the actual decision moved to /onboarding/confirm, after profile.
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

  const [extractFailed, setExtractFailed] = useState(false);

  // Each document starts parsing the moment it's dropped — not on Continue — so
  // the slowest one (the I-20, which does a GPT read + a school web-search)
  // is already working while the user is still finding their I-94. The in-flight
  // extraction promises live in refs; Continue just awaits whatever's left.
  type DocStatus = "idle" | "processing" | "done" | "error";
  const i20Extraction = useRef<Promise<I20ExtractResponse> | null>(null);
  const i94Extraction = useRef<Promise<I94Extraction> | null>(null);
  const [i20Status, setI20Status] = useState<DocStatus>("idle");
  const [i94Status, setI94Status] = useState<DocStatus>("idle");

  // The whole extract-and-persist operation, so the answers save (on the
  // questions step) can be chained AFTER it — serializing the two writers to
  // eligibility_page so they never clobber each other. See handleQuestionsNext.
  const extractionOp = useRef<Promise<void> | null>(null);

  // Rehydrate from Supabase on mount so back-navigation doesn't show empty
  // fields for work the user already did.
  useEffect(() => {
    fetchFiling()
      .then((data) => {
        // Show the names of any docs already uploaded on a prior visit.
        const uploads = data.uploadedDocuments ?? {};
        setI20SavedName(uploads.i20?.fileName ?? null);
        setI94SavedName(uploads.i94?.fileName ?? null);
        setTravelSavedName(uploads.travel_history?.fileName ?? null);

        const saved = data.eligibilityInput;
        // Land on the questions sub-step if the documents were already read
        // (extraction draft present) OR the answers were already given — so a
        // resume never forces a re-upload. Only fill the answers if they exist;
        // an extraction-only draft leaves them blank.
        const hasExtractionDraft = Boolean(saved?.visaClass);
        const hasAnswers = typeof saved?.hasGreenCard === "boolean";
        if (saved && (hasExtractionDraft || hasAnswers)) {
          if (hasAnswers) {
            setHasGreenCard(saved.hasGreenCard ? "yes" : "no");
            setAppliedForGreenCard(saved.appliedForGreenCard ? "yes" : "no");
            setAppliedForGreenCardExplanation(
              saved.appliedForGreenCardExplanation ?? "",
            );
            setChangedVisaType(saved.changedVisaType ? "yes" : "no");
            setIncomeOnlyInWashington(
              saved.incomeOnlyInWashington === false ? "no" : "yes",
            );
          }
          setSubStep("questions");
        }
      })
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Something went wrong."),
      )
      .finally(() => setIsHydrating(false));
  }, []);

  // --- Per-document extraction, fired on drop ---

  async function runI20Extraction(file: File): Promise<I20ExtractResponse> {
    const form = new FormData();
    form.append("i20", file);
    const res = await fetch("/api/documents/extract/i20", { method: "POST", body: form });
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      throw new Error(body?.error ?? "Couldn't read your I-20.");
    }
    return (await res.json()) as I20ExtractResponse;
  }

  async function runI94Extraction(i94: File, travel: File): Promise<I94Extraction> {
    const form = new FormData();
    form.append("taxYear", String(CURRENT_SUPPORTED_TAX_YEAR));
    form.append("i94", i94);
    form.append("travelHistory", travel);
    const res = await fetch("/api/documents/extract/i94", { method: "POST", body: form });
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      throw new Error(body?.error ?? "Couldn't read your I-94.");
    }
    return (await res.json()) as I94Extraction;
  }

  // Kick off (or restart) a document's read and track its status. The `=== p`
  // guards drop stale results if the file was replaced mid-flight.
  function startI20(file: File) {
    setI20Status("processing");
    const p = runI20Extraction(file);
    i20Extraction.current = p;
    p.then(() => i20Extraction.current === p && setI20Status("done")).catch(
      () => i20Extraction.current === p && setI20Status("error"),
    );
  }

  function startI94(i94: File, travel: File) {
    setI94Status("processing");
    const p = runI94Extraction(i94, travel);
    i94Extraction.current = p;
    p.then(() => i94Extraction.current === p && setI94Status("done")).catch(
      () => i94Extraction.current === p && setI94Status("error"),
    );
  }

  function handleI20Change(file: File | null) {
    setI20File(file);
    setError(null);
    if (file) startI20(file);
    else {
      i20Extraction.current = null;
      setI20Status("idle");
    }
  }

  function handleI94Change(file: File | null) {
    setI94File(file);
    setError(null);
    // The I-94 read needs both the I-94 and the travel history, so it only fires
    // once both are present.
    if (file && travelHistoryFile) startI94(file, travelHistoryFile);
    else {
      i94Extraction.current = null;
      setI94Status("idle");
    }
  }

  function handleTravelChange(file: File | null) {
    setTravelHistoryFile(file);
    setError(null);
    if (file && i94File) startI94(i94File, file);
    else {
      i94Extraction.current = null;
      setI94Status("idle");
    }
  }

  // Reads both documents, computes the F-1 first-entry date, and persists
  // everything: the raw files, the identity + school (to profile), and the
  // extracted eligibility inputs as a draft the confirm step rehydrates.
  async function doExtractAndSave() {
    setError(null);
    setExtractFailed(false);
    try {
      const [i20Data, data] = await Promise.all([
        i20Extraction.current!,
        i94Extraction.current!,
      ]);

      // Anchored on the first arrival on/after the I-20's earliest admission
      // date — NOT the earliest arrival overall, which could be a pre-F-1
      // tourist entry that would wrongly age the five-year exempt count.
      const firstEntryDate = computeFirstF1EntryDate(
        data.travelHistory,
        i20Data.earliestAdmissionDate,
        data.firstEntryDate,
      );

      // I-20 school details (with the online contact-info lookup already merged
      // by the extract route) — saved to profile.
      const school: SchoolInfo = {
        name: i20Data.schoolName,
        address: i20Data.address,
        phone: i20Data.phone,
        dsoName: i20Data.dsoName,
        dsoAddress: i20Data.dsoAddress,
        dsoPhone: i20Data.dsoPhone,
      };

      const uploadFile = (docType: string, file: File) => {
        const uploadForm = new FormData();
        uploadForm.append("docType", docType);
        uploadForm.append("file", file);
        return fetch("/api/documents/upload", { method: "POST", body: uploadForm });
      };

      // Uploads write documents_upload and the draft writes eligibility_page —
      // different columns from the identity/school writes below, so they're safe
      // to run in parallel.
      await Promise.all([
        uploadFile("i94", i94File!),
        uploadFile("travel_history", travelHistoryFile!),
        uploadFile("i20", i20File!),
        // Extracted eligibility inputs → eligibility_page draft, so the confirm
        // step (after profile) can rehydrate them without re-reading the docs.
        // Passport rides along here (not profile) to avoid racing the identity
        // and school writes below.
        saveEligibilityDraft({
          visaClass: data.visaClass,
          firstEntryDate,
          passportNumber: data.passportNumber,
          travelHistory: data.travelHistory,
        }),
      ]);

      // These two BOTH read-modify-write the same profile_page JSON column, so
      // they MUST run sequentially. Firing them together (as before) let the
      // second one's stale read clobber the first one's write — a lost-update
      // race that wiped the I-94 identity fields, leaving the profile page blank.
      // Persist name/DOB/citizenship first so the profile page arrives pre-filled
      // (the user only confirms them there, never types them).
      await fetch("/api/documents/i94-identity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          legalName: data.legalName,
          dob: data.dob,
          citizenship: data.citizenship,
        }),
      });
      await fetch("/api/documents/i20", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ school }),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Extraction failed.");
      setExtractFailed(true);
    }
  }

  // Continue on the upload step: the reads are already in flight (or done) from
  // the drops. Move to the questions immediately; extraction + persistence run
  // in the background via extractionOp.
  function handleExtract() {
    const anyFresh = Boolean(i94File || travelHistoryFile || i20File);

    // Nothing newly uploaded this visit — every doc is already in Supabase and
    // was extracted on a prior visit. Just advance; there's nothing to re-read.
    if (!anyFresh) {
      setError(null);
      setSubStep("questions");
      return;
    }

    // A fresh upload means we re-read. The I-94 travel history and the I-20's
    // admission date are read together to compute the F-1 first-entry date, so
    // re-reading needs all three present as live files. After a resume (files
    // gone from memory), that means re-uploading the set to change any one.
    if (!i94File || !travelHistoryFile || !i20File) {
      setError(
        "To change a document, please re-upload all three so we can re-read them together.",
      );
      return;
    }
    setError(null);
    if (!i20Extraction.current || i20Status === "error") startI20(i20File);
    if (!i94Extraction.current || i94Status === "error") startI94(i94File, travelHistoryFile);
    setSubStep("questions");
    extractionOp.current = doExtractAndSave();
  }

  // Continue on the questions step. Answer-based blocks fire here (before
  // profile). Otherwise navigate to profile immediately and chain the answers
  // save AFTER the extraction op, so the two eligibility_page writers never
  // race; `eligibilityDraftReady` tells the confirm step everything has landed.
  function handleQuestionsNext() {
    const unanswered = [
      hasGreenCard,
      appliedForGreenCard,
      changedVisaType,
      incomeOnlyInWashington,
    ].some((answer) => answer === "");
    if (unanswered) {
      setError("Please answer all the questions before continuing.");
      return;
    }
    if (extractFailed) {
      setError("We couldn't read your documents — please go back and re-upload them.");
      return;
    }

    const blockReason = answerBasedBlockReason({
      hasGreenCard: hasGreenCard === "yes",
      changedVisaType: changedVisaType === "yes",
      incomeOnlyInWashington: incomeOnlyInWashington === "yes",
    });
    if (blockReason) {
      setReasoning(blockReason);
      setSubStep("blocked");
      return;
    }

    setError(null);
    setIsSubmitting(true);
    const answers = {
      hasGreenCard: hasGreenCard === "yes",
      appliedForGreenCard: appliedForGreenCard === "yes",
      appliedForGreenCardExplanation:
        appliedForGreenCard === "yes" ? appliedForGreenCardExplanation : undefined,
      changedVisaType: changedVisaType === "yes",
      incomeOnlyInWashington: incomeOnlyInWashington === "yes",
      eligibilityDraftReady: true,
    };
    (extractionOp.current ?? Promise.resolve())
      .then(() => saveEligibilityDraft(answers))
      .catch(() => {
        /* extraction failed after we left; the confirm step surfaces it */
      });
    router.push("/onboarding/profile");
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

  // The always-asked, document-independent questions. Rendered the instant the
  // files are dropped, while the documents read in the background.
  if (subStep === "questions") {
    return (
      <WizardShell step={1} totalSteps={4} title="A few eligibility questions">
        <div className="space-y-4">
          {extractFailed && (
            <div className="space-y-2 rounded-md border border-destructive/50 p-3">
              <p className="text-sm text-destructive">
                {error ?? "We couldn't read your documents."}
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setError(null);
                  setSubStep("upload");
                }}
              >
                Back to documents
              </Button>
            </div>
          )}

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

          {error && !extractFailed && <p className="text-sm text-destructive">{error}</p>}

          <WizardNavRow
            step={1}
            onContinue={handleQuestionsNext}
            continueLabel={isSubmitting ? "Saving..." : "Continue"}
            disabled={isSubmitting || extractFailed}
            // Back returns to the I-94/I-20 upload sub-step (not the dashboard)
            // so a user who uploaded the wrong file can re-upload it.
            onBack={() => {
              setError(null);
              setSubStep("upload");
            }}
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

        {/* Ordered slowest-to-read first: the I-20 (GPT read + school
            web-search) starts parsing the instant it's dropped, while the user
            is still finding their I-94 and travel history. */}
        <FileDropSlot
          label="I-20"
          file={i20File}
          fileNames={!i20File && i20SavedName ? [i20SavedName] : undefined}
          onChange={handleI20Change}
        />
        <FileDropSlot
          label="I-94"
          file={i94File}
          fileNames={!i94File && i94SavedName ? [i94SavedName] : undefined}
          onChange={handleI94Change}
        />
        <FileDropSlot
          label="I-94 travel history"
          file={travelHistoryFile}
          fileNames={
            !travelHistoryFile && travelSavedName ? [travelSavedName] : undefined
          }
          onChange={handleTravelChange}
        />

        {error && <p className="text-sm text-destructive">{error}</p>}

        <WizardNavRow
          step={1}
          onContinue={handleExtract}
          continueLabel="Continue"
          disabled={
            !(i94File || i94SavedName) ||
            !(travelHistoryFile || travelSavedName) ||
            !(i20File || i20SavedName)
          }
        />
      </div>
    </WizardShell>
  );
}
