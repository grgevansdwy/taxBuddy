import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { CURRENT_SUPPORTED_TAX_YEAR } from "@/lib/config/taxYear";
import { loadEngineContext } from "@/lib/server/engineContext";
import { computeForm8843 } from "@/lib/rules/forms/f8843";
import { F8843_FIELD_MAP } from "@/lib/pdf/fieldMaps/f8843";
import { fillPdfForm } from "@/lib/pdf/fillForm";

export async function GET() {
  const result = await loadEngineContext();
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  const { profile, residency, eligibilityInput, income } = result.context;

  const lines = computeForm8843({
    profile,
    residency,
    eligibilityInput,
    onlyForm8843: !income.hasReportableIncome,
  });

  const templateBytes = await fs.readFile(path.join(process.cwd(), "lib/pdf/templates/f8843.pdf"));
  const filledBytes = await fillPdfForm(templateBytes, F8843_FIELD_MAP, lines);

  return new NextResponse(Buffer.from(filledBytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="form-8843-${CURRENT_SUPPORTED_TAX_YEAR}.pdf"`,
    },
  });
}
