"use client";

import { useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export function FileDropSlot({
  label,
  description,
  accept = "application/pdf",
  file,
  onChange,
}: {
  label: string;
  description?: string;
  accept?: string;
  file: File | null;
  onChange: (file: File | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => inputRef.current?.click()}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
      }}
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setIsDragging(false);
        const dropped = e.dataTransfer.files?.[0];
        if (dropped) onChange(dropped);
      }}
      className={cn(
        "flex cursor-pointer flex-col items-center gap-1 rounded-2xl border border-dashed px-4 py-6 text-center transition-colors",
        isDragging ? "border-primary bg-primary/5" : "border-input bg-input/10 hover:bg-input/20"
      )}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => onChange(e.target.files?.[0] ?? null)}
      />
      <span className="text-sm font-medium text-foreground">{label}</span>
      {description && <span className="text-xs text-muted-foreground">{description}</span>}
      {file ? (
        <Badge variant="secondary" className="mt-2">
          {file.name}
        </Badge>
      ) : (
        <span className="mt-2 text-xs text-muted-foreground">Click or drag a PDF here</span>
      )}
    </div>
  );
}
