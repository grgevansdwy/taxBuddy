import type { DocType } from "@/lib/types";

export const DOC_LABELS: Partial<Record<DocType, string>> = {
  i20: "I-20 (Certificate of Eligibility)",
  w2: "W-2 (Wage and Tax Statement)",
  ead: "EAD Card",
  f1042s: "1042-S",
  f1099combined: "1099 (Interest / Dividends / Broker)",
};
