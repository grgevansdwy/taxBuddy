import { PDFDocument } from "pdf-lib";
import type { PdfFieldEntry } from "@/lib/pdf/types";

// Generic AcroForm filler: takes a blank official PDF template, a static
// field-name map, and a values dict keyed by semantic line (e.g.
// "f8843.4b"), and returns the filled, flattened PDF bytes. No AI — every
// value is set exactly as computed upstream by the rules engine.
export async function fillPdfForm(
  templateBytes: Uint8Array,
  fieldMap: Record<string, PdfFieldEntry>,
  values: Record<string, string>,
  { flatten = true }: { flatten?: boolean } = {}
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.load(templateBytes);
  const form = pdfDoc.getForm();

  for (const [key, value] of Object.entries(values)) {
    const entry = fieldMap[key];
    if (!entry) {
      console.warn(`fillPdfForm: no field mapping for "${key}"`);
      continue;
    }

    if (entry.type === "text") {
      if (!value) continue;
      form.getTextField(entry.field).setText(value);
    } else {
      const targetField = value === "yes" ? entry.yesField : entry.noField;
      form.getCheckBox(targetField).check();
    }
  }

  if (flatten) form.flatten();
  return pdfDoc.save();
}
