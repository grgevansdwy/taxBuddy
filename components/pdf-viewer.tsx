"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/TextLayer.css";
import "react-pdf/dist/Page/AnnotationLayer.css";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

// The pdf.js worker is copied into /public at its exact pdfjs-dist version (see
// public/pdf.worker.min.mjs) so the version can never drift from the library.
pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

const MAX_PAGE_WIDTH = 760;

// Themed, scrollable viewer for the combined return. Renders every page inline
// so the filer can read the whole packet without downloading, with a Download
// button for the real file. Colors/spacing come from the app's design tokens
// so it reads as one system with the rest of the dashboard.
export function PdfViewer({ url, downloadUrl }: { url: string; downloadUrl: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(MAX_PAGE_WIDTH);
  const [numPages, setNumPages] = useState<number | null>(null);
  const [error, setError] = useState(false);

  // Fit pages to the container (minus padding), capped so they don't get huge
  // on wide screens.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const measure = () => setWidth(Math.min(el.clientWidth - 24, MAX_PAGE_WIDTH));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const onLoad = useCallback(({ numPages }: { numPages: number }) => setNumPages(numPages), []);

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="text-sm">
          <p className="font-medium text-foreground">Your tax return</p>
          <p className="text-xs text-muted-foreground">
            {numPages ? `${numPages} page${numPages === 1 ? "" : "s"} — ready to mail` : "Preview below"}
          </p>
        </div>
        <a href={downloadUrl} download>
          <Button size="sm" className="gap-2">
            Download PDF
            <span aria-hidden>↓</span>
          </Button>
        </a>
      </div>

      <div ref={containerRef} className="max-h-[75vh] overflow-y-auto bg-muted/40 px-3 py-4">
        {error ? (
          <div className="flex flex-col items-center gap-2 py-16 text-center">
            <p className="text-sm text-foreground">We couldn&apos;t load the preview.</p>
            <a href={downloadUrl} download className="text-sm font-medium text-primary hover:underline">
              Download the PDF instead
            </a>
          </div>
        ) : (
          <Document
            file={url}
            options={{ withCredentials: true }}
            onLoadSuccess={onLoad}
            onLoadError={() => setError(true)}
            loading={
              <div className="flex flex-col items-center gap-3 py-16">
                <Spinner className="size-6 text-primary" />
                <p className="text-sm text-muted-foreground">Preparing your return…</p>
              </div>
            }
            className="flex flex-col items-center gap-4"
          >
            {Array.from({ length: numPages ?? 0 }, (_, i) => (
              <Page
                key={i}
                pageNumber={i + 1}
                width={width}
                className="overflow-hidden rounded-lg border border-border shadow-sm"
                renderAnnotationLayer={false}
                renderTextLayer={false}
              />
            ))}
          </Document>
        )}
      </div>
    </div>
  );
}
