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
  // Name chips stay index-aligned with `items`: rehydrated docs (no original
  // filename) fall back to their employer name so they're still identifiable
  // and removable.
  const [names, setNames] = useState<string[]>(() =>
    initialValue.map((w) => w.employerName || "W-2"),
  );
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
    // Show the filename chip instantly on select — don't wait for extraction.
    setNames((prev) => [...prev, file.name]);
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
      // Roll back the chip we optimistically showed on select.
      setNames((prev) => {
        const idx = prev.lastIndexOf(file.name);
        return idx < 0 ? prev : prev.filter((_, i) => i !== idx);
      });
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setPhase("upload");
    }
  }

  // Remove one uploaded W-2 (e.g. an accidental duplicate) and re-persist the
  // remaining set. names and items are index-aligned when settled, so remove by
  // index from both. Gated to the idle phase by the caller.
  async function handleRemove(index: number) {
    const nextItems = items.filter((_, i) => i !== index);
    setItems(nextItems);
    setNames((prev) => prev.filter((_, i) => i !== index));
    try {
      const res = await fetch("/api/documents/income", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ field: "w2s", value: nextItems }),
      });
      if (!res.ok) throw new Error();
    } catch {
      setError("Couldn't remove that document. Please refresh and try again.");
    }
  }

  return (
    <div className="space-y-1.5">
      <FileDropSlot
        label={items.length > 0 ? "Add another W-2" : "W-2"}
        fileNames={names}
        onChange={handleFile}
        // Only removable while idle — during processing the pending chip isn't
        // yet index-aligned with `items`.
        onRemove={phase === "upload" ? handleRemove : undefined}
      />
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
