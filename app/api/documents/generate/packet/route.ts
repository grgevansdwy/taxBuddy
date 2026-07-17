import { NextResponse } from "next/server";
import { CURRENT_SUPPORTED_TAX_YEAR } from "@/lib/config/taxYear";
import { loadEngineContext } from "@/lib/server/engineContext";
import { generateReturnForms, mergeReturnForms } from "@/lib/server/generateReturnForms";

// The whole return as one PDF, assembled in IRS attachment-sequence (mail)
// order — see generateReturnForms for which forms are included and why. This
// is the "download everything" companion to the individual /generate/* routes
// the dashboard links to, so a required attachment (e.g. the Schedule NEC
// line-16 overflow statement) can't be silently left out of the packet.
export async function GET(request: Request) {
  const result = await loadEngineContext();
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  const forms = await generateReturnForms(result.context);
  const merged = await mergeReturnForms(forms);

  // ?inline=1 renders in the browser's/embedded viewer instead of forcing a
  // download — used by the dashboard's in-page PDF viewer.
  const inline = new URL(request.url).searchParams.get("inline") === "1";
  const disposition = inline ? "inline" : "attachment";

  return new NextResponse(Buffer.from(merged), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${disposition}; filename="form-1040nr-return-${CURRENT_SUPPORTED_TAX_YEAR}.pdf"`,
    },
  });
}
