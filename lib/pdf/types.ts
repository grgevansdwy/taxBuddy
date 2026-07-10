// Shared shape for every form's field map (lib/pdf/fieldMaps/*.ts) — maps a
// semantic line key to the actual AcroForm field name(s) on the official PDF.
export type PdfFieldEntry =
  | { type: "text"; field: string }
  | { type: "checkbox"; yesField: string; noField: string };
