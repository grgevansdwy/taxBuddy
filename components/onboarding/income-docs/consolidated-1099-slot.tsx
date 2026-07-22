"use client";

import { useEffect, useState } from "react";
import { FileDropSlot } from "@/components/onboarding/file-drop-slot";
import type { F1099BData, F1099BTransaction, F1099DAData, F1099DIVData, F1099INTData } from "@/lib/types";

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

// Brokers issue one "Consolidated 1099" PDF covering the INT/DIV/B (and,
// increasingly, DA/digital-asset) sections together (this is what a real
// Robinhood/Fidelity/Schwab 1099 looks like) — one upload, one dropzone.
// Each of the 4 extraction endpoints runs against the same file and reports
// sectionPresent so a document missing one section (e.g. dividends but no
// broker sales) doesn't fabricate an entry for it. No confirm step —
// extraction results are saved automatically; per-box numbers are
// intentionally not shown here (see conversation).
export function Consolidated1099Slot({
  initialInts,
  initialDivs,
  initialBs,
  initialDas,
  onIntsChange,
  onDivsChange,
  onBsChange,
  onDasChange,
  onProcessingChange,
}: {
  initialInts: F1099INTData[];
  initialDivs: F1099DIVData[];
  initialBs: F1099BData[];
  initialDas: F1099DAData[];
  onIntsChange?: (items: F1099INTData[]) => void;
  onDivsChange?: (items: F1099DIVData[]) => void;
  onBsChange?: (items: F1099BData[]) => void;
  onDasChange?: (items: F1099DAData[]) => void;
  onProcessingChange?: (processing: boolean) => void;
}) {
  const [ints, setInts] = useState<F1099INTData[]>(initialInts);
  const [divs, setDivs] = useState<F1099DIVData[]>(initialDivs);
  const [bs, setBs] = useState<F1099BData[]>(initialBs);
  const [das, setDas] = useState<F1099DAData[]>(initialDas);
  // The filename of the statement currently parsing (shown as a transient chip);
  // settled statements are shown grouped by payer instead — see below.
  const [pendingName, setPendingName] = useState<string | null>(null);
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
  useEffect(() => {
    onDasChange?.(das);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [das]);
  useEffect(() => {
    onProcessingChange?.(phase === "processing");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  async function handleFile(file: File | null) {
    if (!file) return;
    setError(null);
    setLastFound(null);
    // Show the filename chip instantly on select — don't wait for extraction.
    setPendingName(file.name);
    setPhase("processing");
    try {
      const uploadForm = new FormData();
      uploadForm.append("docType", "f1099combined");
      uploadForm.append("file", file);

      const [, intResult, divResult, bResult, daResult] = await Promise.all([
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
          { payerName: string; transactions: Omit<F1099BTransaction, "realizedGainLoss">[]; reportedNetGainLoss: number | null } & {
            sectionPresent: boolean;
            confidence: number;
          }
        >(file, "f1099b", "/api/documents/extract/f1099b"),
        extractSection<
          { payerName: string; transactions: Omit<F1099BTransaction, "realizedGainLoss">[]; reportedNetGainLoss: number | null } & {
            sectionPresent: boolean;
            confidence: number;
          }
        >(file, "f1099da", "/api/documents/extract/f1099da"),
      ]);

      const found: string[] = [];
      let nextInts = ints;
      let nextDivs = divs;
      let nextBs = bs;
      let nextDas = das;

      if (intResult) {
        nextInts = [...ints, intResult];
        found.push("interest");
      }
      if (divResult) {
        nextDivs = [...divs, divResult];
        found.push("dividends");
      }
      if (bResult) {
        nextBs = [...bs, { payerName: bResult.payerName, reportedNetGainLoss: bResult.reportedNetGainLoss, transactions: bResult.transactions.map((t) => ({ ...t, realizedGainLoss: 0 })) }];
        found.push("broker transactions");
      }
      if (daResult) {
        nextDas = [...das, { payerName: daResult.payerName, reportedNetGainLoss: daResult.reportedNetGainLoss, transactions: daResult.transactions.map((t) => ({ ...t, realizedGainLoss: 0 })) }];
        found.push("digital asset transactions");
      }

      if (found.length === 0) {
        // Nothing usable in the doc — take the optimistic chip back down.
        setPendingName(null);
        setError("Couldn't find an interest, dividend, broker-transaction, or digital-asset section on this document.");
        setPhase("upload");
        return;
      }

      await Promise.all([
        intResult ? saveField("f1099ints", nextInts) : Promise.resolve(),
        divResult ? saveField("f1099divs", nextDivs) : Promise.resolve(),
        bResult ? saveField("f1099bs", nextBs) : Promise.resolve(),
        daResult ? saveField("f1099das", nextDas) : Promise.resolve(),
      ]);

      setInts(nextInts);
      setDivs(nextDivs);
      setBs(nextBs);
      setDas(nextDas);
      setPendingName(null);
      setLastFound(found);
      setPhase("upload");
    } catch (err) {
      // Roll back the chip we optimistically showed on select.
      setPendingName(null);
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setPhase("upload");
    }
  }

  // Remove one uploaded statement and re-persist. A consolidated 1099 is from a
  // single broker, so all of its sections share one payerName — filter every
  // array by that payer and save back only the ones that changed.
  async function handleRemoveStatement(index: number) {
    const payer = statementPayers[index];
    if (payer == null) return;
    const nextInts = ints.filter((d) => d.payerName !== payer);
    const nextDivs = divs.filter((d) => d.payerName !== payer);
    const nextBs = bs.filter((d) => d.payerName !== payer);
    const nextDas = das.filter((d) => d.payerName !== payer);
    setInts(nextInts);
    setDivs(nextDivs);
    setBs(nextBs);
    setDas(nextDas);
    setLastFound(null);
    try {
      await Promise.all([
        nextInts.length !== ints.length ? saveField("f1099ints", nextInts) : Promise.resolve(),
        nextDivs.length !== divs.length ? saveField("f1099divs", nextDivs) : Promise.resolve(),
        nextBs.length !== bs.length ? saveField("f1099bs", nextBs) : Promise.resolve(),
        nextDas.length !== das.length ? saveField("f1099das", nextDas) : Promise.resolve(),
      ]);
    } catch {
      setError("Couldn't remove that statement. Please refresh and try again.");
    }
  }

  const totalCount = ints.length + divs.length + bs.length + das.length;
  // One chip per statement, grouped by payer (a consolidated 1099 is from one
  // broker) so both fresh and rehydrated statements are removable. The in-flight
  // upload's filename is appended while it parses.
  const statementPayers = Array.from(
    new Set([...ints, ...divs, ...bs, ...das].map((d) => d.payerName)),
  );
  const displayNames =
    phase === "processing" && pendingName ? [...statementPayers, pendingName] : statementPayers;

  return (
    <div className="space-y-1.5">
      <FileDropSlot
        label={totalCount > 0 ? "Add another 1099" : "1099 (Interest / Dividends / Broker / Digital Assets)"}
        fileNames={displayNames}
        onChange={handleFile}
        // Only removable while idle — the pending chip isn't a saved statement yet.
        onRemove={phase === "upload" ? handleRemoveStatement : undefined}
      />
      {lastFound && (
        <p className="text-xs text-foreground">Found and saved: {lastFound.join(", ")}.</p>
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
