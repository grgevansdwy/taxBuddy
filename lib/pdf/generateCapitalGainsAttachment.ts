import { PDFDocument, StandardFonts, breakTextIntoLines, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import type { F1099BTransaction } from "@/lib/types";
import { formatIsoDateSlashes, formatUsd } from "@/lib/format";

// Free-form statement, not an official IRS form — Schedule NEC's own line 16
// instructions explicitly allow this: "if necessary, attach statement of
// descriptive details not shown below." Built from scratch with pdf-lib's
// drawing API (no AcroForm template) since there's no official layout to
// match, only Schedule NEC's own line 16 table to mirror column-for-column.
// Paginates automatically, repeating the name/TIN header and column labels
// on every page.

const PAGE_WIDTH = 612; // US Letter, points — matches every other form in lib/pdf/templates
const PAGE_HEIGHT = 792;
const MARGIN = 36;
const ROW_HEIGHT = 14;
const HEADER_FONT_SIZE = 8;
const BODY_FONT_SIZE = 8;
const TITLE_FONT_SIZE = 11;

interface Column {
  key: keyof RowValues;
  label: string;
  x: number;
  width: number;
  align: "left" | "right";
}

interface RowValues {
  kind: string;
  dateAcquired: string;
  dateSold: string;
  salesPrice: string;
  costBasis: string;
  loss: string;
  gain: string;
}

const COLUMNS: Column[] = [
  { key: "kind", label: "(a) Kind of property and description", x: 36, width: 195, align: "left" },
  { key: "dateAcquired", label: "(b) Date acquired (mo., day, yr)", x: 233, width: 52, align: "left" },
  { key: "dateSold", label: "(c) Date sold (mo., day, yr)", x: 287, width: 52, align: "left" },
  { key: "salesPrice", label: "(d) Sales price", x: 341, width: 62, align: "right" },
  { key: "costBasis", label: "(e) Cost or other basis", x: 405, width: 65, align: "right" },
  { key: "loss", label: "(f) LOSS", x: 472, width: 50, align: "right" },
  { key: "gain", label: "(g) GAIN", x: 524, width: 52, align: "right" },
];

function drawRightAligned(page: PDFPage, text: string, font: PDFFont, size: number, rightEdgeX: number, y: number) {
  const width = font.widthOfTextAtSize(text, size);
  page.drawText(text, { x: rightEdgeX - width, y, size, font });
}

// How many lines "kind" (the only column long enough to ever wrap) will
// take, so the caller can reserve enough vertical space before drawing —
// otherwise a wrapped 2-line description silently overlaps the row below it.
function wrappedLineCount(text: string, font: PDFFont, size: number, maxWidth: number): number {
  return breakTextIntoLines(text, [" "], maxWidth, (t) => font.widthOfTextAtSize(t, size)).length;
}

function drawRow(page: PDFPage, values: RowValues, font: PDFFont, size: number, y: number) {
  for (const col of COLUMNS) {
    const text = values[col.key];
    if (!text) continue;
    if (col.align === "right") {
      drawRightAligned(page, text, font, size, col.x + col.width, y);
    } else {
      page.drawText(text, { x: col.x, y, size, font, maxWidth: col.width, lineHeight: size + 2 });
    }
  }
}

// Header captions are short guide text, not data — always left-aligned and
// word-wrapped, even in columns whose data rows are right-aligned (drawText
// doesn't support right-aligning multi-line text, and these labels don't
// need it).
function drawHeaderRow(page: PDFPage, font: PDFFont, size: number, y: number) {
  for (const col of COLUMNS) {
    page.drawText(col.label, { x: col.x, y, size, font, maxWidth: col.width, lineHeight: size + 2 });
  }
}

function newPage(doc: PDFDocument, font: PDFFont, boldFont: PDFFont, name: string, tin: string): { page: PDFPage; y: number } {
  const page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let y = PAGE_HEIGHT - MARGIN;

  page.drawText(tin, { x: MARGIN, y, size: BODY_FONT_SIZE, font, color: rgb(0, 0, 0.6) });
  const nameWidth = font.widthOfTextAtSize(name, BODY_FONT_SIZE);
  page.drawText(name, { x: PAGE_WIDTH - MARGIN - nameWidth, y, size: BODY_FONT_SIZE, font, color: rgb(0, 0, 0.6) });
  y -= 20;

  const title = "Attachment to Form 1040-NR, Page 4, Schedule NEC, Line 16, Capital Gains and";
  const title2 = "Losses from Sales or Exchanges of Property";
  page.drawText(title, { x: MARGIN, y, size: TITLE_FONT_SIZE, font: boldFont });
  y -= 14;
  page.drawText(title2, { x: MARGIN, y, size: TITLE_FONT_SIZE, font: boldFont });
  y -= 22;

  drawHeaderRow(page, boldFont, HEADER_FONT_SIZE, y);
  y -= 28; // header wraps to as many as 3 lines in the narrower columns
  page.drawLine({ start: { x: MARGIN, y: y + 4 }, end: { x: PAGE_WIDTH - MARGIN, y: y + 4 }, thickness: 0.5 });
  y -= 4;

  return { page, y };
}

export async function generateCapitalGainsAttachment(args: {
  name: string;
  tin: string;
  transactions: F1099BTransaction[];
}): Promise<Uint8Array> {
  const { name, tin, transactions } = args;
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const boldFont = await doc.embedFont(StandardFonts.HelveticaBold);

  const kindColumn = COLUMNS[0];
  let { page, y } = newPage(doc, font, boldFont, name, tin);

  for (const tx of transactions) {
    const rowHeight = ROW_HEIGHT * wrappedLineCount(tx.description, font, BODY_FONT_SIZE, kindColumn.width);
    if (y - rowHeight < MARGIN) {
      ({ page, y } = newPage(doc, font, boldFont, name, tin));
    }
    drawRow(
      page,
      {
        kind: tx.description,
        dateAcquired: tx.dateAcquired ? formatIsoDateSlashes(tx.dateAcquired) : "Various",
        dateSold: formatIsoDateSlashes(tx.dateSold),
        salesPrice: formatUsd(tx.proceeds),
        costBasis: formatUsd(tx.costBasis),
        loss: tx.realizedGainLoss < 0 ? formatUsd(-tx.realizedGainLoss) : "",
        gain: tx.realizedGainLoss >= 0 ? formatUsd(tx.realizedGainLoss) : "",
      },
      font,
      BODY_FONT_SIZE,
      y
    );
    y -= rowHeight;
  }

  return doc.save();
}
