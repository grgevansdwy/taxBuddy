// Maps semantic line keys (produced by lib/rules/forms/f8833.ts) to the
// actual AcroForm field names on the official Form 8833 (Rev. December 2022)
// PDF (lib/pdf/templates/f8833.pdf, pulled from irs.gov/pub/irs-pdf/f8833.pdf).
// Field names were resolved by filling every field with its own short name
// and rasterizing the result — same method as f8843's field map.

import type { PdfFieldEntry } from "@/lib/pdf/types";

const PAGE1 = "topmostSubform[0].Page1[0]";

export const F8833_FIELD_MAP: Record<string, PdfFieldEntry> = {
  "f8833.name": { type: "text", field: `${PAGE1}.f1_1[0]` },
  "f8833.tin": { type: "text", field: `${PAGE1}.f1_2[0]` },
  "f8833.addressForeign": { type: "text", field: `${PAGE1}.f1_4[0]` },
  "f8833.addressUS": { type: "text", field: `${PAGE1}.f1_5[0]` },
  "f8833.checkbox6114": { type: "checkboxSingle", field: `${PAGE1}.BulletedList1[0].Bullet1[0].c1_1[0]` },
  "f8833.1a": { type: "text", field: `${PAGE1}.Lines1-2_ReadOrder[0].f1_6[0]` }, // treaty country
  "f8833.1b": { type: "text", field: `${PAGE1}.Lines1-2_ReadOrder[0].f1_7[0]` }, // article(s)
  "f8833.2": { type: "text", field: `${PAGE1}.f1_8[0]` }, // IRC provision(s) overruled/modified
  "f8833.6": { type: "text", field: `${PAGE1}.f1_12[0]` }, // explanation of treaty-based position
};
