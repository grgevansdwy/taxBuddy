"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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

  const [f1042s, setF1042s] = useState<F1042SData[]>([]);
  const [f1099ints, setF1099ints] = useState<F1099INTData[]>([]);
  const [f1099divs, setF1099divs] = useState<F1099DIVData[]>([]);
  const [f1099bs, setF1099bs] = useState<F1099BData[]>([]);
  const [w2s, setW2s] = useState<W2Data[]>([]);

  const [school, setSchool] = useState<SchoolInfo | null>(null);
  const [i20Confirmed, setI20Confirmed] = useState(false);

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

  // What's still blocking "File your Tax!" — every flagged income document
  // needs at least one confirmed entry. Nothing here is ever assumed.
  const docConfirmed: Partial<Record<DocType, boolean>> = {
    f1042s: f1042s.length > 0,
    f1099combined: f1099ints.length > 0 || f1099divs.length > 0 || f1099bs.length > 0,
    w2: w2s.length > 0,
  };
  const pendingDocs = incomeDocs.filter((doc) => !docConfirmed[doc]);
  const i20Pending = needsI20 && !i20Confirmed;
  const isReadyToFile = pendingDocs.length === 0 && !i20Pending;

  async function handleFileYourTax() {
    setIsFiling(true);
    setFileError(null);
    try {
      const res = await fetch("/api/documents/file", { method: "POST" });
      if (!res.ok) throw new Error("Couldn't finish filing — try again.");
      router.push("/dashboard");
    } catch (err) {
      setFileError(err instanceof Error ? err.message : "Something went wrong.");
      setIsFiling(false);
    }
  }

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
              <div className="space-y-4">
                {needsI20 && <I20Slot initialSchool={school} onConfirmedChange={setI20Confirmed} />}

                {uploadDocs.map((doc) => (
                  <UploadSlot
                    key={doc}
                    docType={doc}
                    label={DOC_LABELS[doc] ?? doc}
                    initialFileName={uploadedDocuments[doc]?.fileName ?? null}
                  />
                ))}

                {incomeDocs.includes("f1042s") && (
                  <Income1042SSlot initialValue={f1042s} onItemsChange={setF1042s} />
                )}
                {incomeDocs.includes("f1099combined") && (
                  <Consolidated1099Slot
                    initialInts={f1099ints}
                    initialDivs={f1099divs}
                    initialBs={f1099bs}
                    onIntsChange={setF1099ints}
                    onDivsChange={setF1099divs}
                    onBsChange={setF1099bs}
                  />
                )}
                {incomeDocs.includes("w2") && <W2Slot initialValue={w2s} onItemsChange={setW2s} />}
              </div>
            )}

            {(pendingDocs.length > 0 || i20Pending) && (
              <p className="text-xs text-muted-foreground">
                Still need to confirm:{" "}
                {[...(i20Pending ? ["I-20"] : []), ...pendingDocs.map((doc) => DOC_LABELS[doc] ?? doc)].join(", ")}
              </p>
            )}
            {fileError && <p className="text-sm text-destructive">{fileError}</p>}

            <Button className="w-full" onClick={handleFileYourTax} disabled={!isReadyToFile || isFiling}>
              {isFiling ? "Filing..." : "File your Tax! →"}
            </Button>

            <WizardBackOnly step={4} />
          </>
        )}
      </div>
    </WizardShell>
  );
}
