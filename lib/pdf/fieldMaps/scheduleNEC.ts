// Maps semantic line keys (produced by lib/rules/forms/scheduleNEC.ts) to the
// actual AcroForm field names on the official 2025 Schedule NEC (Form
// 1040-NR) PDF (lib/pdf/templates/scheduleNEC.pdf, pulled from
// irs.gov/pub/irs-pdf/f1040nrn.pdf). Field names were resolved by filling
// every field with its own short name and rasterizing the result — same
// method as f8843's field map. Each "Nature of Income" row has 5 amount
// slots: 10% (a), 15% (b), 30% (c), and two independent "Other" slots, each
// with its own rate — this app only ever uses the first "Other" slot
// (schedNEC.d.rate / column "d" in lib/rules/forms/scheduleNEC.ts). Every
// row lives inside its own named group (Table_NatureOfIncome[0].LineXX[0]).

import type { PdfFieldEntry } from "@/lib/pdf/types";

const PAGE1 = "form1040-NR[0].Page1[0]";
const TABLE = `${PAGE1}.Table_NatureOfIncome[0]`;

export const SCHEDULE_NEC_FIELD_MAP: Record<string, PdfFieldEntry> = {
  "schedNEC.name": { type: "text", field: `${PAGE1}.f1_1[0]` },
  "schedNEC.tin": { type: "text", field: `${PAGE1}.f1_2[0]` },
  "schedNEC.d.rate": { type: "text", field: `${TABLE}.Header[0].f1_3[0]` }, // shared "Other" column rate, printed once

  // Line 1a — Dividends paid by U.S. corporations
  "schedNEC.1a.a": { type: "text", field: `${TABLE}.Line1a[0].f1_5[0]` },
  "schedNEC.1a.b": { type: "text", field: `${TABLE}.Line1a[0].f1_6[0]` },
  "schedNEC.1a.c": { type: "text", field: `${TABLE}.Line1a[0].f1_7[0]` },
  "schedNEC.1a.d": { type: "text", field: `${TABLE}.Line1a[0].f1_8[0]` },

  // Line 9 — Capital gain from line 18 below
  "schedNEC.9.a": { type: "text", field: `${TABLE}.Line9[0].f1_65[0]` },
  "schedNEC.9.b": { type: "text", field: `${TABLE}.Line9[0].f1_66[0]` },
  "schedNEC.9.c": { type: "text", field: `${TABLE}.Line9[0].f1_67[0]` },
  "schedNEC.9.d": { type: "text", field: `${TABLE}.Line9[0].f1_68[0]` },

  // Line 13 — column totals
  "schedNEC.13.a": { type: "text", field: `${TABLE}.Line13[0].f1_89[0]` },
  "schedNEC.13.b": { type: "text", field: `${TABLE}.Line13[0].f1_90[0]` },
  "schedNEC.13.c": { type: "text", field: `${TABLE}.Line13[0].f1_91[0]` },
  "schedNEC.13.d": { type: "text", field: `${TABLE}.Line13[0].f1_92[0]` },

  // Line 14 — column totals × rate
  "schedNEC.14.a": { type: "text", field: `${TABLE}.Line14[0].f1_94[0]` },
  "schedNEC.14.b": { type: "text", field: `${TABLE}.Line14[0].f1_95[0]` },
  "schedNEC.14.c": { type: "text", field: `${TABLE}.Line14[0].f1_96[0]` },
  "schedNEC.14.d": { type: "text", field: `${TABLE}.Line14[0].f1_97[0]` },

  "schedNEC.15": { type: "text", field: `${PAGE1}.f1_99[0]` }, // total NEC tax → Form 1040-NR line 23a

  // Capital Gains and Losses worksheet, line 16 — 5 built-in rows
  // (Table_Line16), each: kind/description, date acquired, date sold, sales
  // price, cost basis, loss, gain. Any lot beyond the first 5 goes on the
  // overflow attachment instead (see lib/rules/forms/scheduleNEC.ts).
  "schedNEC.16.kind.0": { type: "text", field: `${PAGE1}.Table_Line16[0].BodyRow1[0].f1_100[0]` },
  "schedNEC.16.dateAcquired.0": { type: "text", field: `${PAGE1}.Table_Line16[0].BodyRow1[0].f1_101[0]` },
  "schedNEC.16.dateSold.0": { type: "text", field: `${PAGE1}.Table_Line16[0].BodyRow1[0].f1_102[0]` },
  "schedNEC.16.salesPrice.0": { type: "text", field: `${PAGE1}.Table_Line16[0].BodyRow1[0].f1_103[0]` },
  "schedNEC.16.costBasis.0": { type: "text", field: `${PAGE1}.Table_Line16[0].BodyRow1[0].f1_104[0]` },
  "schedNEC.16.loss.0": { type: "text", field: `${PAGE1}.Table_Line16[0].BodyRow1[0].f1_105[0]` },
  "schedNEC.16.gain.0": { type: "text", field: `${PAGE1}.Table_Line16[0].BodyRow1[0].f1_106[0]` },

  "schedNEC.16.kind.1": { type: "text", field: `${PAGE1}.Table_Line16[0].BodyRow2[0].f1_107[0]` },
  "schedNEC.16.dateAcquired.1": { type: "text", field: `${PAGE1}.Table_Line16[0].BodyRow2[0].f1_108[0]` },
  "schedNEC.16.dateSold.1": { type: "text", field: `${PAGE1}.Table_Line16[0].BodyRow2[0].f1_109[0]` },
  "schedNEC.16.salesPrice.1": { type: "text", field: `${PAGE1}.Table_Line16[0].BodyRow2[0].f1_110[0]` },
  "schedNEC.16.costBasis.1": { type: "text", field: `${PAGE1}.Table_Line16[0].BodyRow2[0].f1_111[0]` },
  "schedNEC.16.loss.1": { type: "text", field: `${PAGE1}.Table_Line16[0].BodyRow2[0].f1_112[0]` },
  "schedNEC.16.gain.1": { type: "text", field: `${PAGE1}.Table_Line16[0].BodyRow2[0].f1_113[0]` },

  "schedNEC.16.kind.2": { type: "text", field: `${PAGE1}.Table_Line16[0].BodyRow3[0].f1_114[0]` },
  "schedNEC.16.dateAcquired.2": { type: "text", field: `${PAGE1}.Table_Line16[0].BodyRow3[0].f1_115[0]` },
  "schedNEC.16.dateSold.2": { type: "text", field: `${PAGE1}.Table_Line16[0].BodyRow3[0].f1_116[0]` },
  "schedNEC.16.salesPrice.2": { type: "text", field: `${PAGE1}.Table_Line16[0].BodyRow3[0].f1_117[0]` },
  "schedNEC.16.costBasis.2": { type: "text", field: `${PAGE1}.Table_Line16[0].BodyRow3[0].f1_118[0]` },
  "schedNEC.16.loss.2": { type: "text", field: `${PAGE1}.Table_Line16[0].BodyRow3[0].f1_119[0]` },
  "schedNEC.16.gain.2": { type: "text", field: `${PAGE1}.Table_Line16[0].BodyRow3[0].f1_120[0]` },

  "schedNEC.16.kind.3": { type: "text", field: `${PAGE1}.Table_Line16[0].BodyRow4[0].f1_121[0]` },
  "schedNEC.16.dateAcquired.3": { type: "text", field: `${PAGE1}.Table_Line16[0].BodyRow4[0].f1_122[0]` },
  "schedNEC.16.dateSold.3": { type: "text", field: `${PAGE1}.Table_Line16[0].BodyRow4[0].f1_123[0]` },
  "schedNEC.16.salesPrice.3": { type: "text", field: `${PAGE1}.Table_Line16[0].BodyRow4[0].f1_124[0]` },
  "schedNEC.16.costBasis.3": { type: "text", field: `${PAGE1}.Table_Line16[0].BodyRow4[0].f1_125[0]` },
  "schedNEC.16.loss.3": { type: "text", field: `${PAGE1}.Table_Line16[0].BodyRow4[0].f1_126[0]` },
  "schedNEC.16.gain.3": { type: "text", field: `${PAGE1}.Table_Line16[0].BodyRow4[0].f1_127[0]` },

  "schedNEC.16.kind.4": { type: "text", field: `${PAGE1}.Table_Line16[0].BodyRow5[0].f1_128[0]` },
  "schedNEC.16.dateAcquired.4": { type: "text", field: `${PAGE1}.Table_Line16[0].BodyRow5[0].f1_129[0]` },
  "schedNEC.16.dateSold.4": { type: "text", field: `${PAGE1}.Table_Line16[0].BodyRow5[0].f1_130[0]` },
  "schedNEC.16.salesPrice.4": { type: "text", field: `${PAGE1}.Table_Line16[0].BodyRow5[0].f1_131[0]` },
  "schedNEC.16.costBasis.4": { type: "text", field: `${PAGE1}.Table_Line16[0].BodyRow5[0].f1_132[0]` },
  "schedNEC.16.loss.4": { type: "text", field: `${PAGE1}.Table_Line16[0].BodyRow5[0].f1_133[0]` },
  "schedNEC.16.gain.4": { type: "text", field: `${PAGE1}.Table_Line16[0].BodyRow5[0].f1_134[0]` },

  "schedNEC.17": { type: "text", field: `${PAGE1}.f1_136[0]` }, // gain column of line 17
  "schedNEC.18": { type: "text", field: `${PAGE1}.f1_137[0]` }, // net capital gain → line 9 above
};
