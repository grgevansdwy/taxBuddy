import { NextResponse } from "next/server";
import { CURRENT_SUPPORTED_TAX_YEAR } from "@/lib/config/taxYear";
import { loadEngineContext } from "@/lib/server/engineContext";
import { generateCapitalGainsAttachment } from "@/lib/pdf/generateCapitalGainsAttachment";
import { formatSsnDigits } from "@/lib/format";

// Schedule NEC's own line 16 table only has room for 5 lots (see
// lib/rules/forms/scheduleNEC.ts) — this generates the overflow statement
// for everything beyond that, which the form's own instructions explicitly
// allow ("if necessary, attach statement of descriptive details not shown
// below"). Only the OVERFLOW lots go here; the first 5 are already printed
// directly on Schedule NEC itself, so they're not repeated.
export async function GET() {
  const result = await loadEngineContext();
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  const { profile, income } = result.context;

  const overflow = income.capitalGainsTransactions.slice(5);
  if (overflow.length === 0) {
    return NextResponse.json(
      { error: "No attachment needed — 5 or fewer capital-gains transactions, all fit directly on Schedule NEC." },
      { status: 400 }
    );
  }

  const bytes = await generateCapitalGainsAttachment({
    name: profile.legalName?.value ?? "",
    tin: formatSsnDigits(profile.ssnOrItin),
    transactions: overflow,
  });

  return new NextResponse(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="schedule-nec-attachment-${CURRENT_SUPPORTED_TAX_YEAR}.pdf"`,
    },
  });
}
