"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FileDropSlot } from "@/components/onboarding/file-drop-slot";
import { EXTRACTION_SPECS, type ExtractionKind } from "@/lib/ai/extractionSpecs";

const KIND_LABELS: Record<ExtractionKind, string> = {
  i94: "I-94",
  i20: "I-20",
  w2: "W-2",
  f1042s: "1042-S",
  f1099int: "1099-INT",
  f1099div: "1099-DIV",
  f1099b: "1099-B",
  f1099da: "1099-DA",
};

const KINDS = Object.keys(EXTRACTION_SPECS) as ExtractionKind[];

type Status = "idle" | "parsing" | "extracting" | "done" | "error";

function downloadMarkdown(fileName: string, markdown: string) {
  const blob = new Blob([markdown], { type: "text/markdown" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${fileName}.md`;
  a.click();
  URL.revokeObjectURL(url);
}

// One card per extraction kind — dropping the required file(s) automatically
// runs the full pipeline (LlamaParse -> markdown -> gpt-4o-mini -> JSON
// matching the Zod schema in lib/extraction/schemas/), no manual "pick a
// type" step or Extract button. I-94 just has two file slots instead of one.
function KindCard({ kind }: { kind: ExtractionKind }) {
  const documentTitles = EXTRACTION_SPECS[kind].documentTitles;
  const [files, setFiles] = useState<(File | null)[]>(Array(documentTitles.length).fill(null));
  const [markdowns, setMarkdowns] = useState<(string | null)[]>(Array(documentTitles.length).fill(null));
  const [status, setStatus] = useState<Status>("idle");
  const [extraction, setExtraction] = useState<unknown>(null);
  const [webSearch, setWebSearch] = useState<unknown>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleFileChange(index: number, file: File | null) {
    const nextFiles = [...files];
    nextFiles[index] = file;
    setFiles(nextFiles);
    setExtraction(null);
    setWebSearch(null);
    setError(null);

    if (nextFiles.some((f) => f === null)) {
      setStatus("idle");
      return;
    }

    setStatus("parsing");
    try {
      const parsedMarkdowns = await Promise.all(
        nextFiles.map(async (f) => {
          const formData = new FormData();
          formData.append("file", f as File);
          const res = await fetch("/api/dev/parse-preview", { method: "POST", body: formData });
          const body = await res.json();
          if (!res.ok) throw new Error(body?.error ?? "Parse failed.");
          return body.markdown as string;
        })
      );
      setMarkdowns(parsedMarkdowns);

      setStatus("extracting");
      const documents = parsedMarkdowns.map((markdown, i) => ({ title: documentTitles[i], markdown }));
      const extractRes = await fetch("/api/dev/extract-preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, documents }),
      });
      const extractBody = await extractRes.json();
      if (!extractRes.ok) throw new Error(extractBody?.error ?? "Extraction failed.");
      setExtraction(extractBody.extraction);
      setWebSearch(extractBody.webSearch ?? null);
      setStatus("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setStatus("error");
    }
  }

  function reset() {
    setFiles(Array(documentTitles.length).fill(null));
    setMarkdowns(Array(documentTitles.length).fill(null));
    setExtraction(null);
    setWebSearch(null);
    setError(null);
    setStatus("idle");
  }

  return (
    <div className="space-y-3 rounded-2xl border border-input p-4">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-foreground">{KIND_LABELS[kind]}</span>
        <div className="flex items-center gap-2">
          {status === "parsing" && <Badge variant="secondary">Parsing…</Badge>}
          {status === "extracting" && <Badge variant="secondary">Extracting…</Badge>}
          {status === "done" && <Badge variant="secondary">Done</Badge>}
          {status === "error" && <Badge variant="destructive">Error</Badge>}
          {files.some(Boolean) && (
            <Button size="sm" variant="outline" onClick={reset}>
              Reset
            </Button>
          )}
        </div>
      </div>

      <div className={documentTitles.length > 1 ? "grid grid-cols-2 gap-2" : ""}>
        {documentTitles.map((title, i) => (
          <FileDropSlot
            key={title}
            label={title}
            file={files[i]}
            onChange={(file) => handleFileChange(i, file)}
          />
        ))}
      </div>

      {markdowns.map(
        (markdown, i) =>
          markdown && (
            <div key={i} className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">
                  Markdown{documentTitles.length > 1 ? ` — ${documentTitles[i]}` : ""}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => downloadMarkdown(files[i]?.name ?? documentTitles[i], markdown)}
                >
                  Download .md
                </Button>
              </div>
              <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded-xl bg-muted p-3 text-xs">
                {markdown}
              </pre>
            </div>
          )
      )}

      {extraction != null && (
        <div className="space-y-1">
          <span className="text-xs font-medium text-muted-foreground">Extracted JSON</span>
          <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded-xl bg-muted p-3 text-xs">
            {JSON.stringify(extraction, null, 2)}
          </pre>
        </div>
      )}

      {webSearch != null && (
        <div className="space-y-1">
          <span className="text-xs font-medium text-muted-foreground">Web search result</span>
          <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded-xl bg-muted p-3 text-xs">
            {JSON.stringify(webSearch, null, 2)}
          </pre>
        </div>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}

// Internal tool, not part of the onboarding wizard: one drop zone per
// document type, each running the real production pipeline
// (parsePdfToMarkdown + extractFromMarkdown) end to end on upload. Nothing
// here is saved.
export default function ParsePreviewPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-6 p-8">
      <div>
        <h1 className="text-xl font-bold text-foreground">Extraction preview (internal)</h1>
        <p className="text-sm text-muted-foreground">
          Drop a document into the matching slot below — it parses with LlamaParse and extracts with
          gpt-4o-mini automatically, no extra steps. Nothing here is saved.
        </p>
      </div>

      <div className="space-y-4">
        {KINDS.map((kind) => (
          <KindCard key={kind} kind={kind} />
        ))}
      </div>
    </div>
  );
}
