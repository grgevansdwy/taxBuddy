import { NextResponse } from "next/server";
import { runFunnelEngine, type FunnelIncomeInput } from "@/lib/check/engine";
import { extractFiled1040NR, scoreFiled1040NR } from "@/lib/check/f1040nrScoring";

// Public, NO-AUTH "score my filed return" for the pre-signup funnel. The
// filer uploads the Form 1040-NR they already filed; we read the numbers THEY
// entered, independently recompute the correct numbers with the real engine
// (over the Step-1 income documents they already uploaded), and diff the two
// line by line — plus the bottom-line refund/owe.
//
// This is also the funnel's abuse-dedup checkpoint: a completed 1040-NR
// carries the filer's SSN/ITIN, the one stable identity across their
// documents. We fingerprint it (keyed HMAC — see lib/check/fingerprint.ts),
// store ONLY the opaque digest, and refuse a second run for the same person in
// a new session. Nothing identifying is persisted.

export const runtime = "nodejs";
export const maxDuration = 120;

const MAX_FILE_BYTES = 15 * 1024 * 1024;

export async function POST(request: Request) {
  let file: FormDataEntryValue | null;
  let payloadRaw: FormDataEntryValue | null;
  try {
    const form = await request.formData();
    file = form.get("file");
    payloadRaw = form.get("payload");
  } catch {
    return NextResponse.json({ error: "Send the return as multipart/form-data." }, { status: 400 });
  }

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Upload your filed Form 1040-NR." }, { status: 400 });
  }
  if (file.size > MAX_FILE_BYTES) {
    return NextResponse.json({ error: "That file is too large (15MB max)." }, { status: 413 });
  }

  let income: FunnelIncomeInput = {};
  if (typeof payloadRaw === "string" && payloadRaw.length > 0) {
    try {
      income = JSON.parse(payloadRaw) as FunnelIncomeInput;
    } catch {
      return NextResponse.json({ error: "Invalid income payload." }, { status: 400 });
    }
  }

  // NOTE: abuse dedup (one free check per SSN, keyed on the filed return's TIN)
  // is implemented but currently disconnected while the funnel is in testing —
  // see CLAUDE.md's upcoming tasks and lib/check/fingerprint.ts.
  try {
    const filed = await extractFiled1040NR({
      buffer: Buffer.from(await file.arrayBuffer()),
      fileName: file.name,
    });

    const engineResult = runFunnelEngine(income);
    const score = scoreFiled1040NR(filed, engineResult);

    return NextResponse.json({ score, confidence: filed.confidence, refundOrDue: engineResult.refundOrDue });
  } catch (err) {
    console.error("check/score failed:", err);
    const detail = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Couldn't read this return: ${detail}` }, { status: 422 });
  }
}
