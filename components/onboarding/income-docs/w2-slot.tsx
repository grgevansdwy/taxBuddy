"use client";

import { useEffect, useState } from "react";
import { FileDropSlot } from "@/components/onboarding/file-drop-slot";
import type { W2Extraction } from "@/lib/extraction/schemas/w2";
import type { W2Data } from "@/lib/types";

type Phase = "upload" | "processing";

// Silent EXTRACT-and-save for W-2: upload one document at a time →
// gpt-4o-mini reads it → appended automatically to filings.w2s. A student can
// have more than one employer, so repeated uploads keep adding entries. No
// confirm step and no numbers shown — just upload → done.
export function W2Slot({
  initialValue,
  onItemsChange,
  onProcessingChange,
}: {
  initialValue: W2Data[];
  onItemsChange?: (items: W2Data[]) => void;
  onProcessingChange?: (processing: boolean) => void;
}) {
  const [items, setItems] = useState<W2Data[]>(initialValue);
  const [phase, setPhase] = useState<Phase>("upload");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    onItemsChange?.(items);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);

  useEffect(() => {
    onProcessingChange?.(phase === "processing");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  async function handleFile(file: File | null) {
    if (!file) return;
    setError(null);
    setPhase("processing");
    try {
      const uploadForm = new FormData();
      uploadForm.append("docType", "w2");
      uploadForm.append("file", file);
      const uploadPromise = fetch("/api/documents/upload", { method: "POST", body: uploadForm });

      const extractForm = new FormData();
      extractForm.append("w2", file);
      const extractPromise = fetch("/api/documents/extract/w2", { method: "POST", body: extractForm });

      const [, extractRes] = await Promise.all([uploadPromise, extractPromise]);
      if (!extractRes.ok) {
        const body = await extractRes.json().catch(() => null);
        throw new Error(body?.error ?? "Couldn't read this document.");
      }
      const data = (await extractRes.json()) as W2Extraction;
      const nextItems: W2Data[] = [
        ...items,
        {
          employerName: data.employerName,
          employerEin: data.employerEin,
          employerAddress: data.employerAddress,
          box1: data.box1,
          box2: data.box2,
          box3: data.box3,
          box4: data.box4,
          box5: data.box5,
          box6: data.box6,
          box15State: data.box15State,
          box17StateTaxWithheld: data.box17StateTaxWithheld,
        },
      ];

      const saveRes = await fetch("/api/documents/income", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ field: "w2s", value: nextItems }),
      });
      if (!saveRes.ok) throw new Error("Couldn't save this document.");

      setItems(nextItems);
      setPhase("upload");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setPhase("upload");
    }
  }

  return (
    <div className="space-y-1.5">
      {items.length > 0 && (
        <p className="text-xs text-muted-foreground">
          {items.length} W-2 document{items.length === 1 ? "" : "s"} on file, confirmed.
        </p>
      )}
      <FileDropSlot
        label={items.length > 0 ? "Add another W-2" : "W-2"}
        description={phase === "processing" ? "Reading your document..." : undefined}
        file={null}
        onChange={handleFile}
      />
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
