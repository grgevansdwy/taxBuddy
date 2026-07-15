import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { PDFDocument } from "pdf-lib";
import { loadEngineContext, type EngineContext } from "@/lib/server/engineContext";
import { computeF1040NR } from "@/lib/rules/forms/f1040nr";
import { computeForm8843 } from "@/lib/rules/forms/f8843";
import { computeScheduleNEC } from "@/lib/rules/forms/scheduleNEC";
import { computeScheduleOI } from "@/lib/rules/forms/scheduleOI";
import { computeScheduleA } from "@/lib/rules/forms/scheduleA";
import { computeF8833 } from "@/lib/rules/forms/f8833";
import { F1040NR_FIELD_MAP } from "@/lib/pdf/fieldMaps/f1040nr";
import { F8843_FIELD_MAP } from "@/lib/pdf/fieldMaps/f8843";
import { SCHEDULE_NEC_FIELD_MAP } from "@/lib/pdf/fieldMaps/scheduleNEC";
import { SCHEDULE_OI_FIELD_MAP } from "@/lib/pdf/fieldMaps/scheduleOI";
import { SCHEDULE_A_FIELD_MAP } from "@/lib/pdf/fieldMaps/scheduleA";
import { F8833_FIELD_MAP } from "@/lib/pdf/fieldMaps/f8833";
import { fillPdfForm } from "@/lib/pdf/fillForm";
import type { PdfFieldEntry } from "@/lib/pdf/types";

// Internal-only: reuses the exact same context loader, compute function, and
// field map as the real /api/documents/generate/* routes, but (a) reports
// which computed keys have no field-map entry, and (b) reloads the filled
// PDF (without flattening) to read back what actually ended up in each
// field, so a silent typo/maxLength/field-name mismatch is visible without
// having to open the downloaded PDF by eye.
const FORM_REGISTRY = {
  "1040nr": {
    template: "1040nr.pdf",
    fieldMap: F1040NR_FIELD_MAP,
    compute: (ctx: EngineContext) => computeF1040NR({ profile: ctx.profile, income: ctx.income }),
  },
  f8843: {
    template: "f8843.pdf",
    fieldMap: F8843_FIELD_MAP,
    compute: (ctx: EngineContext) =>
      computeForm8843({
        profile: ctx.profile,
        residency: ctx.residency,
        eligibilityInput: ctx.eligibilityInput,
        onlyForm8843: !ctx.income.hasReportableIncome,
      }),
  },
  schedNEC: {
    template: "scheduleNEC.pdf",
    fieldMap: SCHEDULE_NEC_FIELD_MAP,
    compute: (ctx: EngineContext) => computeScheduleNEC({ profile: ctx.profile, income: ctx.income }),
  },
  schedOI: {
    template: "scheduleOI.pdf",
    fieldMap: SCHEDULE_OI_FIELD_MAP,
    compute: (ctx: EngineContext) =>
      computeScheduleOI({ profile: ctx.profile, residency: ctx.residency, eligibilityInput: ctx.eligibilityInput, income: ctx.income }),
  },
  schedA: {
    template: "scheduleA.pdf",
    fieldMap: SCHEDULE_A_FIELD_MAP,
    compute: (ctx: EngineContext) => computeScheduleA({ profile: ctx.profile, income: ctx.income }),
  },
  f8833: {
    template: "f8833.pdf",
    fieldMap: F8833_FIELD_MAP,
    compute: (ctx: EngineContext) => computeF8833({ profile: ctx.profile, income: ctx.income }),
  },
} as const;

type FormKey = keyof typeof FORM_REGISTRY;

function readActualValue(form: ReturnType<PDFDocument["getForm"]>, entry: PdfFieldEntry): string {
  if (entry.type === "text") {
    return form.getTextField(entry.field).getText() ?? "";
  }
  if (entry.type === "checkboxSingle") {
    return form.getCheckBox(entry.field).isChecked() ? "yes" : "";
  }
  if (form.getCheckBox(entry.yesField).isChecked()) return "yes";
  if (form.getCheckBox(entry.noField).isChecked()) return "no";
  return "";
}

export async function GET(request: Request) {
  const form = new URL(request.url).searchParams.get("form") as FormKey | null;
  if (!form || !(form in FORM_REGISTRY)) {
    return NextResponse.json(
      { error: `"form" query param must be one of: ${Object.keys(FORM_REGISTRY).join(", ")}` },
      { status: 400 }
    );
  }

  const result = await loadEngineContext();
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  const { template, fieldMap, compute } = FORM_REGISTRY[form];
  const computed = compute(result.context);
  const unmapped = Object.keys(computed).filter((key) => !fieldMap[key]);

  const templateBytes = await fs.readFile(path.join(process.cwd(), "lib/pdf/templates", template));
  const filledBytes = await fillPdfForm(templateBytes, fieldMap, computed, { flatten: false });
  const filledDoc = await PDFDocument.load(filledBytes);
  const filledForm = filledDoc.getForm();

  const actual: Record<string, string> = {};
  for (const [key, entry] of Object.entries(fieldMap)) {
    try {
      actual[key] = readActualValue(filledForm, entry);
    } catch (err) {
      actual[key] = `<error: ${err instanceof Error ? err.message : String(err)}>`;
    }
  }

  return NextResponse.json({ form, computed, unmapped, actual });
}
