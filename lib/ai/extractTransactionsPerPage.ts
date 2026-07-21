import { parsePdfToMarkdownPages } from "@/lib/parsing/llamaParse";
import { extractFromMarkdown } from "@/lib/ai/extractFromMarkdown";
import { mapWithConcurrency } from "@/lib/ai/concurrency";
import type { ExtractionKindResult } from "@/lib/ai/extractionSpecs";

// Shared by 1099-B and 1099-DA: both list transactions across many pages of
// a long consolidated broker statement (20+ pages isn't unusual), split into
// several same-shaped tables (e.g. short-term covered, short-term
// noncovered, long-term covered, ...). Asking one gpt-4o-mini call to
// enumerate every row across the whole document risks it losing track
// partway through — a known failure mode for long, repetitive, single-pass
// extraction. Instead, run the same per-kind extraction once per PAGE and
// merge; the model only ever has to fully enumerate one page's rows at a
// time, and most pages come back sectionPresent: false since only a handful
// of a 20+ page statement actually contain this section's table.
export async function extractTransactionsPerPage<K extends "f1099b" | "f1099da">(
  kind: K,
  documentTitle: string,
  file: { buffer: Buffer; fileName: string }
): Promise<ExtractionKindResult[K]> {
  type Result = ExtractionKindResult[K];

  const pages = await parsePdfToMarkdownPages(file);

  // Bounded to 3 concurrent Bedrock calls — an unbounded fan-out over a 20+
  // page statement throttled (HTTP 429) every model in testing. The retry in
  // bedrockClient is the safety net; capping concurrency avoids tripping it.
  const perPage = (await mapWithConcurrency(pages, 3, (markdown) =>
    extractFromMarkdown(kind, [{ title: documentTitle, markdown }])
  )) as Result[];

  const present = perPage.filter((page) => page.sectionPresent);
  if (present.length === 0) {
    return perPage[0]; // sectionPresent: false, empty transactions — same shape on every page
  }

  // The section's printed grand-total row lives on a single page (usually the
  // last), so take the first non-null across the pages that had the section.
  const reportedNetGainLoss =
    present.map((page) => (page as { reportedNetGainLoss?: number | null }).reportedNetGainLoss).find((v) => v != null) ??
    null;

  return {
    sectionPresent: true,
    payerName: present[0].payerName,
    transactions: present.flatMap((page) => page.transactions),
    reportedNetGainLoss,
    confidence: Math.min(...present.map((page) => page.confidence)),
  } as Result;
}
