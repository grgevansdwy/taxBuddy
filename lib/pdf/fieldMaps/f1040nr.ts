// Maps semantic line keys (produced by lib/rules/forms/f1040nr.ts) to the
// actual AcroForm field names on the official 2025 Form 1040-NR PDF
// (lib/pdf/templates/1040nr.pdf, pulled from irs.gov/pub/irs-pdf/f1040nr.pdf).
// Field names were resolved by filling every field with its own short name
// and rasterizing the result to cross-reference against the printed line
// labels — same method as f8843's field map, see conversation history.

import type { PdfFieldEntry } from "@/lib/pdf/types";

const PAGE1 = "topmostSubform[0].Page1[0]";
const PAGE2 = "topmostSubform[0].Page2[0]";

export const F1040NR_FIELD_MAP: Record<string, PdfFieldEntry> = {
  "1040nr.firstName": { type: "text", field: `${PAGE1}.f1_14[0]` },
  "1040nr.lastName": { type: "text", field: `${PAGE1}.f1_15[0]` },
  "1040nr.tin": { type: "text", field: `${PAGE1}.f1_16[0]` },

  "1040nr.usAddress.line1": { type: "text", field: `${PAGE1}.f1_17[0]` }, // home address (number and street)
  "1040nr.usAddress.aptNo": { type: "text", field: `${PAGE1}.f1_18[0]` },
  "1040nr.usAddress.city": { type: "text", field: `${PAGE1}.f1_19[0]` },
  "1040nr.usAddress.state": { type: "text", field: `${PAGE1}.f1_20[0]` },
  "1040nr.usAddress.zip": { type: "text", field: `${PAGE1}.f1_21[0]` },

  // Filing Status — pdf-lib exposes each of the 5 radio options as its own
  // checkbox field (c1_5[0..4]); "single"/"mfs" are the only two this app
  // supports (FilerProfile.filingStatus). Each is checked independently
  // (checkboxSingle) rather than as a yes/no pair, since only one of the two
  // semantic keys is ever set to "yes" by computeF1040NR.
  "1040nr.filingStatus.single": { type: "checkboxSingle", field: `${PAGE1}.c1_5[0]` },
  "1040nr.filingStatus.mfs": { type: "checkboxSingle", field: `${PAGE1}.c1_5[1]` },
  "1040nr.digitalAssets": { type: "checkbox", yesField: `${PAGE1}.c1_6[0]`, noField: `${PAGE1}.c1_6[1]` },

  // Income Effectively Connected With U.S. Trade or Business (page 1)
  "1040nr.1a": { type: "text", field: `${PAGE1}.f1_42[0]` }, // total from Form(s) W-2, box 1
  "1040nr.1z": { type: "text", field: `${PAGE1}.f1_54[0]` }, // add lines 1a through 1h
  "1040nr.1k": { type: "text", field: `${PAGE1}.Line1k_ReadOrder[0].f1_53[0]` }, // total income exempt by treaty, from Schedule OI item L
  "1040nr.2a": { type: "text", field: `${PAGE1}.f1_55[0]` }, // tax-exempt interest (informational — bank interest, §871(i))
  "1040nr.8": { type: "text", field: `${PAGE1}.f1_68[0]` }, // additional income from Schedule 1 (taxable scholarship stands in here)
  "1040nr.9": { type: "text", field: `${PAGE1}.f1_69[0]` }, // total effectively connected income
  "1040nr.11a": { type: "text", field: `${PAGE1}.f1_71[0]` }, // adjusted gross income

  // Tax and Credits / Payments (page 2)
  "1040nr.11b": { type: "text", field: `${PAGE2}.f2_01[0]` },
  "1040nr.12": { type: "text", field: `${PAGE2}.f2_02[0]` }, // itemized deductions or India standard deduction
  "1040nr.15": { type: "text", field: `${PAGE2}.f2_07[0]` }, // taxable income
  "1040nr.16": { type: "text", field: `${PAGE2}.f2_09[0]` }, // tax
  "1040nr.18": { type: "text", field: `${PAGE2}.f2_11[0]` },
  "1040nr.22": { type: "text", field: `${PAGE2}.f2_15[0]` },
  "1040nr.23a": { type: "text", field: `${PAGE2}.Line23a_ReadOrder[0].f2_16[0]` }, // Schedule NEC tax
  "1040nr.23d": { type: "text", field: `${PAGE2}.f2_19[0]` },
  "1040nr.24": { type: "text", field: `${PAGE2}.f2_20[0]` }, // total tax
  "1040nr.25a": { type: "text", field: `${PAGE2}.Line25_ReadOrder[0].f2_21[0]` }, // withheld from W-2 wages
  "1040nr.25b": { type: "text", field: `${PAGE2}.f2_22[0]` }, // withheld from 1099s (interest/dividends/capital gains)
  "1040nr.25d": { type: "text", field: `${PAGE2}.f2_24[0]` },
  "1040nr.25g": { type: "text", field: `${PAGE2}.f2_27[0]` }, // withheld from 1042-S (scholarship)
  "1040nr.33": { type: "text", field: `${PAGE2}.f2_35[0]` }, // total payments
  "1040nr.34": { type: "text", field: `${PAGE2}.f2_36[0]` }, // overpaid/refund
  "1040nr.35a": { type: "text", field: `${PAGE2}.f2_37[0]` }, // amount refunded to you
  "1040nr.37": { type: "text", field: `${PAGE2}.f2_42[0]` }, // amount you owe
};
