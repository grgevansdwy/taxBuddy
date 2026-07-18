"use client";

import { useCallback, useEffect, useMemo, useState, type Dispatch, type SetStateAction } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Logic Viz (internal audit tool) — renders the filled Form 1040-NR for a fixed
// synthetic filer (Indonesian, non-scholarship F-1 student) and, for every
// field the engine fills, shows exactly where the number comes from: which
// W-2/1099 box, which interview question, which treaty article, which upstream
// line, and which line of engine code. The numbers come live from the real
// engine via /api/dev/logic-viz (recomputed per request → can't drift); the
// source annotations come from lib/audit/provenance1040nr.ts.
//
// Purpose: give the team and outside tax consultants an auditable surface that
// mirrors the code step-by-step, instead of reading TypeScript. Scope is
// deliberately one case; adding cases later is just another fixture + route.

type SourceRef =
  | { kind: "document"; doc: string; box?: string; note?: string }
  | { kind: "interview"; question: string; field: string }
  | { kind: "treaty"; article: string; citation?: string; note: string }
  | { kind: "config"; note: string }
  | { kind: "line"; line: string; note?: string };

interface LineProvenance {
  line: string;
  label: string;
  formula: string;
  engineFields: string[];
  sources: SourceRef[];
  codeRef: string;
  section: "filer" | "income" | "tax" | "payments" | "result";
}

interface TraceEvent {
  rule: string;
  inputs: Record<string, unknown>;
  output: number | string | boolean;
  citation?: string;
}

interface VizData {
  filer: { name: string; citizenship: string; visa: string; taxYear: number; caption: string };
  lines: Record<string, string>;
  income: Record<string, unknown>;
  provenance: Record<string, LineProvenance>;
  trace: TraceEvent[];
  findings: { id: string; kind: string; headline: string; detail: string; amountUsd?: number }[];
}

// The three ways to feed the engine (see /api/dev/logic-viz).
type Source = "sample" | "mine" | "upload";

// Income document kinds the "Upload" source accepts. `route` is the existing
// per-type extract endpoint under /api/documents/extract; `formField` is the
// multipart field that route reads; `key` is where the extracted record lands
// in the POST body the engine consumes.
const UPLOAD_DOCS = [
  { key: "w2s", route: "w2", formField: "w2", label: "W-2", hint: "Wages" },
  { key: "f1042s", route: "f1042s", formField: "f1042s", label: "1042-S", hint: "Scholarship / treaty-exempt" },
  { key: "f1099ints", route: "f1099int", formField: "f1099int", label: "1099-INT", hint: "Interest" },
  { key: "f1099divs", route: "f1099div", formField: "f1099div", label: "1099-DIV", hint: "Dividends" },
  { key: "f1099bs", route: "f1099b", formField: "f1099b", label: "1099-B", hint: "Securities sales" },
  { key: "f1099das", route: "f1099da", formField: "f1099da", label: "1099-DA", hint: "Digital assets" },
] as const;

type UploadKey = (typeof UPLOAD_DOCS)[number]["key"];
type ExtractedDoc = { fileName: string; record: unknown };
type UploadState = Partial<Record<UploadKey, ExtractedDoc[]>>;

const SECTIONS: { key: LineProvenance["section"]; title: string; blurb: string }[] = [
  { key: "filer", title: "Filer & filing status", blurb: "Identity block (page 1 header) and the Sign Here occupation." },
  { key: "income", title: "Income effectively connected with a U.S. trade or business", blurb: "Page 1 — wages, treaty exemption, scholarship, AGI." },
  { key: "tax", title: "Tax and credits", blurb: "Page 2 — deduction, taxable income, graduated tax, Schedule NEC flat-rate tax." },
  { key: "payments", title: "Payments", blurb: "Page 2 — federal tax already withheld against this income." },
  { key: "result", title: "Refund or amount you owe", blurb: "Total payments minus total tax." },
];

function formatEngineValue(v: unknown): string {
  if (typeof v === "number") return v.toLocaleString("en-US", { maximumFractionDigits: 2 });
  if (typeof v === "boolean") return v ? "true" : "false";
  if (v === null || v === undefined) return "—";
  return String(v);
}

const SOURCE_BADGE: Record<SourceRef["kind"], { label: string; variant: "default" | "secondary" | "outline" | "ghost" }> = {
  document: { label: "Document", variant: "secondary" },
  interview: { label: "Interview", variant: "outline" },
  treaty: { label: "Treaty", variant: "default" },
  config: { label: "Statutory", variant: "ghost" },
  line: { label: "Line", variant: "outline" },
};

export default function LogicVizPage() {
  const [data, setData] = useState<VizData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);
  const [showTrace, setShowTrace] = useState(false);
  const [source, setSource] = useState<Source>("sample");
  const [uploaded, setUploaded] = useState<UploadState>({});

  // Show a VizData response: store it and preselect the headline result line
  // (refund or owe) so the source panel is never empty.
  const applyData = useCallback((body: VizData) => {
    setData(body);
    setSelected(["1040nr.35a", "1040nr.37"].find((k) => k in body.lines) ?? "1040nr.24");
  }, []);

  // GET the sample or the caller's own case file.
  const load = useCallback(
    (which: "sample" | "mine") => {
      setLoading(true);
      setError(null);
      fetch(`/api/dev/logic-viz?source=${which}`)
        .then(async (res) => {
          const body = await res.json();
          if (!res.ok) throw new Error(body?.error ?? "Failed to load.");
          return body as VizData;
        })
        .then(applyData)
        .catch((err) => {
          setData(null);
          setError(err instanceof Error ? err.message : "Something went wrong.");
        })
        .finally(() => setLoading(false));
    },
    [applyData]
  );

  useEffect(() => {
    load("sample");
  }, [load]);

  // Switch source. sample/mine fetch immediately; upload waits for files.
  const selectSource = useCallback(
    (next: Source) => {
      setSource(next);
      setError(null);
      if (next === "upload") {
        setData(null);
        setLoading(false);
        return;
      }
      load(next);
    },
    [load]
  );

  // Run the engine on the documents extracted in the Upload panel.
  const runUploaded = useCallback(() => {
    const income = Object.fromEntries(
      UPLOAD_DOCS.map((d) => [d.key, (uploaded[d.key] ?? []).map((e) => e.record)]).filter(
        ([, records]) => (records as unknown[]).length > 0
      )
    );
    setLoading(true);
    setError(null);
    fetch("/api/dev/logic-viz", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ income }),
    })
      .then(async (res) => {
        const body = await res.json();
        if (!res.ok) throw new Error(body?.error ?? "Failed to run the engine.");
        return body as VizData;
      })
      .then(applyData)
      .catch((err) => {
        setData(null);
        setError(err instanceof Error ? err.message : "Something went wrong.");
      })
      .finally(() => setLoading(false));
  }, [uploaded, applyData]);

  const rowsBySection = useMemo(() => {
    if (!data) return {} as Record<string, [string, LineProvenance][]>;
    const grouped: Record<string, [string, LineProvenance][]> = {};
    for (const [key, prov] of Object.entries(data.provenance)) {
      if (!(key in data.lines)) continue; // only show lines the engine actually filled
      (grouped[prov.section] ??= []).push([key, prov]);
    }
    return grouped;
  }, [data]);

  // When a line is selected, softly highlight the upstream lines it derives from.
  const upstreamKeys = useMemo(() => {
    if (!data || !selected) return new Set<string>();
    const prov = data.provenance[selected];
    if (!prov) return new Set<string>();
    return new Set(prov.sources.filter((s): s is Extract<SourceRef, { kind: "line" }> => s.kind === "line").map((s) => s.line));
  }, [data, selected]);

  const selectedProv = selected && data ? data.provenance[selected] : null;

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6 md:p-8">
      {/* Header */}
      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="font-heading text-xl font-semibold text-foreground">Form 1040-NR · logic audit</h1>
          <Badge variant="outline">Internal</Badge>
          {data && <Badge variant="secondary">Tax year {data.filer.taxYear}</Badge>}
        </div>
        <p className="text-sm text-muted-foreground">
          {data ? `${data.filer.caption}.` : "Pick a filer below."} Every filled field is live from the real engine — hover to highlight,
          click to see exactly where the value comes from. This can&apos;t drift from the code: the numbers are recomputed
          on each load and the source map is guarded by a test.
        </p>
      </header>

      {/* ---------------- Source selector ---------------- */}
      <SourcePicker source={source} onSelect={selectSource} />

      {source === "upload" && (
        <UploadPanel
          uploaded={uploaded}
          setUploaded={setUploaded}
          onRun={runUploaded}
          running={loading}
          setError={setError}
        />
      )}

      {error && (
        <p className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </p>
      )}
      {loading && <p className="text-sm text-muted-foreground">Running the engine…</p>}

      {data && (
      <>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        {/* ---------------- The form ---------------- */}
        <div className="space-y-5">
          {SECTIONS.map((section) => {
            const rows = rowsBySection[section.key] ?? [];
            if (rows.length === 0) return null;
            return (
              <section key={section.key} className="overflow-hidden rounded-2xl bg-card ring-1 ring-foreground/10">
                <div className="border-b border-border bg-muted/40 px-4 py-2.5">
                  <h2 className="text-sm font-semibold text-foreground">{section.title}</h2>
                  <p className="text-xs text-muted-foreground">{section.blurb}</p>
                </div>
                <div className="divide-y divide-border">
                  {rows.map(([key, prov]) => {
                    const isSelected = key === selected;
                    const isUpstream = upstreamKeys.has(key);
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setSelected(key)}
                        className={cn(
                          "flex w-full items-center gap-3 px-4 py-2 text-left transition-colors",
                          "hover:bg-accent/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                          isSelected && "bg-accent",
                          !isSelected && isUpstream && "bg-accent/40"
                        )}
                      >
                        <span
                          className={cn(
                            "w-10 shrink-0 text-right font-mono text-xs",
                            isSelected ? "font-semibold text-accent-foreground" : "text-muted-foreground"
                          )}
                        >
                          {prov.line}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-sm text-foreground">{prov.label}</span>
                        <span className="shrink-0 font-mono text-sm tabular-nums text-foreground">
                          {data.lines[key]}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </section>
            );
          })}

          {/* Exempt-interest gotcha: money the engine sees but that lands on NO line. */}
          {typeof data.income.interestExempt === "number" && data.income.interestExempt > 0 && (
            <div className="rounded-2xl border border-dashed border-border bg-muted/30 px-4 py-3">
              <p className="text-xs font-medium text-foreground">
                Not on any line: ${formatEngineValue(data.income.interestExempt)} bank interest
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                A nonresident&apos;s U.S. bank/portfolio interest is exempt under §871(i) and, per the 1040-NR instructions,
                is excluded from line 2a entirely — so it correctly appears on no line of the return. A classic audit
                gotcha worth showing precisely because it&apos;s absent.
              </p>
            </div>
          )}
        </div>

        {/* ---------------- Source panel ---------------- */}
        <div className="lg:sticky lg:top-6 lg:self-start">
          {selectedProv ? (
            <div className="space-y-4 rounded-2xl bg-card p-4 ring-1 ring-foreground/10">
              <div>
                <div className="flex items-baseline gap-2">
                  {selectedProv.line !== "—" && (
                    <span className="font-mono text-sm text-muted-foreground">Line {selectedProv.line}</span>
                  )}
                  <span className="font-mono text-lg font-semibold tabular-nums text-foreground">{data.lines[selected!]}</span>
                </div>
                <h3 className="mt-0.5 text-sm font-medium text-foreground">{selectedProv.label}</h3>
              </div>

              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Formula</p>
                <FormulaBlock formula={selectedProv.formula} />
              </div>

              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Where it comes from</p>
                {selectedProv.sources.map((src, i) => (
                  <SourceRow key={i} src={src} data={data} onSelectLine={setSelected} />
                ))}
              </div>

              {selectedProv.engineFields.length > 0 && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Engine values (live)</p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {selectedProv.engineFields.map((f) => (
                      <span key={f} className="rounded-md bg-muted px-2 py-0.5 font-mono text-xs text-foreground">
                        {f} = {formatEngineValue(data.income[f])}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Code</p>
                <p className="mt-1 font-mono text-xs text-primary">{selectedProv.codeRef}</p>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              Select any line to see where its value comes from.
            </div>
          )}

          {/* Legend */}
          <div className="mt-3 flex flex-wrap gap-1.5 px-1">
            {(Object.keys(SOURCE_BADGE) as SourceRef["kind"][]).map((k) => (
              <Badge key={k} variant={SOURCE_BADGE[k].variant}>
                {SOURCE_BADGE[k].label}
              </Badge>
            ))}
          </div>
        </div>
      </div>

      {/* ---------------- Raw engine trace ---------------- */}
      <div className="rounded-2xl bg-card ring-1 ring-foreground/10">
        <div className="flex items-center justify-between px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Engine trace</h2>
            <p className="text-xs text-muted-foreground">
              The engine&apos;s own step-by-step audit trail (rule · inputs · output · citation).
            </p>
          </div>
          <Button size="sm" variant="outline" onClick={() => setShowTrace((s) => !s)}>
            {showTrace ? "Hide" : "Show"} ({data.trace.length})
          </Button>
        </div>
        {showTrace && (
          <div className="max-h-96 overflow-auto border-t border-border">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-muted">
                <tr className="text-left text-muted-foreground">
                  <th className="p-2 font-medium">Rule</th>
                  <th className="p-2 font-medium">Inputs</th>
                  <th className="p-2 font-medium">Output</th>
                  <th className="p-2 font-medium">Citation</th>
                </tr>
              </thead>
              <tbody>
                {data.trace.map((t, i) => (
                  <tr key={i} className="border-t border-border align-top">
                    <td className="whitespace-nowrap p-2 font-mono text-foreground">{t.rule}</td>
                    <td className="p-2 font-mono text-muted-foreground">{JSON.stringify(t.inputs)}</td>
                    <td className="whitespace-nowrap p-2 font-mono tabular-nums text-foreground">{String(t.output)}</td>
                    <td className="p-2 text-muted-foreground">{t.citation ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      </>
      )}
    </div>
  );
}

// Segmented control for the three engine inputs (see /api/dev/logic-viz).
function SourcePicker({ source, onSelect }: { source: Source; onSelect: (s: Source) => void }) {
  const opts: { key: Source; label: string; hint: string }[] = [
    { key: "sample", label: "Sample filer", hint: "Budi Santoso — synthetic" },
    { key: "mine", label: "My documents", hint: "Your case file" },
    { key: "upload", label: "Upload files", hint: "Trace ad-hoc docs" },
  ];
  return (
    <div className="inline-flex flex-wrap gap-1 rounded-xl bg-muted p-1">
      {opts.map((o) => {
        const active = source === o.key;
        return (
          <button
            key={o.key}
            type="button"
            onClick={() => onSelect(o.key)}
            className={cn(
              "rounded-lg px-3 py-1.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              active ? "bg-card shadow-sm ring-1 ring-foreground/10" : "hover:bg-card/50"
            )}
          >
            <span className={cn("block text-sm font-medium", active ? "text-foreground" : "text-muted-foreground")}>
              {o.label}
            </span>
            <span className="block text-xs text-muted-foreground">{o.hint}</span>
          </button>
        );
      })}
    </div>
  );
}

// Upload source: one file picker per income document kind. Each file is sent to
// its existing /api/documents/extract/* route (the real LlamaParse + GPT
// pipeline); the extracted records are collected here and, on Run, POSTed to
// /api/dev/logic-viz to run the engine. Nothing is persisted.
function UploadPanel({
  uploaded,
  setUploaded,
  onRun,
  running,
  setError,
}: {
  uploaded: UploadState;
  setUploaded: Dispatch<SetStateAction<UploadState>>;
  onRun: () => void;
  running: boolean;
  setError: (e: string | null) => void;
}) {
  const [busy, setBusy] = useState<UploadKey | null>(null);

  const handleFiles = async (doc: (typeof UPLOAD_DOCS)[number], files: FileList | null) => {
    if (!files || files.length === 0) return;
    setBusy(doc.key);
    setError(null);
    try {
      for (const file of Array.from(files)) {
        const form = new FormData();
        form.append(doc.formField, file);
        const res = await fetch(`/api/documents/extract/${doc.route}`, { method: "POST", body: form });
        const body = await res.json();
        if (!res.ok) throw new Error(body?.error ?? `Couldn't read ${file.name}.`);
        setUploaded((prev) => ({
          ...prev,
          [doc.key]: [...(prev[doc.key] ?? []), { fileName: file.name, record: body }],
        }));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Extraction failed.");
    } finally {
      setBusy(null);
    }
  };

  const removeDoc = (key: UploadKey, idx: number) =>
    setUploaded((prev) => ({ ...prev, [key]: (prev[key] ?? []).filter((_, i) => i !== idx) }));

  const total = UPLOAD_DOCS.reduce((n, d) => n + (uploaded[d.key]?.length ?? 0), 0);

  return (
    <div className="space-y-4 rounded-2xl bg-card p-4 ring-1 ring-foreground/10">
      <div>
        <h2 className="text-sm font-semibold text-foreground">Upload income documents</h2>
        <p className="text-xs text-muted-foreground">
          Add a W-2, 1099, or 1042-S just like the normal flow — each is extracted by the real pipeline, then run through
          the engine so you can inspect every line. Traced through your own residency/treaty context when your case file
          has one, otherwise the sample filer&apos;s. Nothing is saved.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {UPLOAD_DOCS.map((doc) => {
          const docs = uploaded[doc.key] ?? [];
          return (
            <div key={doc.key} className="rounded-xl border border-border p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">{doc.label}</p>
                  <p className="text-xs text-muted-foreground">{doc.hint}</p>
                </div>
                <label
                  className={cn(
                    "shrink-0 cursor-pointer rounded-md border border-border px-2.5 py-1 text-xs font-medium text-foreground transition-colors hover:bg-accent",
                    busy === doc.key && "pointer-events-none opacity-60"
                  )}
                >
                  {busy === doc.key ? "Reading…" : "Add file"}
                  <input
                    type="file"
                    className="hidden"
                    multiple
                    accept="application/pdf,image/*"
                    disabled={busy !== null}
                    onChange={(e) => {
                      void handleFiles(doc, e.target.files);
                      e.target.value = ""; // let the same file be re-picked
                    }}
                  />
                </label>
              </div>
              {docs.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {docs.map((d, i) => (
                    <li key={i} className="flex items-center justify-between gap-2 text-xs">
                      <span className="min-w-0 truncate text-muted-foreground">{d.fileName}</span>
                      <button
                        type="button"
                        onClick={() => removeDoc(doc.key, i)}
                        className="shrink-0 text-muted-foreground hover:text-destructive"
                        aria-label={`Remove ${d.fileName}`}
                      >
                        ✕
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex items-center gap-3">
        <Button size="sm" onClick={onRun} disabled={total === 0 || running || busy !== null}>
          {running ? "Running…" : `Run engine (${total} doc${total === 1 ? "" : "s"})`}
        </Button>
        {total > 0 && (
          <button
            type="button"
            onClick={() => setUploaded({})}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            Clear all
          </button>
        )}
      </div>
    </div>
  );
}

// The formula is the heart of each line. Provenance formulas are shaped
// "<line> = <expression>", so we split on the first "=" and let the expression
// (the actual computation) the readable focal point instead of one flat wall of
// bold mono. Provenance formulas are shaped "<line> = <expr>. <caveat>", where
// <expr> is often a sum/difference (a + b − c) or an "either/or" (x / y). We
// parse those apart so the expression can lay out one term per line with an
// operator gutter, and the trailing caveat drops to a de-emphasized note.
function parseFormula(formula: string): {
  lhs: string | null;
  terms: { op: string | null; text: string }[];
  note: string | null;
} {
  const trimmed = formula.trim();

  // Peel off a trailing prose caveat: the equation ends at the first ". " and
  // everything after it is commentary, not part of the computation.
  let equation = trimmed;
  let note: string | null = null;
  const dot = trimmed.search(/\.\s/);
  if (dot !== -1) {
    equation = trimmed.slice(0, dot).trim();
    note = trimmed.slice(dot + 1).trim().replace(/\.\s*$/, "");
  }
  equation = equation.replace(/\.\s*$/, "");

  const eq = equation.indexOf("=");
  const lhs = eq === -1 ? null : equation.slice(0, eq).trim();
  const rhs = eq === -1 ? equation : equation.slice(eq + 1).trim();

  // Break the RHS on top-level + − / operators (those outside parentheses, so
  // subtraction inside max(0, a − b) stays on one line). Each resulting term
  // carries the operator that precedes it.
  const terms: { op: string | null; text: string }[] = [];
  let depth = 0;
  let start = 0;
  let op: string | null = null;
  for (let i = 0; i < rhs.length; i++) {
    const c = rhs[i];
    if (c === "(") depth++;
    else if (c === ")") depth--;
    else if (depth === 0 && (c === "+" || c === "−" || c === "/") && rhs[i - 1] === " " && rhs[i + 1] === " ") {
      terms.push({ op, text: rhs.slice(start, i).trim() });
      op = c;
      start = i + 1;
    }
  }
  terms.push({ op, text: rhs.slice(start).trim() });

  return { lhs, terms, note };
}

function FormulaBlock({ formula }: { formula: string }) {
  const { lhs, terms, note } = parseFormula(formula);
  const multi = terms.length > 1;
  return (
    <div className="mt-1.5 rounded-lg border border-border bg-muted/50 px-3.5 py-3 leading-relaxed">
      {lhs && <p className="font-mono text-xs text-muted-foreground">{lhs} =</p>}
      <div className={cn("space-y-1", lhs && "mt-1")}>
        {terms.map((t, i) => (
          <div key={i} className="flex items-baseline gap-2 font-mono text-sm text-foreground">
            {multi && <span className="w-2 shrink-0 select-none text-muted-foreground">{t.op ?? ""}</span>}
            <span className="font-medium">{t.text}</span>
          </div>
        ))}
      </div>
      {note && (
        <p className="mt-2.5 border-t border-border/60 pt-2 text-xs text-muted-foreground">{note}</p>
      )}
    </div>
  );
}

function SourceRow({
  src,
  data,
  onSelectLine,
}: {
  src: SourceRef;
  data: VizData;
  onSelectLine: (key: string) => void;
}) {
  const badge = SOURCE_BADGE[src.kind];

  if (src.kind === "line") {
    const target = data.provenance[src.line];
    return (
      <div className="flex items-start gap-2">
        <Badge variant={badge.variant} className="mt-0.5">
          {badge.label}
        </Badge>
        <div className="min-w-0 text-xs">
          <button
            type="button"
            onClick={() => onSelectLine(src.line)}
            className="font-medium text-primary underline-offset-2 hover:underline"
          >
            → Line {target?.line ?? src.line} {target?.label ? `· ${target.label}` : ""}
          </button>
          {src.note && <p className="text-muted-foreground">{src.note}</p>}
        </div>
      </div>
    );
  }

  let title = "";
  let note: string | undefined;
  if (src.kind === "document") {
    title = src.box ? `${src.doc} · ${src.box}` : src.doc;
    note = src.note;
  } else if (src.kind === "interview") {
    title = src.question;
    note = `field: ${src.field}`;
  } else if (src.kind === "treaty") {
    title = src.article;
    note = [src.note, src.citation].filter(Boolean).join(" — ");
  } else {
    title = src.note;
  }

  return (
    <div className="flex items-start gap-2">
      <Badge variant={badge.variant} className="mt-0.5">
        {badge.label}
      </Badge>
      <div className="min-w-0 text-xs">
        <p className="font-medium text-foreground">{title}</p>
        {note && <p className="text-muted-foreground">{note}</p>}
      </div>
    </div>
  );
}
