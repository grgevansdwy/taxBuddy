"use client";

import { useEffect, useState } from "react";
import { FileDropSlot } from "@/components/onboarding/file-drop-slot";
import type { F1099BData, F1099BTransaction, F1099DIVData, F1099INTData } from "@/lib/types";

type Phase = "upload" | "processing";

async function extractSection<T extends { sectionPresent: boolean; confidence: number }>(
  file: File,
  formDataKey: string,
  endpoint: string
): Promise<T | null> {
  const form = new FormData();
  form.append(formDataKey, file);
  const res = await fetch(endpoint, { method: "POST", body: form });
  if (!res.ok) return null;
  const data = (await res.json()) as T;
  return data.sectionPresent ? data : null;
}

async function saveField(field: string, value: unknown) {
  await fetch("/api/documents/income", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ field, value }),
  });
}

// Brokers issue one "Consolidated 1099" PDF covering the INT/DIV/B sections
// together (this is what a real Robinhood/Fidelity/Schwab 1099 looks like) —
// one upload, one dropzone. Each of the 3 existing extraction endpoints runs
// against the same file and reports sectionPresent so a document missing one
// section (e.g. dividends but no broker sales) doesn't fabricate an entry
// for it. No confirm step — extraction results are saved automatically;
// per-box numbers are intentionally not shown here (see conversation).
export function Consolidated1099Slot({
  initialInts,
  initialDivs,
  initialBs,
  onIntsChange,
  onDivsChange,
  onBsChange,
}: {
  initialInts: F1099INTData[];
  initialDivs: F1099DIVData[];
  initialBs: F1099BData[];
  onIntsChange?: (items: F1099INTData[]) => void;
  onDivsChange?: (items: F1099DIVData[]) => void;
  onBsChange?: (items: F1099BData[]) => void;
}) {
  const [ints, setInts] = useState<F1099INTData[]>(initialInts);
  const [divs, setDivs] = useState<F1099DIVData[]>(initialDivs);
  const [bs, setBs] = useState<F1099BData[]>(initialBs);
  const [phase, setPhase] = useState<Phase>("upload");
  const [error, setError] = useState<string | null>(null);
  const [lastFound, setLastFound] = useState<string[] | null>(null);

  useEffect(() => {
    onIntsChange?.(ints);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ints]);
  useEffect(() => {
    onDivsChange?.(divs);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [divs]);
  useEffect(() => {
    onBsChange?.(bs);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bs]);

  async function handleFile(file: File | null) {
    if (!file) return;
    setError(null);
    setLastFound(null);
    setPhase("processing");
    try {
      const uploadForm = new FormData();
      uploadForm.append("docType", "f1099combined");
      uploadForm.append("file", file);

      const [, intResult, divResult, bResult] = await Promise.all([
        fetch("/api/documents/upload", { method: "POST", body: uploadForm }),
        extractSection<F1099INTData & { sectionPresent: boolean; confidence: number }>(
          file,
          "f1099int",
          "/api/documents/extract/f1099int"
        ),
        extractSection<F1099DIVData & { sectionPresent: boolean; confidence: number }>(
          file,
          "f1099div",
          "/api/documents/extract/f1099div"
        ),
        extractSection<
          { payerName: string; transactions: Omit<F1099BTransaction, "realizedGainLoss">[] } & {
            sectionPresent: boolean;
            confidence: number;
          }
        >(file, "f1099b", "/api/documents/extract/f1099b"),
      ]);

      const found: string[] = [];
      let nextInts = ints;
      let nextDivs = divs;
      let nextBs = bs;

      if (intResult) {
        nextInts = [...ints, intResult];
        found.push("interest");
      }
      if (divResult) {
        nextDivs = [...divs, divResult];
        found.push("dividends");
      }
      if (bResult) {
        nextBs = [...bs, { payerName: bResult.payerName, transactions: bResult.transactions.map((t) => ({ ...t, realizedGainLoss: 0 })) }];
        found.push("broker transactions");
      }

      if (found.length === 0) {
        setError("Couldn't find an interest, dividend, or broker-transaction section on this document.");
        setPhase("upload");
        return;
      }

      await Promise.all([
        intResult ? saveField("f1099ints", nextInts) : Promise.resolve(),
        divResult ? saveField("f1099divs", nextDivs) : Promise.resolve(),
        bResult ? saveField("f1099bs", nextBs) : Promise.resolve(),
      ]);

      setInts(nextInts);
      setDivs(nextDivs);
      setBs(nextBs);
      setLastFound(found);
      setPhase("upload");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setPhase("upload");
    }
  }

  const totalCount = ints.length + divs.length + bs.length;

  return (
    <div className="space-y-1.5">
      {totalCount > 0 && (
        <p className="text-xs text-muted-foreground">
          On file: {ints.length > 0 && `${ints.length} interest`}
          {ints.length > 0 && (divs.length > 0 || bs.length > 0) && ", "}
          {divs.length > 0 && `${divs.length} dividend`}
          {divs.length > 0 && bs.length > 0 && ", "}
          {bs.length > 0 && `${bs.length} broker`} document{totalCount === 1 ? "" : "s"} confirmed.
        </p>
      )}
      <FileDropSlot
        label={totalCount > 0 ? "Add another 1099" : "1099 (Interest / Dividends / Broker)"}
        description={phase === "processing" ? "Reading your document..." : undefined}
        file={null}
        onChange={handleFile}
      />
      {lastFound && (
        <p className="text-xs text-foreground">Found and saved: {lastFound.join(", ")}.</p>
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
