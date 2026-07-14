"use client";

import { useEffect, useState } from "react";
import { FileDropSlot } from "@/components/onboarding/file-drop-slot";
import type { I20ExtractResponse } from "@/app/api/documents/extract/i20/route";
import type { SchoolInfo } from "@/lib/types";

type Phase = "upload" | "processing";

// Silent EXTRACT-and-save for I-20, same pattern as the income-doc slots:
// upload → gpt-4o-mini reads schoolName/dsoName/dsoAddress, a web search
// fills in address/phone/dsoPhone → saved automatically to profile.school
// via /api/documents/i20. No confirm step, no fields shown.
export function I20Slot({
  initialSchool,
  onConfirmedChange,
}: {
  initialSchool: SchoolInfo | null;
  onConfirmedChange?: (confirmed: boolean) => void;
}) {
  const [confirmed, setConfirmed] = useState(Boolean(initialSchool));
  const [phase, setPhase] = useState<Phase>("upload");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    onConfirmedChange?.(confirmed);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [confirmed]);

  async function handleFile(file: File | null) {
    if (!file) return;
    setError(null);
    setPhase("processing");
    try {
      const uploadForm = new FormData();
      uploadForm.append("docType", "i20");
      uploadForm.append("file", file);
      const uploadPromise = fetch("/api/documents/upload", { method: "POST", body: uploadForm });

      const extractForm = new FormData();
      extractForm.append("i20", file);
      const extractPromise = fetch("/api/documents/extract/i20", { method: "POST", body: extractForm });

      const [, extractRes] = await Promise.all([uploadPromise, extractPromise]);
      if (!extractRes.ok) {
        const body = await extractRes.json().catch(() => null);
        throw new Error(body?.error ?? "Couldn't read this document.");
      }
      const data = (await extractRes.json()) as I20ExtractResponse;

      const school: SchoolInfo = {
        name: data.schoolName,
        address: data.address,
        phone: data.phone,
        dsoName: data.dsoName,
        dsoAddress: data.dsoAddress,
        dsoPhone: data.dsoPhone,
      };

      const saveRes = await fetch("/api/documents/i20", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ school }),
      });
      if (!saveRes.ok) throw new Error("Couldn't save this document.");

      setConfirmed(true);
      setPhase("upload");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setPhase("upload");
    }
  }

  return (
    <div className="space-y-1.5">
      {confirmed && <p className="text-xs text-muted-foreground">I-20 on file, confirmed.</p>}
      <FileDropSlot
        label={confirmed ? "Replace I-20" : "I-20"}
        description={phase === "processing" ? "Reading your document..." : undefined}
        file={null}
        onChange={handleFile}
      />
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
