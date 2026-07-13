"use client";

import { useEffect, useState } from "react";
import { FileDropSlot } from "@/components/onboarding/file-drop-slot";
import type { F1098TExtraction } from "@/lib/extraction/schemas/f1098t";
import type { F1098TData } from "@/lib/types";

type Phase = "upload" | "processing";

// Silent EXTRACT-and-save for the 1098-T: upload → Claude reads box 1/box 5
// → saved automatically to filings.f1098t. No confirm step and no numbers
// shown here — just upload → done.
export function Scholarship1098TSlot({
  initialValue,
  onConfirmedChange,
}: {
  initialValue: F1098TData | null;
  onConfirmedChange?: (confirmed: boolean) => void;
}) {
  const [value, setValue] = useState<F1098TData | null>(initialValue);
  const [phase, setPhase] = useState<Phase>("upload");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    onConfirmedChange?.(value !== null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  async function handleFile(file: File | null) {
    if (!file) return;
    setError(null);
    setPhase("processing");
    try {
      const uploadForm = new FormData();
      uploadForm.append("docType", "f1098t");
      uploadForm.append("file", file);
      const uploadPromise = fetch("/api/documents/upload", { method: "POST", body: uploadForm });

      const extractForm = new FormData();
      extractForm.append("f1098t", file);
      const extractPromise = fetch("/api/documents/extract/f1098t", { method: "POST", body: extractForm });

      const [, extractRes] = await Promise.all([uploadPromise, extractPromise]);
      if (!extractRes.ok) {
        const body = await extractRes.json().catch(() => null);
        throw new Error(body?.error ?? "Couldn't read this document.");
      }
      const data = (await extractRes.json()) as F1098TExtraction;
      const nextValue: F1098TData = { box1: data.box1, box5: data.box5 };

      const saveRes = await fetch("/api/documents/income", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ field: "f1098t", value: nextValue }),
      });
      if (!saveRes.ok) throw new Error("Couldn't save this document.");

      setValue(nextValue);
      setPhase("upload");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setPhase("upload");
    }
  }

  return (
    <div className="space-y-1.5">
      {value !== null && <p className="text-xs text-muted-foreground">1098-T on file, confirmed.</p>}
      <FileDropSlot
        label={value !== null ? "Replace 1098-T" : "1098-T"}
        description={phase === "processing" ? "Reading your document..." : undefined}
        file={null}
        onChange={handleFile}
      />
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
