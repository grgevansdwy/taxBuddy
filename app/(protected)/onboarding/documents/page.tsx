"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { WizardShell } from "@/components/onboarding/wizard-shell";
import { WizardBackOnly } from "@/components/onboarding/wizard-nav-row";
import { UploadSlot } from "@/components/onboarding/upload-slot";
import { I20Slot } from "@/components/onboarding/i20-slot";
import { Income1042SSlot } from "@/components/onboarding/income-docs/income-1042s-slot";
import { Consolidated1099Slot } from "@/components/onboarding/income-docs/consolidated-1099-slot";
import { W2Slot } from "@/components/onboarding/income-docs/w2-slot";
import { DOC_LABELS } from "@/lib/config/docLabels";
import { fetchFiling } from "@/lib/client/fetchFiling";
import type {
  DocType,
  F1042SData,
  F1099BData,
  F1099DAData,
  F1099DIVData,
  F1099INTData,
  SchoolInfo,
  W2Data,
} from "@/lib/types";
import type { UploadedDocument } from "@/app/api/filing/route";

const ALREADY_ON_FILE: DocType[] = ["i94", "travel_history"];

// These get the EXTRACT-and-save treatment (upload → gpt-4o-mini reads it →
// saved automatically, no confirm screen). I-20 gets the same treatment but
// is handled separately below (it saves to profile.school/sevisId, not an
// income array). EAD stays raw-upload-only — out of scope this phase.
const EXTRACTED_INCOME_TYPES: DocType[] = ["f1042s", "f1099combined", "w2"];

export default function DocumentsPage() {
  const router = useRouter();
  const [documents, setDocuments] = useState<DocType[]>([]);
  const [explanation, setExplanation] = useState("");
  const [uploadedDocuments, setUploadedDocuments] = useState<Partial<Record<DocType, UploadedDocument>>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isFiling, setIsFiling] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const filedRef = useRef(false);

  const [f1042s, setF1042s] = useState<F1042SData[]>([]);
  const [f1099ints, setF1099ints] = useState<F1099INTData[]>([]);
  const [f1099divs, setF1099divs] = useState<F1099DIVData[]>([]);
  const [f1099bs, setF1099bs] = useState<F1099BData[]>([]);
  const [f1099das, setF1099das] = useState<F1099DAData[]>([]);
  const [w2s, setW2s] = useState<W2Data[]>([]);

  const [school, setSchool] = useState<SchoolInfo | null>(null);
  const [i20Confirmed, setI20Confirmed] = useState(false);

  // Which slots have a file in flight (dropped, still parsing). Combined with
  // the confirmed-data checks below, this lets "File your Tax!" light up as
  // soon as every required file is present — before parsing finishes.
  const [i20Processing, setI20Processing] = useState(false);
  const [docProcessing, setDocProcessing] = useState<Partial<Record<DocType, boolean>>>({});
  const setSlotProcessing = (doc: DocType, processing: boolean) =>
    setDocProcessing((prev) => ({ ...prev, [doc]: processing }));

  useEffect(() => {
    Promise.all([
      fetch("/api/documents/checklist").then((res) => res.json()) as Promise<{
        documents: DocType[];
        explanation: string;
      }>,
      fetchFiling(),
    ])
      .then(([checklist, filing]) => {
        setDocuments(checklist.documents ?? []);
        setExplanation(checklist.explanation ?? "");
        setUploadedDocuments(filing.uploadedDocuments ?? {});
        setF1042s(filing.f1042s ?? []);
        setF1099ints(filing.f1099ints ?? []);
        setF1099divs(filing.f1099divs ?? []);
        setF1099bs(filing.f1099bs ?? []);
        setF1099das(filing.f1099das ?? []);
        setW2s(filing.w2s ?? []);
        setSchool(filing.profile?.school ?? null);
        setI20Confirmed(Boolean(filing.profile?.school));
      })
      .catch((err) => setFileError(err instanceof Error ? err.message : "Something went wrong."))
      .finally(() => setIsLoading(false));
  }, []);

  const uploadDocs = documents.filter(
    (doc) => !ALREADY_ON_FILE.includes(doc) && !EXTRACTED_INCOME_TYPES.includes(doc) && doc !== "i20"
  );
  const incomeDocs = documents.filter((doc) => EXTRACTED_INCOME_TYPES.includes(doc));
  const needsI20 = documents.includes("i20");

  // A confirmed income document has at least one saved entry — this is the
  // parsing-is-done signal. Nothing here is ever assumed.
  const docConfirmed: Partial<Record<DocType, boolean>> = {
    f1042s: f1042s.length > 0,
    f1099combined: f1099ints.length > 0 || f1099divs.length > 0 || f1099bs.length > 0 || f1099das.length > 0,
    w2: w2s.length > 0,
  };
  const pendingDocs = incomeDocs.filter((doc) => !docConfirmed[doc]);
  const i20Pending = needsI20 && !i20Confirmed;
  const isReadyToFile = pendingDocs.length === 0 && !i20Pending;

  // Every required slot has a file (confirmed OR still parsing) — the gate for
  // enabling the button, one step earlier than isReadyToFile.
  const incomeFilesPresent = incomeDocs.every((doc) => docConfirmed[doc] || docProcessing[doc]);
  const i20FilePresent = !needsI20 || i20Confirmed || i20Processing;
  const allFilesPresent = incomeFilesPresent && i20FilePresent;

  // What still has no file at all — shown so a disabled button explains itself.
  const missingDocs = incomeDocs.filter((doc) => !docConfirmed[doc] && !docProcessing[doc]);
  const i20Missing = needsI20 && !i20Confirmed && !i20Processing;

  // The user pressed "File" AND every file is still present. If a slot drops
  // back out (e.g. a parse error) this goes false, so the button re-enables
  // without us having to reset state inside an effect.
  const activelyFiling = isFiling && allFilesPresent;

  function handleFileYourTax() {
    setFileError(null);
    setIsFiling(true);
  }

  // Once the user commits to filing, wait until every document has finished
  // parsing (isReadyToFile) before actually finalizing — the button is
  // intentionally clickable before parsing completes, so this may fire a beat
  // after the click once the last extraction lands.
  useEffect(() => {
    if (!activelyFiling || !isReadyToFile || filedRef.current) return; // still parsing / files not all in — keep waiting
    filedRef.current = true;
    (async () => {
      try {
        const res = await fetch("/api/documents/file", { method: "POST" });
        if (!res.ok) throw new Error("Couldn't finish filing — try again.");
        router.push("/dashboard");
      } catch (err) {
        setFileError(err instanceof Error ? err.message : "Something went wrong.");
        setIsFiling(false);
        filedRef.current = false;
      }
    })();
  }, [activelyFiling, isReadyToFile, router]);

  return (
    <WizardShell step={4} totalSteps={4} title="Upload your documents">
      <div className="space-y-6">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading your checklist...</p>
        ) : (
          <>
            {explanation && <p className="text-sm text-muted-foreground">{explanation}</p>}

            <div className="flex flex-wrap gap-2">
              {ALREADY_ON_FILE.map((doc) => (
                <Badge key={doc} variant="secondary">
                  {doc === "i94" ? "I-94" : "Travel history"} — already on file
                </Badge>
              ))}
            </div>

            {uploadDocs.length === 0 && incomeDocs.length === 0 && !needsI20 ? (
              <p className="text-sm text-foreground">
                Based on your answers, you don&apos;t have any other documents to upload right now.
              </p>
            ) : (
              // Slots are ordered biggest / most parse-heavy first, so the
              // longest-running extraction (a consolidated 1099 can run 20+
              // pages) starts as early as possible: 1099 → I-20 → W-2 → 1042-S.
              <div className="space-y-4">
                {incomeDocs.includes("f1099combined") && (
                  <Consolidated1099Slot
                    initialInts={f1099ints}
                    initialDivs={f1099divs}
                    initialBs={f1099bs}
                    initialDas={f1099das}
                    onIntsChange={setF1099ints}
                    onDivsChange={setF1099divs}
                    onBsChange={setF1099bs}
                    onDasChange={setF1099das}
                    onProcessingChange={(p) => setSlotProcessing("f1099combined", p)}
                  />
                )}

                {needsI20 && (
                  <I20Slot
                    initialSchool={school}
                    onConfirmedChange={setI20Confirmed}
                    onProcessingChange={setI20Processing}
                  />
                )}

                {incomeDocs.includes("w2") && (
                  <W2Slot
                    initialValue={w2s}
                    onItemsChange={setW2s}
                    onProcessingChange={(p) => setSlotProcessing("w2", p)}
                  />
                )}

                {incomeDocs.includes("f1042s") && (
                  <Income1042SSlot
                    initialValue={f1042s}
                    onItemsChange={setF1042s}
                    onProcessingChange={(p) => setSlotProcessing("f1042s", p)}
                  />
                )}

                {uploadDocs.map((doc) => (
                  <UploadSlot
                    key={doc}
                    docType={doc}
                    label={DOC_LABELS[doc] ?? doc}
                    initialFileName={uploadedDocuments[doc]?.fileName ?? null}
                  />
                ))}
              </div>
            )}

            {(missingDocs.length > 0 || i20Missing) && (
              <p className="text-xs text-muted-foreground">
                Still need to add:{" "}
                {[...(i20Missing ? ["I-20"] : []), ...missingDocs.map((doc) => DOC_LABELS[doc] ?? doc)].join(", ")}
              </p>
            )}
            {activelyFiling && !isReadyToFile && (
              <p className="text-xs text-muted-foreground">
                Finishing reading your documents — we&apos;ll file as soon as they&apos;re done.
              </p>
            )}
            {fileError && <p className="text-sm text-destructive">{fileError}</p>}

            <Button className="w-full" onClick={handleFileYourTax} disabled={!allFilesPresent || activelyFiling}>
              {activelyFiling ? (
                <span className="flex items-center gap-2">
                  <Spinner /> {isReadyToFile ? "Filing..." : "Almost there..."}
                </span>
              ) : (
                "File your Tax! →"
              )}
            </Button>

            <WizardBackOnly step={4} />
          </>
        )}
      </div>
    </WizardShell>
  );
}
