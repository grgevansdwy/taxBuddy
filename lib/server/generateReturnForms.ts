import fs from "fs/promises";
import path from "path";
import { PDFDocument } from "pdf-lib";
import type { PdfFieldEntry } from "@/lib/pdf/types";
import type { EngineContext } from "@/lib/server/engineContext";
import { fillPdfForm } from "@/lib/pdf/fillForm";
import { generateCapitalGainsAttachment } from "@/lib/pdf/generateCapitalGainsAttachment";
import { formatSsnDigits } from "@/lib/format";

import { computeF1040NR } from "@/lib/rules/forms/f1040nr";
import { F1040NR_FIELD_MAP } from "@/lib/pdf/fieldMaps/f1040nr";
import { computeScheduleA } from "@/lib/rules/forms/scheduleA";
import { SCHEDULE_A_FIELD_MAP } from "@/lib/pdf/fieldMaps/scheduleA";
import { computeScheduleNEC } from "@/lib/rules/forms/scheduleNEC";
import { SCHEDULE_NEC_FIELD_MAP } from "@/lib/pdf/fieldMaps/scheduleNEC";
import { computeScheduleOI } from "@/lib/rules/forms/scheduleOI";
import { SCHEDULE_OI_FIELD_MAP } from "@/lib/pdf/fieldMaps/scheduleOI";
import { computeF8833 } from "@/lib/rules/forms/f8833";
import { F8833_FIELD_MAP } from "@/lib/pdf/fieldMaps/f8833";
import { computeForm8843 } from "@/lib/rules/forms/f8843";
import { F8843_FIELD_MAP } from "@/lib/pdf/fieldMaps/f8843";

// The overflow threshold — Schedule NEC's line 16 table only prints the first
// 5 lots directly on the form; the rest go on the continuation statement. Kept
// in sync with LINE_16_BUILTIN_ROWS in lib/rules/forms/scheduleNEC.ts.
const LINE_16_BUILTIN_ROWS = 5;

export interface ReturnForm {
  id: string;
  bytes: Uint8Array;
}

async function fillTemplate(
  template: string,
  map: Record<string, PdfFieldEntry>,
  lines: Record<string, string>
): Promise<Uint8Array> {
  const templateBytes = await fs.readFile(path.join(process.cwd(), "lib/pdf/templates", template));
  return fillPdfForm(templateBytes, map, lines);
}

// Single source of truth for which forms a given filer's return contains and in
// what order — the individual /generate/* routes each emit one of these, and
// the combined packet route (and dashboard applicability) read from the same
// rules so a form can never appear in one place and be dropped from another.
// Order roughly follows the IRS attachment-sequence numbers you mail them in:
// Form 1040-NR first, then Schedule A (7A), Schedule NEC (7B), Schedule OI
// (7C), Form 8833, and Form 8843 (102). The Schedule NEC line-16 continuation
// statement is placed LAST (at the bottom of the packet) rather than directly
// behind Schedule NEC.
export async function generateReturnForms(context: EngineContext): Promise<ReturnForm[]> {
  const { profile, residency, eligibilityInput, income } = context;
  const forms: ReturnForm[] = [];

  forms.push({
    id: "1040nr",
    bytes: await fillTemplate("1040nr.pdf", F1040NR_FIELD_MAP, computeF1040NR({ profile, income })),
  });

  if (!income.usesStandardDeduction && income.charitableContributions > 0) {
    forms.push({
      id: "schedA",
      bytes: await fillTemplate("scheduleA.pdf", SCHEDULE_A_FIELD_MAP, computeScheduleA({ profile, income })),
    });
  }

  if (income.dividendsGross > 0 || income.capitalGainsTaxable) {
    forms.push({
      id: "schedNEC",
      bytes: await fillTemplate("scheduleNEC.pdf", SCHEDULE_NEC_FIELD_MAP, computeScheduleNEC({ profile, income })),
    });
  }

  forms.push({
    id: "schedOI",
    bytes: await fillTemplate(
      "scheduleOI.pdf",
      SCHEDULE_OI_FIELD_MAP,
      computeScheduleOI({ profile, residency, eligibilityInput, income })
    ),
  });

  if (income.needsForm8833) {
    forms.push({
      id: "f8833",
      bytes: await fillTemplate("f8833.pdf", F8833_FIELD_MAP, computeF8833({ profile, income })),
    });
  }

  forms.push({
    id: "f8843",
    bytes: await fillTemplate(
      "f8843.pdf",
      F8843_FIELD_MAP,
      computeForm8843({ profile, residency, eligibilityInput, onlyForm8843: !income.hasReportableIncome })
    ),
  });

  // The Schedule NEC line-16 continuation statement goes LAST, at the bottom of
  // the packet, rather than immediately behind Schedule NEC.
  const overflow = income.capitalGainsTransactions.slice(LINE_16_BUILTIN_ROWS);
  if (income.capitalGainsTaxable && overflow.length > 0) {
    forms.push({
      id: "schedNEC-attachment",
      bytes: await generateCapitalGainsAttachment({
        name: profile.legalName?.value ?? "",
        tin: formatSsnDigits(profile.ssnOrItin),
        transactions: overflow,
      }),
    });
  }

  return forms;
}

// Concatenate the ordered per-form PDFs into one mail-ready packet, preserving
// each form's own page count (Form 8843 is 2 pages, the NEC overflow statement
// can be several).
export async function mergeReturnForms(forms: ReturnForm[]): Promise<Uint8Array> {
  const packet = await PDFDocument.create();
  for (const form of forms) {
    const doc = await PDFDocument.load(form.bytes);
    const pages = await packet.copyPages(doc, doc.getPageIndices());
    pages.forEach((page) => packet.addPage(page));
  }
  return packet.save();
}
