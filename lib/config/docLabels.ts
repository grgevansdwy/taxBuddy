import type { DocType } from "@/lib/types";

export const DOC_LABELS: Partial<Record<DocType, string>> = {
  i20: "I-20 (Certificate of Eligibility)",
  w2: "W-2 (Wage and Tax Statement)",
  ead: "EAD Card",
  f1098t: "1098-T",
  f1042s: "1042-S",
  f1099int: "1099-INT",
  f1099div: "1099-DIV",
  f1099b: "1099-B",
};
