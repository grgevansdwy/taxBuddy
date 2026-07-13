import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { CURRENT_SUPPORTED_TAX_YEAR } from "@/lib/config/taxYear";
import { loadEngineContext } from "@/lib/server/engineContext";
import { computeF1040NR } from "@/lib/rules/forms/f1040nr";
import { F1040NR_FIELD_MAP } from "@/lib/pdf/fieldMaps/f1040nr";
import { fillPdfForm } from "@/lib/pdf/fillForm";

export async function GET() {
  const result = await loadEngineContext();
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  const { profile, income } = result.context;

  const lines = computeF1040NR({ profile, income });

  const templateBytes = await fs.readFile(path.join(process.cwd(), "lib/pdf/templates/1040nr.pdf"));
  const filledBytes = await fillPdfForm(templateBytes, F1040NR_FIELD_MAP, lines);

  return new NextResponse(Buffer.from(filledBytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="form-1040nr-${CURRENT_SUPPORTED_TAX_YEAR}.pdf"`,
    },
  });
}
