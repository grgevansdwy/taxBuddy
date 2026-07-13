import { anthropic } from "@/lib/ai/client";
import { withConfidenceRetry } from "@/lib/ai/withConfidenceRetry";
import { F1042SExtractionSchema, type F1042SExtraction } from "@/lib/extraction/schemas/f1042s";

const SYSTEM_PROMPT =
  "You extract fields from a US Form 1042-S (Foreign Person's U.S. Source " +
  "Income Subject to Withholding) for an F-1 student's tax filing. Extract " +
  "only what's clearly printed in the document; do not infer or guess a " +
  "value that isn't visible.";

const EXTRACTION_TOOL = {
  name: "record_f1042s_extraction",
  description: "Record the fields extracted from the 1042-S document.",
  input_schema: {
    type: "object" as const,
    properties: {
      incomeCode: {
        type: "string",
        description: "Box 1: income code, e.g. '16' for scholarship/fellowship grants.",
      },
      grossIncome: {
        type: "number",
        description: "Box 2: gross income.",
      },
      exemptionCode: {
        type: ["string", "null"],
        description: "Box 3a: chapter 3 exemption code. Null if the box is blank or not exempt.",
      },
      exemptionRate: {
        type: ["number", "null"],
        description: "Box 3b: chapter 3 tax rate, e.g. 0.00 for a fully treaty-exempt amount. Null if blank.",
      },
      taxWithheld: {
        type: "number",
        description: "Box 7a: federal tax withheld.",
      },
      countryCode: {
        type: "string",
        description: "Box 12f: recipient's country code.",
      },
      withholdingCredit: {
        type: "number",
        description: "Box 10: total withholding credit.",
      },
      confidence: {
        type: "number",
        description: "Overall confidence (0-1) that every field above was read correctly.",
      },
    },
    required: [
      "incomeCode",
      "grossIncome",
      "exemptionCode",
      "exemptionRate",
      "taxWithheld",
      "countryCode",
      "withholdingCredit",
      "confidence",
    ],
    additionalProperties: false,
  },
  strict: true,
};

export async function extractF1042S(input: { f1042sBase64: string }): Promise<F1042SExtraction> {
  return withConfidenceRetry(() => runExtraction(input));
}

async function runExtraction(input: { f1042sBase64: string }): Promise<F1042SExtraction> {
  const response = await anthropic.messages.create({
    model: "claude-opus-4-8",
    max_tokens: 4096,
    thinking: { type: "adaptive" },
    system: SYSTEM_PROMPT,
    tools: [EXTRACTION_TOOL],
    tool_choice: { type: "tool", name: "record_f1042s_extraction" },
    messages: [
      {
        role: "user",
        content: [
          {
            type: "document",
            source: { type: "base64", media_type: "application/pdf", data: input.f1042sBase64 },
            title: "1042-S",
          },
          {
            type: "text",
            text: "Extract the required fields from the 1042-S document above.",
          },
        ],
      },
    ],
  });

  const toolUse = response.content.find((block) => block.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error("Claude did not return a 1042-S extraction.");
  }

  return F1042SExtractionSchema.parse(toolUse.input);
}
