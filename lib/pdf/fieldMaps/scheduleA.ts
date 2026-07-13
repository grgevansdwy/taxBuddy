// Maps semantic line keys (produced by lib/rules/forms/scheduleA.ts) to the
// actual AcroForm field names on the official 2025 Schedule A (Form 1040-NR)
// PDF (lib/pdf/templates/scheduleA.pdf, pulled from
// irs.gov/pub/irs-pdf/f1040nra.pdf). Field names were resolved by filling
// every field with its own short name and rasterizing the result — same
// method as f8843's field map.

import type { PdfFieldEntry } from "@/lib/pdf/types";

const PAGE1 = "form1040-NR[0].Page1[0]";

export const SCHEDULE_A_FIELD_MAP: Record<string, PdfFieldEntry> = {
  "schedA.name": { type: "text", field: `${PAGE1}.f1_1[0]` },
  "schedA.tin": { type: "text", field: `${PAGE1}.f1_2[0]` },
  "schedA.2": { type: "text", field: `${PAGE1}.Line2_ReadOrder[0].f1_5[0]` }, // gifts by cash or check
  "schedA.5": { type: "text", field: `${PAGE1}.f1_8[0]` }, // add lines 2-4
  "schedA.8": { type: "text", field: `${PAGE1}.f1_12[0]` }, // total itemized deductions → Form 1040-NR line 12
};
