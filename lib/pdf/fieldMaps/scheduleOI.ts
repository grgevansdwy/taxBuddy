// Maps semantic line keys (produced by lib/rules/forms/scheduleOI.ts) to the
// actual AcroForm field names on the official 2025 Schedule OI (Form 1040-NR)
// PDF (lib/pdf/templates/scheduleOI.pdf, pulled from
// irs.gov/pub/irs-pdf/f1040nro.pdf). Field names were resolved by filling
// every field with its own short name and rasterizing the result — same
// method as f8843's field map. Note this PDF's internal root form name is
// "form1040-NR[0]", unlike 1040nr.pdf's "topmostSubform[0]".

import type { PdfFieldEntry } from "@/lib/pdf/types";

const PAGE1 = "form1040-NR[0].Page1[0]";

export const SCHEDULE_OI_FIELD_MAP: Record<string, PdfFieldEntry> = {
  "schedOI.name": { type: "text", field: `${PAGE1}.f1_1[0]` },
  "schedOI.tin": { type: "text", field: `${PAGE1}.f1_2[0]` },
  "schedOI.A": { type: "text", field: `${PAGE1}.f1_3[0]` },
  "schedOI.B": { type: "text", field: `${PAGE1}.f1_4[0]` },
  "schedOI.C": { type: "checkbox", yesField: `${PAGE1}.c1_1[0]`, noField: `${PAGE1}.c1_1[1]` },
  "schedOI.D1": { type: "checkbox", yesField: `${PAGE1}.c1_2[0]`, noField: `${PAGE1}.c1_2[1]` },
  "schedOI.D2": { type: "checkbox", yesField: `${PAGE1}.c1_3[0]`, noField: `${PAGE1}.c1_3[1]` },
  "schedOI.E": { type: "text", field: `${PAGE1}.f1_5[0]` },
  "schedOI.F": { type: "checkbox", yesField: `${PAGE1}.c1_4[0]`, noField: `${PAGE1}.c1_4[1]` },

  "schedOI.G.0.entered": { type: "text", field: `${PAGE1}.LineG_Table1[0].BodyRow1[0].f1_7[0]` },
  "schedOI.G.0.departed": { type: "text", field: `${PAGE1}.LineG_Table1[0].BodyRow1[0].f1_8[0]` },
  "schedOI.G.1.entered": { type: "text", field: `${PAGE1}.LineG_Table1[0].BodyRow2[0].f1_9[0]` },
  "schedOI.G.1.departed": { type: "text", field: `${PAGE1}.LineG_Table1[0].BodyRow2[0].f1_10[0]` },
  "schedOI.G.2.entered": { type: "text", field: `${PAGE1}.LineG_Table1[0].BodyRow3[0].f1_11[0]` },
  "schedOI.G.2.departed": { type: "text", field: `${PAGE1}.LineG_Table1[0].BodyRow3[0].f1_12[0]` },
  "schedOI.G.3.entered": { type: "text", field: `${PAGE1}.LineG_Table1[0].BodyRow4[0].f1_13[0]` },
  "schedOI.G.3.departed": { type: "text", field: `${PAGE1}.LineG_Table1[0].BodyRow4[0].f1_14[0]` },
  "schedOI.G.4.entered": { type: "text", field: `${PAGE1}.LineG_Table2[0].BodyRow1[0].f1_15[0]` },
  "schedOI.G.4.departed": { type: "text", field: `${PAGE1}.LineG_Table2[0].BodyRow1[0].f1_16[0]` },
  "schedOI.G.5.entered": { type: "text", field: `${PAGE1}.LineG_Table2[0].BodyRow2[0].f1_17[0]` },
  "schedOI.G.5.departed": { type: "text", field: `${PAGE1}.LineG_Table2[0].BodyRow2[0].f1_18[0]` },
  "schedOI.G.6.entered": { type: "text", field: `${PAGE1}.LineG_Table2[0].BodyRow3[0].f1_19[0]` },
  "schedOI.G.6.departed": { type: "text", field: `${PAGE1}.LineG_Table2[0].BodyRow3[0].f1_20[0]` },
  "schedOI.G.7.entered": { type: "text", field: `${PAGE1}.LineG_Table2[0].BodyRow4[0].f1_21[0]` },
  "schedOI.G.7.departed": { type: "text", field: `${PAGE1}.LineG_Table2[0].BodyRow4[0].f1_22[0]` },

  "schedOI.H.2023": { type: "text", field: `${PAGE1}.f1_23[0]` },
  "schedOI.H.2024": { type: "text", field: `${PAGE1}.f1_24[0]` },
  "schedOI.H.2025": { type: "text", field: `${PAGE1}.f1_25[0]` },

  "schedOI.I": { type: "checkbox", yesField: `${PAGE1}.c1_6[0]`, noField: `${PAGE1}.c1_6[1]` },
  "schedOI.I.year": { type: "text", field: `${PAGE1}.f1_26[0]` },
  "schedOI.J": { type: "checkbox", yesField: `${PAGE1}.c1_7[0]`, noField: `${PAGE1}.c1_7[1]` },
  "schedOI.K": { type: "checkbox", yesField: `${PAGE1}.c1_9[0]`, noField: `${PAGE1}.c1_9[1]` },

  "schedOI.L.country": { type: "text", field: `${PAGE1}.LineL1_Table[0].BodyRow1[0].f1_27[0]` },
  "schedOI.L.article": { type: "text", field: `${PAGE1}.LineL1_Table[0].BodyRow1[0].f1_28[0]` },
  "schedOI.L.monthsPriorYears": { type: "text", field: `${PAGE1}.LineL1_Table[0].BodyRow1[0].f1_29[0]` },
  "schedOI.L.amount": { type: "text", field: `${PAGE1}.LineL1_Table[0].BodyRow1[0].f1_30[0]` },
  "schedOI.L.total": { type: "text", field: `${PAGE1}.f1_39[0]` }, // → Form 1040-NR line 1k
  "schedOI.L2": { type: "checkbox", yesField: `${PAGE1}.c1_11[0]`, noField: `${PAGE1}.c1_11[1]` },
  "schedOI.L3": { type: "checkbox", yesField: `${PAGE1}.c1_12[0]`, noField: `${PAGE1}.c1_12[1]` },
};
