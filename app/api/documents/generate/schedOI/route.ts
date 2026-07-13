import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { CURRENT_SUPPORTED_TAX_YEAR } from "@/lib/config/taxYear";
import { loadEngineContext } from "@/lib/server/engineContext";
import { computeScheduleOI } from "@/lib/rules/forms/scheduleOI";
import { SCHEDULE_OI_FIELD_MAP } from "@/lib/pdf/fieldMaps/scheduleOI";
import { fillPdfForm } from "@/lib/pdf/fillForm";

export async function GET() {
  const result = await loadEngineContext();
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  const { profile, residency, eligibilityInput, income } = result.context;

  const lines = computeScheduleOI({ profile, residency, eligibilityInput, income });

  const templateBytes = await fs.readFile(path.join(process.cwd(), "lib/pdf/templates/scheduleOI.pdf"));
  const filledBytes = await fillPdfForm(templateBytes, SCHEDULE_OI_FIELD_MAP, lines);

  return new NextResponse(Buffer.from(filledBytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="schedule-oi-${CURRENT_SUPPORTED_TAX_YEAR}.pdf"`,
    },
  });
}
