"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const FORMS = [
  { key: "1040nr", label: "Form 1040-NR" },
  { key: "f8843", label: "Form 8843" },
  { key: "schedNEC", label: "Schedule NEC" },
  { key: "schedOI", label: "Schedule OI" },
  { key: "schedA", label: "Schedule A" },
  { key: "f8833", label: "Form 8833" },
] as const;

type FormKey = (typeof FORMS)[number]["key"];
type Status = "idle" | "loading" | "done" | "error";

interface PreviewResult {
  computed: Record<string, string>;
  unmapped: string[];
  actual: Record<string, string>;
}

function FormCard({ formKey, label }: { formKey: FormKey; label: string }) {
  const [status, setStatus] = useState<Status>("idle");
  const [result, setResult] = useState<PreviewResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleGenerate() {
    setStatus("loading");
    setError(null);
    try {
      const res = await fetch(`/api/dev/form-preview?form=${formKey}`);
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error ?? "Preview failed.");
      setResult(body as PreviewResult);
      setStatus("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setStatus("error");
    }
  }

  const allKeys = result ? Array.from(new Set([...Object.keys(result.computed), ...Object.keys(result.actual)])) : [];

  return (
    <div className="space-y-3 rounded-2xl border border-input p-4">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-foreground">{label}</span>
        <div className="flex items-center gap-2">
          {status === "loading" && <Badge variant="secondary">Generating…</Badge>}
          {status === "done" && <Badge variant="secondary">Done</Badge>}
          {status === "error" && <Badge variant="destructive">Error</Badge>}
          <Button size="sm" variant="outline" onClick={handleGenerate} disabled={status === "loading"}>
            Generate {label}
          </Button>
          <a href={`/api/documents/generate/${formKey}`} target="_blank" rel="noreferrer">
            <Button size="sm" variant="outline">
              Download PDF
            </Button>
          </a>
        </div>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {result && (
        <div className="space-y-2">
          {result.unmapped.length > 0 && (
            <p className="text-xs text-destructive">
              Computed but no field-map entry (silently dropped): {result.unmapped.join(", ")}
            </p>
          )}
          <div className="max-h-96 overflow-auto rounded-xl border border-input">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-muted">
                <tr>
                  <th className="p-2 text-left">Key</th>
                  <th className="p-2 text-left">Computed</th>
                  <th className="p-2 text-left">Actually in PDF</th>
                </tr>
              </thead>
              <tbody>
                {allKeys.map((key) => {
                  const computedVal = result.computed[key] ?? "";
                  const actualVal = result.actual[key] ?? "";
                  const mismatch = key in result.computed && computedVal !== actualVal;
                  return (
                    <tr key={key} className={mismatch ? "bg-destructive/10" : undefined}>
                      <td className="whitespace-nowrap p-2 font-mono">{key}</td>
                      <td className="whitespace-pre-wrap p-2">{computedVal}</td>
                      <td className="whitespace-pre-wrap p-2">{actualVal}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// Internal tool, not part of the onboarding wizard: reads the logged-in
// user's own already-saved filing data (assumes onboarding was completed
// normally) and runs the real rules-engine + PDF-fill pipeline per form —
// the same loadEngineContext()/compute*/fieldMap/fillPdfForm every
// /api/documents/generate/* route uses. "Generate" shows computed line
// values next to what actually landed in the filled PDF's fields, side by
// side, so a bad field mapping or truncated value is visible without
// downloading and eyeballing a PDF. "Download PDF" hits the real production
// route for a normal file. Nothing here is saved.
export default function FormPreviewPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-6 p-8">
      <div>
        <h1 className="text-xl font-bold text-foreground">Form generation preview (internal)</h1>
        <p className="text-sm text-muted-foreground">
          Uses your own saved filing data. &quot;Generate&quot; shows computed values vs. what actually ended up
          in the PDF&apos;s fields; &quot;Download PDF&quot; gets the real file.
        </p>
      </div>

      <div className="space-y-4">
        {FORMS.map(({ key, label }) => (
          <FormCard key={key} formKey={key} label={label} />
        ))}
      </div>
    </div>
  );
}
