import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { CURRENT_SUPPORTED_TAX_YEAR } from "@/lib/config/taxYear";
import { loadEngineContext } from "@/lib/server/engineContext";
import { computeScheduleA } from "@/lib/rules/forms/scheduleA";
import { SCHEDULE_A_FIELD_MAP } from "@/lib/pdf/fieldMaps/scheduleA";
import { fillPdfForm } from "@/lib/pdf/fillForm";

export async function GET() {
  const result = await loadEngineContext();
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  const { profile, income } = result.context;

  // India filers who come out ahead on the standard deduction skip Schedule A
  // entirely — the standard deduction figure goes straight on Form 1040-NR
  // line 12 with no attachment. See lib/rules/income.ts's usesStandardDeduction.
  if (income.usesStandardDeduction) {
    return NextResponse.json(
      { error: "Using the standard deduction this year — Schedule A isn't attached to this return." },
      { status: 400 }
    );
  }
  if (income.charitableContributions <= 0) {
    return NextResponse.json({ error: "No itemized deductions to report." }, { status: 400 });
  }

  const lines = computeScheduleA({ profile, income });

  const templateBytes = await fs.readFile(path.join(process.cwd(), "lib/pdf/templates/scheduleA.pdf"));
  const filledBytes = await fillPdfForm(templateBytes, SCHEDULE_A_FIELD_MAP, lines);

  return new NextResponse(Buffer.from(filledBytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="schedule-a-${CURRENT_SUPPORTED_TAX_YEAR}.pdf"`,
    },
  });
}
