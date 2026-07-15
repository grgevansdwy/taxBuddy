// Maps semantic line keys (produced by lib/rules/forms/f8843.ts) to the
// actual AcroForm field names on the official 2025 Form 8843 PDF
// (lib/pdf/templates/f8843.pdf, pulled from irs.gov/pub/irs-pdf/f8843.pdf).
// Field names were resolved by rendering the PDF and cross-referencing each
// field's page position against the printed line labels — see conversation
// history for the derivation. Line 11's year columns (2019–2024) are printed
// statically on this form revision; re-verify against the new PDF if
// CURRENT_SUPPORTED_TAX_YEAR ever moves off 2025.

import type { PdfFieldEntry } from "@/lib/pdf/types";

const PAGE1 = "topmostSubform[0].Page1[0]";

export const F8843_FIELD_MAP: Record<string, PdfFieldEntry> = {
  // f1_01/f1_02/f1_03 (topmost row) are the fiscal-year begin/end/20__
  // fields — left blank for calendar-year filers, so they're unmapped.
  "f8843.firstName": { type: "text", field: `${PAGE1}.f1_04[0]` },
  "f8843.lastName": { type: "text", field: `${PAGE1}.f1_05[0]` },
  "f8843.tin": { type: "text", field: `${PAGE1}.f1_06[0]` }, // maxLength=11, confirms this is the TIN field
  "f8843.foreignAddress": { type: "text", field: `${PAGE1}.f1_07[0]` }, // address in country of residence
  "f8843.usAddress": { type: "text", field: `${PAGE1}.f1_08[0]` },
  "f8843.1a": { type: "text", field: `${PAGE1}.f1_09[0]` }, // visa type + date entered
  "f8843.1b": { type: "text", field: `${PAGE1}.f1_10[0]` }, // immigration status on last day of the tax year
  "f8843.2": { type: "text", field: `${PAGE1}.f1_11[0]` }, // citizenship
  "f8843.3a": { type: "text", field: `${PAGE1}.f1_12[0]` }, // passport country
  "f8843.3b": { type: "text", field: `${PAGE1}.f1_13[0]` }, // passport number
  "f8843.4a.taxYear": { type: "text", field: `${PAGE1}.f1_14[0]` }, // days present, current tax year
  "f8843.4a.prior1": { type: "text", field: `${PAGE1}.f1_15[0]` }, // days present, prior year
  "f8843.4a.prior2": { type: "text", field: `${PAGE1}.f1_16[0]` }, // days present, 2 years prior
  "f8843.4b": { type: "text", field: `${PAGE1}.f1_17[0]` }, // days excluded
  "f8843.9": { type: "text", field: `${PAGE1}.f1_26[0]` }, // school name/address/phone (Part III students)
  "f8843.10": { type: "text", field: `${PAGE1}.f1_27[0]` }, // director (DSO) name/address/phone — box immediately below line 9
  // maxLength=1 on all six per the official form (a single visa-type letter
  // F/J/M/Q per year) — but we print the full "F-1"/"J-1" string instead, so
  // fillPdfForm() deliberately lifts this cap (removeMaxLength()) before
  // writing these fields. Worth a visual check since the printed box is
  // drawn narrow enough for one character.
  "f8843.11.2019": { type: "text", field: `${PAGE1}.f1_28[0]` },
  "f8843.11.2020": { type: "text", field: `${PAGE1}.f1_29[0]` },
  "f8843.11.2021": { type: "text", field: `${PAGE1}.f1_30[0]` },
  "f8843.11.2022": { type: "text", field: `${PAGE1}.f1_31[0]` },
  "f8843.11.2023": { type: "text", field: `${PAGE1}.f1_32[0]` },
  "f8843.11.2024": { type: "text", field: `${PAGE1}.f1_33[0]` },
  "f8843.12": { type: "checkbox", yesField: `${PAGE1}.c1_2[0]`, noField: `${PAGE1}.c1_2[1]` }, // exempt >5 years?
  "f8843.13": { type: "checkbox", yesField: `${PAGE1}.c1_3[0]`, noField: `${PAGE1}.c1_3[1]` }, // applied for LPR status?
  "f8843.14": { type: "text", field: `${PAGE1}.f1_34[0]` }, // explanation if line 13 = yes
};
