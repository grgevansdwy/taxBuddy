"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FileDropSlot } from "@/components/onboarding/file-drop-slot";
import type { DocType } from "@/lib/types";

// Wraps FileDropSlot with an upload-on-select call to /api/documents/upload.
// Once a file is on file (either just uploaded, or hydrated from a previous
// visit), shows a persisted "already uploaded" badge instead of the empty
// dropzone — a plain File object can't survive navigation/reload, so this is
// the only way to reflect "this is already uploaded" after coming back.
export function UploadSlot({
  docType,
  label,
  description,
  initialFileName,
}: {
  docType: DocType;
  label: string;
  description?: string;
  initialFileName?: string | null;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [savedFileName, setSavedFileName] = useState<string | null>(initialFileName ?? null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleChange(selected: File | null) {
    setFile(selected);
    setError(null);
    if (!selected) return;

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("docType", docType);
      formData.append("file", selected);
      const res = await fetch("/api/documents/upload", { method: "POST", body: formData });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? "Upload failed.");
      }
      setSavedFileName(selected.name);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setIsUploading(false);
    }
  }

  if (savedFileName && !file) {
    return (
      <div className="space-y-1.5">
        <span className="text-sm font-medium text-foreground">{label}</span>
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-dashed border-input bg-input/10 px-4 py-3">
          <Badge variant="secondary">{savedFileName} — uploaded</Badge>
          <Button type="button" variant="outline" size="sm" onClick={() => setSavedFileName(null)}>
            Replace
          </Button>
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <FileDropSlot label={label} description={description} file={file} onChange={handleChange} />
      {isUploading && <p className="text-xs text-muted-foreground">Uploading...</p>}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
