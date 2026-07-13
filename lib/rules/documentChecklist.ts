import type { DocType, InterviewAnswers } from "@/lib/types";

export function computeDocumentChecklist(interview: InterviewAnswers): DocType[] {
  const docs: DocType[] = ["i94", "travel_history", "i20"];

  if (interview.workedInUs) {
    docs.push("w2");
    if (interview.onOPT) docs.push("ead");
  }

  if (interview.scholarshipCoverage === "tuition_and_living") {
    docs.push("f1098t", "f1042s");
  }

  // Brokers issue one "Consolidated 1099" covering interest/dividends/broker
  // transactions — ask for it once, not as three separate uploads.
  if (interview.interestIncome || interview.dividendIncome || interview.soldAssets) {
    docs.push("f1099combined");
  }

  return docs;
}

const EXPLANATIONS: Partial<Record<DocType, string>> = {
  i94: "Your I-94 confirms your visa status and entry history — already on file.",
  travel_history: "Your travel history is what let us confirm the five-year rule — already on file.",
  i20: "Your I-20 confirms your school and SEVIS enrollment details — every F-1 filer needs one on file.",
  w2: "You told us you worked in the US this year, so we need your W-2 wage statement.",
  ead: "You're on OPT, so we need your EAD card to confirm your work authorization.",
  f1098t: "Your scholarship covers tuition and living expenses, so we need your 1098-T to work out the taxable portion.",
  f1042s: "Your scholarship covers tuition and living expenses, so we need your 1042-S if your school issued one for the taxable portion.",
  f1099combined:
    "You told us about interest, dividend, or investment sale income, so we need your 1099 — the combined statement your bank or broker sends (INT/DIV/B sections together) works fine, we'll pull out whichever sections apply.",
};

export function explainChecklist(docs: DocType[]): string {
  return docs
    .map((doc) => EXPLANATIONS[doc])
    .filter((line): line is string => Boolean(line))
    .join(" ");
}
