"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { WizardShell } from "@/components/onboarding/wizard-shell";
import { WizardBackOnly } from "@/components/onboarding/wizard-nav-row";
import { UploadSlot } from "@/components/onboarding/upload-slot";
import { DOC_LABELS } from "@/lib/config/docLabels";
import type { DocType } from "@/lib/types";
import type { FilingResponse, UploadedDocument } from "@/app/api/filing/route";

const ALREADY_ON_FILE: DocType[] = ["i94", "travel_history"];

export default function DocumentsPage() {
  const [documents, setDocuments] = useState<DocType[]>([]);
  const [explanation, setExplanation] = useState("");
  const [uploadedDocuments, setUploadedDocuments] = useState<Partial<Record<DocType, UploadedDocument>>>({});
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/documents/checklist").then((res) => res.json()) as Promise<{
        documents: DocType[];
        explanation: string;
      }>,
      fetch("/api/filing").then((res) => res.json()) as Promise<FilingResponse>,
    ])
      .then(([checklist, filing]) => {
        setDocuments(checklist.documents ?? []);
        setExplanation(checklist.explanation ?? "");
        setUploadedDocuments(filing.uploadedDocuments ?? {});
      })
      .finally(() => setIsLoading(false));
  }, []);

  // I-20 is extracted later in the system, not confirmed here — this page
  // just needs the raw file on file, same as every other upload slot.
  const uploadDocs = documents.filter((doc) => !ALREADY_ON_FILE.includes(doc));

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

            {uploadDocs.length === 0 ? (
              <p className="text-sm text-foreground">
                Based on your answers, you don&apos;t have any other documents to upload right now.
              </p>
            ) : (
              <div className="space-y-4">
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

            {/* Preview only — the real Stage 4 review/output page isn't built yet.
                This proves the compute + fill pipeline end to end. */}
            <a href="/api/documents/generate/f8843" className="block">
              <Button variant="outline" className="w-full">
                Preview: Download Form 8843
              </Button>
            </a>

            <WizardBackOnly step={4} />
          </>
        )}
      </div>
    </WizardShell>
  );
}
