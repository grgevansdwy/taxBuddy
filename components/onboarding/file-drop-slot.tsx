"use client";

import { useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export function FileDropSlot({
  label,
  accept = "application/pdf",
  file,
  fileNames,
  onChange,
}: {
  label: string;
  accept?: string;
  // A single selected file (I-94/I-20/travel history keep the File in state),
  // OR an explicit list of uploaded file names (income slots that hold several).
  file?: File | null;
  fileNames?: string[];
  onChange: (file: File | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const names = fileNames ?? (file ? [file.name] : []);

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
      {names.length > 0 ? (
        <div className="mt-2 flex flex-wrap justify-center gap-1.5">
          {names.map((name, i) => (
            <Badge key={`${name}-${i}`} variant="secondary">
              {name}
            </Badge>
          ))}
        </div>
      ) : (
        <span className="mt-2 text-xs text-muted-foreground">Click or drag a PDF here</span>
      )}
    </div>
  );
}
