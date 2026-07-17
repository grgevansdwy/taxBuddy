"use client";

import { useEffect, useState } from "react";
import { FileDropSlot } from "@/components/onboarding/file-drop-slot";
import type { F1042SExtraction } from "@/lib/extraction/schemas/f1042s";
import type { F1042SData } from "@/lib/types";

type Phase = "upload" | "processing";

// Silent EXTRACT-and-save for 1042-S: upload one document at a time →
// Claude reads it → appended automatically to filings.f1042s. A student can
// have more than one payer, so repeated uploads keep adding entries. No
// confirm step and no numbers shown — just upload → done.
export function Income1042SSlot({
  initialValue,
  onItemsChange,
  onProcessingChange,
}: {
  initialValue: F1042SData[];
  onItemsChange?: (items: F1042SData[]) => void;
  onProcessingChange?: (processing: boolean) => void;
}) {
  const [items, setItems] = useState<F1042SData[]>(initialValue);
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
      uploadForm.append("docType", "f1042s");
      uploadForm.append("file", file);
      const uploadPromise = fetch("/api/documents/upload", { method: "POST", body: uploadForm });

      const extractForm = new FormData();
      extractForm.append("f1042s", file);
      const extractPromise = fetch("/api/documents/extract/f1042s", { method: "POST", body: extractForm });

      const [, extractRes] = await Promise.all([uploadPromise, extractPromise]);
      if (!extractRes.ok) {
        const body = await extractRes.json().catch(() => null);
        throw new Error(body?.error ?? "Couldn't read this document.");
      }
      const data = (await extractRes.json()) as F1042SExtraction;
      const nextItems: F1042SData[] = [
        ...items,
        {
          incomeCode: data.incomeCode,
          grossIncome: data.grossIncome,
          exemptionCode: data.exemptionCode,
          exemptionRate: data.exemptionRate,
          taxWithheld: data.taxWithheld,
          countryCode: data.countryCode,
          withholdingCredit: data.withholdingCredit,
        },
      ];

      const saveRes = await fetch("/api/documents/income", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ field: "f1042s", value: nextItems }),
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
          {items.length} 1042-S document{items.length === 1 ? "" : "s"} on file, confirmed.
        </p>
      )}
      <FileDropSlot
        label={items.length > 0 ? "Add another 1042-S" : "1042-S"}
        description={phase === "processing" ? "Reading your document..." : undefined}
        file={null}
        onChange={handleFile}
      />
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
