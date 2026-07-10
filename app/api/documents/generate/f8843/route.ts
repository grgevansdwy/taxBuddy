import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { createClient } from "@/lib/supabase/server";
import { CURRENT_SUPPORTED_TAX_YEAR } from "@/lib/config/taxYear";
import { computeForm8843 } from "@/lib/rules/forms/f8843";
import { F8843_FIELD_MAP } from "@/lib/pdf/fieldMaps/f8843";
import { fillPdfForm } from "@/lib/pdf/fillForm";
import type { EligibilityInput, FilerProfile, ResidencyResult } from "@/lib/types";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { data } = await supabase
    .from("filings")
    .select("profile, residency, eligibility_input")
    .eq("user_id", user.id)
    .eq("tax_year", CURRENT_SUPPORTED_TAX_YEAR)
    .maybeSingle();

  if (!data?.residency || !data?.eligibility_input) {
    return NextResponse.json(
      { error: "Finish the eligibility and profile steps before generating Form 8843." },
      { status: 400 }
    );
  }

  const lines = computeForm8843({
    profile: (data.profile as Partial<FilerProfile>) ?? {},
    residency: data.residency as ResidencyResult,
    eligibilityInput: data.eligibility_input as EligibilityInput,
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
