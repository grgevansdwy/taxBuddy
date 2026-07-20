"use client";

import { useEffect, useState } from "react";
import { Spinner } from "@/components/ui/spinner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface DocPreview {
  docType: string;
  label: string;
  fileName: string;
  uploadedAt: string;
  url: string | null;
}

interface ParsedData {
  taxYear: number;
  stage: string;
  documentsNeeded: string[];
  residency: {
    isNonresident?: boolean;
    firstEntryDate?: string;
    exemptYearsUsed?: number;
    reasoning?: string;
  } | null;
  w2s: Record<string, unknown>[];
  f1042s: Record<string, unknown>[];
  f1099ints: Record<string, unknown>[];
  f1099divs: Record<string, unknown>[];
  f1099bs: Record<string, unknown>[];
  f1099das: Record<string, unknown>[];
}

interface DetailResponse {
  account: { id: string; email: string; name: string; createdAt: string | null };
  documents: DocPreview[];
  parsed: ParsedData | null;
}

function cell(value: unknown): string {
  if (value == null) return "—";
  if (Array.isArray(value)) return `${value.length} item${value.length === 1 ? "" : "s"}`;
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

// Generic table for any array of flat-ish records — columns are the union of the
// first row's keys. Keeps the popup robust across every income-doc shape.
function RecordsTable({ title, rows }: { title: string; rows: Record<string, unknown>[] }) {
  if (!rows || rows.length === 0) return null;
  const keys = Array.from(new Set(rows.flatMap((r) => Object.keys(r))));
  return (
    <div className="space-y-1.5">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title} <span className="text-muted-foreground/60">({rows.length})</span>
      </p>
      <div className="overflow-x-auto rounded-md border border-border">
        <table className="w-full text-left text-xs">
          <thead className="bg-muted/50">
            <tr>
              {keys.map((k) => (
                <th key={k} className="whitespace-nowrap px-2 py-1.5 font-medium text-muted-foreground">
                  {k}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="border-t border-border">
                {keys.map((k) => (
                  <td key={k} className="whitespace-nowrap px-2 py-1.5 tabular-nums text-foreground">
                    {cell(r[k])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function AccountDetailDialog({
  accountId,
  onClose,
  onMutated,
}: {
  accountId: string;
  onClose: () => void;
  onMutated?: () => void;
}) {
  const [data, setData] = useState<DetailResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function deleteDocument(docType: string, label: string) {
    if (!confirm(`Delete the "${label}" document for this account? This can't be undone.`)) return;
    setBusy(true);
    try {
      const res = await fetch(
        `/api/admin/accounts/${accountId}?docType=${encodeURIComponent(docType)}`,
        { method: "DELETE" }
      );
      if (!res.ok) throw new Error(`Delete failed (${res.status})`);
      setData((prev) =>
        prev ? { ...prev, documents: prev.documents.filter((d) => d.docType !== docType) } : prev
      );
      onMutated?.();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function resetFiling() {
    if (
      !confirm(
        "Reset this account? This permanently deletes ALL uploaded documents and filing data so they can re-test onboarding from scratch. The login is kept. Continue?"
      )
    )
      return;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/accounts/${accountId}`, { method: "DELETE" });
      if (!res.ok) throw new Error(`Reset failed (${res.status})`);
      onMutated?.();
      onClose();
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  useEffect(() => {
    let active = true;
    fetch(`/api/admin/accounts/${accountId}`)
      .then(async (res) => {
        if (!res.ok) throw new Error(`Request failed (${res.status})`);
        return res.json();
      })
      .then((json: DetailResponse) => active && setData(json))
      .catch((e: Error) => active && setError(e.message));
    return () => {
      active = false;
    };
  }, [accountId]);

  const parsed = data?.parsed ?? null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-lg border border-border bg-background shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between border-b border-border px-6 py-4">
          <div>
            <p className="text-lg font-semibold text-foreground">
              {data?.account.name ?? "Loading…"}
            </p>
            <p className="text-sm text-muted-foreground">{data?.account.email}</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-md px-2 py-1 text-sm text-muted-foreground hover:bg-muted"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 space-y-6 overflow-y-auto px-6 py-5">
          {!data && !error && (
            <div className="flex h-40 items-center justify-center">
              <Spinner />
            </div>
          )}
          {error && <p className="text-sm text-destructive">Failed to load: {error}</p>}

          {data && (
            <>
              {parsed && (
                <div className="flex flex-wrap gap-2 text-xs">
                  <Badge variant="outline">Tax year {parsed.taxYear}</Badge>
                  <Badge variant="outline">Stage: {parsed.stage}</Badge>
                  {parsed.residency && (
                    <Badge variant="outline">
                      {parsed.residency.isNonresident ? "Nonresident" : "Resident"}
                    </Badge>
                  )}
                </div>
              )}

              {/* Uploaded documents */}
              <div className="space-y-3">
                <p className="text-sm font-semibold text-foreground">Uploaded documents</p>
                {data.documents.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No documents uploaded.</p>
                ) : (
                  data.documents.map((doc) => (
                    <div key={doc.docType} className="rounded-md border border-border">
                      <div className="flex items-center justify-between border-b border-border px-3 py-2">
                        <div className="text-sm">
                          <span className="font-medium text-foreground">{doc.label}</span>
                          <span className="ml-2 text-muted-foreground">{doc.fileName}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          {doc.url && (
                            <a
                              href={doc.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs font-medium text-primary hover:underline"
                            >
                              Open ↗
                            </a>
                          )}
                          <button
                            onClick={() => deleteDocument(doc.docType, doc.label)}
                            disabled={busy}
                            className="text-xs font-medium text-destructive hover:underline disabled:opacity-50"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                      {doc.url ? (
                        <iframe
                          src={doc.url}
                          title={doc.label}
                          className="h-72 w-full bg-muted"
                        />
                      ) : (
                        <p className="px-3 py-2 text-xs text-muted-foreground">
                          Preview unavailable.
                        </p>
                      )}
                    </div>
                  ))
                )}
              </div>

              {/* Parsed output */}
              <div className="space-y-4">
                <p className="text-sm font-semibold text-foreground">Parsed output</p>
                {!parsed ? (
                  <p className="text-sm text-muted-foreground">
                    No filing started for this account yet.
                  </p>
                ) : (
                  <>
                    {parsed.residency && (
                      <div className="space-y-1.5">
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          Residency
                        </p>
                        <div className="rounded-md border border-border px-3 py-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">First entry</span>
                            <span className="tabular-nums">
                              {parsed.residency.firstEntryDate ?? "—"}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Exempt years used</span>
                            <span className="tabular-nums">
                              {parsed.residency.exemptYearsUsed ?? "—"}
                            </span>
                          </div>
                          {parsed.residency.reasoning && (
                            <p className="mt-1.5 text-xs text-muted-foreground">
                              {parsed.residency.reasoning}
                            </p>
                          )}
                        </div>
                      </div>
                    )}
                    <RecordsTable title="W-2" rows={parsed.w2s} />
                    <RecordsTable title="1042-S" rows={parsed.f1042s} />
                    <RecordsTable title="1099-INT" rows={parsed.f1099ints} />
                    <RecordsTable title="1099-DIV" rows={parsed.f1099divs} />
                    <RecordsTable title="1099-B" rows={parsed.f1099bs} />
                    <RecordsTable title="1099-DA" rows={parsed.f1099das} />
                    {[parsed.w2s, parsed.f1042s, parsed.f1099ints, parsed.f1099divs, parsed.f1099bs, parsed.f1099das].every(
                      (a) => !a || a.length === 0
                    ) && (
                      <p className="text-sm text-muted-foreground">
                        No income documents extracted yet.
                      </p>
                    )}
                  </>
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer — destructive reset so admins can re-test onboarding */}
        {data && (
          <div className="flex items-center justify-between gap-3 border-t border-border px-6 py-3">
            <p className="text-xs text-muted-foreground">
              Deletes all uploaded files and filing data. Login is kept.
            </p>
            <Button
              variant="destructive"
              size="sm"
              onClick={resetFiling}
              disabled={busy}
            >
              {busy ? "Working…" : "Reset filing"}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
