import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { CURRENT_SUPPORTED_TAX_YEAR } from "@/lib/config/taxYear";
import { loadEngineContext } from "@/lib/server/engineContext";
import { computeScheduleNEC } from "@/lib/rules/forms/scheduleNEC";
import { SCHEDULE_NEC_FIELD_MAP } from "@/lib/pdf/fieldMaps/scheduleNEC";
import { fillPdfForm } from "@/lib/pdf/fillForm";

export async function GET() {
  const result = await loadEngineContext();
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  const { profile, income } = result.context;

  if (income.dividendsGross <= 0 && !income.capitalGainsTaxable) {
    return NextResponse.json(
      { error: "No income not effectively connected with a US trade or business — Schedule NEC isn't needed." },
      { status: 400 }
    );
  }

  const lines = computeScheduleNEC({ profile, income });

  const templateBytes = await fs.readFile(path.join(process.cwd(), "lib/pdf/templates/scheduleNEC.pdf"));
  const filledBytes = await fillPdfForm(templateBytes, SCHEDULE_NEC_FIELD_MAP, lines);

  return new NextResponse(Buffer.from(filledBytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="schedule-nec-${CURRENT_SUPPORTED_TAX_YEAR}.pdf"`,
    },
  });
}
