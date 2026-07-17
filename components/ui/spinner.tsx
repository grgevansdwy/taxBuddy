import { cn } from "@/lib/utils";

// Minimal CSS spinner (no icon dependency) — a rotating ring that inherits the
// current text color via border-current, so it works on both muted backgrounds
// and inside a filled button.
export function Spinner({ className }: { className?: string }) {
  return (
    <span
      role="status"
      aria-label="Loading"
      className={cn(
        "inline-block size-4 animate-spin rounded-full border-2 border-current border-t-transparent",
        className
      )}
    />
  );
}
