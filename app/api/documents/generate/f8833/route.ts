import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { CURRENT_SUPPORTED_TAX_YEAR } from "@/lib/config/taxYear";
import { loadEngineContext } from "@/lib/server/engineContext";
import { computeF8833 } from "@/lib/rules/forms/f8833";
import { F8833_FIELD_MAP } from "@/lib/pdf/fieldMaps/f8833";
import { fillPdfForm } from "@/lib/pdf/fillForm";

export async function GET() {
  const result = await loadEngineContext();
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  const { profile, income } = result.context;

  if (!income.needsForm8833) {
    return NextResponse.json(
      { error: "No treaty-based return position requiring disclosure this year." },
      { status: 400 }
    );
  }

  const lines = computeF8833({ profile, income });

  const templateBytes = await fs.readFile(path.join(process.cwd(), "lib/pdf/templates/f8833.pdf"));
  const filledBytes = await fillPdfForm(templateBytes, F8833_FIELD_MAP, lines);

  return new NextResponse(Buffer.from(filledBytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="form-8833-${CURRENT_SUPPORTED_TAX_YEAR}.pdf"`,
    },
  });
}
