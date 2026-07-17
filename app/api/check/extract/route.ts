import { NextResponse } from "next/server";
import { parsePdfToMarkdownPages } from "@/lib/parsing/llamaParse";
import { extractFromMarkdown } from "@/lib/ai/extractFromMarkdown";
import type { ExtractionKindResult } from "@/lib/ai/extractionSpecs";

// Public, NO-AUTH sibling to the /api/documents/extract/* routes that power
// the real onboarding flow. The pre-signup "Refund Check" funnel (public/
// check.html, served at /check) has no Supabase session, so it can't call
// those routes — but the extraction pipeline underneath them (LlamaParse →
// gpt-4o-mini structured output) needs no user context, only the two API
// keys already on the server. This route reuses that exact pipeline so the
// funnel's numbers come from the same reader the app itself uses.
//
// The difference from the app: the funnel has a single unlabeled dropzone
// (no per-type slots), so this route AUTO-CLASSIFIES each file from its
// parsed text before extracting, instead of trusting a slot label. It also
// parses the PDF exactly ONCE and drives every section extractor off the same
// markdown, rather than re-uploading the file to LlamaParse per section the
// way the per-route + consolidated-slot combination does.
//
// NOTE (abuse surface): this invokes paid LlamaParse + OpenAI calls with no
// auth. Fine for the funnel MVP, but it should get rate-limiting / a size or
// call budget before it's heavily promoted.

export const runtime = "nodejs";
export const maxDuration = 120;

const MAX_FILE_BYTES = 15 * 1024 * 1024; // 15MB — matches the app's "Max 10MB" copy with headroom

// Which form is this? Auto-detected from the parsed markdown. A W-2 never
// mentions "1042-S" or "1099"; a 1042-S never mentions "1099" or "W-2"; a
// consolidated 1099 mentions none of the others — so the order here only has
// to break ties on the rare document that name-drops a sibling form, and
// "most specific first" (1042-S → 1099 → W-2) is the safe order.
type DetectedType = "w2" | "f1042s" | "f1099" | "unknown";

function classify(markdown: string): DetectedType {
  const text = markdown.toLowerCase();
  if (/1042-?s|foreign person'?s u\.?s\.? source income/.test(text)) return "f1042s";
  if (/1099-?(int|div|b|da|oid|misc|nec)|consolidated 1099|composite 1099/.test(text)) return "f1099";
  if (/\bw-?2\b|wage and tax statement/.test(text)) return "w2";
  return "unknown";
}

type BTx = ExtractionKindResult["f1099b"]["transactions"];

// Merge per-page 1099-B / 1099-DA results into one section, same shape and
// same merge rule as lib/ai/extractTransactionsPerPage.ts — reproduced here
// because we already hold the parsed pages and don't want to re-parse.
function mergeTransactions(
  perPage: { sectionPresent: boolean; payerName: string; transactions: BTx }[]
): { payerName: string; transactions: BTx } | null {
  const present = perPage.filter((page) => page.sectionPresent);
  if (present.length === 0) return null;
  return {
    payerName: present[0].payerName,
    transactions: present.flatMap((page) => page.transactions),
  };
}

export async function POST(request: Request) {
  let file: FormDataEntryValue | null;
  try {
    file = (await request.formData()).get("file");
  } catch {
    return NextResponse.json({ error: "Send the file as multipart/form-data." }, { status: 400 });
  }

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "A file is required." }, { status: 400 });
  }
  if (file.size > MAX_FILE_BYTES) {
    return NextResponse.json({ error: "That file is too large (15MB max)." }, { status: 413 });
  }

  try {
    const pages = await parsePdfToMarkdownPages({
      buffer: Buffer.from(await file.arrayBuffer()),
      fileName: file.name,
    });
    const fullMarkdown = pages.join("\n\n---\n\n");

    // NOTE: abuse dedup (one free check per SSN) is implemented but currently
    // disconnected while the funnel is in testing — see CLAUDE.md's upcoming
    // tasks and lib/check/fingerprint.ts. Re-wire it here (before the GPT
    // calls below) when re-enabling.
    const docType = classify(fullMarkdown);

    if (docType === "w2") {
      const data = await extractFromMarkdown("w2", [{ title: "W-2", markdown: fullMarkdown }]);
      return NextResponse.json({ docType, data });
    }

    if (docType === "f1042s") {
      const data = await extractFromMarkdown("f1042s", [{ title: "1042-S", markdown: fullMarkdown }]);
      return NextResponse.json({ docType, data });
    }

    if (docType === "f1099") {
      // Run all four consolidated-1099 sections off the already-parsed pages:
      // INT/DIV read the whole document (single record each), B/DA read
      // per-page and merge (a consolidated statement's sales tables span many
      // pages — see extractTransactionsPerPage's note).
      const [intResult, divResult, bPages, daPages] = await Promise.all([
        extractFromMarkdown("f1099int", [{ title: "1099-INT", markdown: fullMarkdown }]),
        extractFromMarkdown("f1099div", [{ title: "1099-DIV", markdown: fullMarkdown }]),
        Promise.all(pages.map((md) => extractFromMarkdown("f1099b", [{ title: "1099-B", markdown: md }]))),
        Promise.all(pages.map((md) => extractFromMarkdown("f1099da", [{ title: "1099-DA", markdown: md }]))),
      ]);

      const sections = {
        int: intResult.sectionPresent ? intResult : null,
        div: divResult.sectionPresent ? divResult : null,
        b: mergeTransactions(bPages),
        da: mergeTransactions(daPages),
      };

      if (!sections.int && !sections.div && !sections.b && !sections.da) {
        return NextResponse.json({ docType: "unknown" });
      }
      return NextResponse.json({ docType, sections });
    }

    return NextResponse.json({ docType: "unknown" });
  } catch (err) {
    console.error("check/extract failed:", err);
    const detail = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Couldn't read this document: ${detail}` }, { status: 422 });
  }
}
