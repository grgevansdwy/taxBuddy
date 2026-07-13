import { anthropic } from "@/lib/ai/client";
import { withConfidenceRetry } from "@/lib/ai/withConfidenceRetry";
import { F1099IntExtractionSchema, type F1099IntExtraction } from "@/lib/extraction/schemas/f1099int";

const SYSTEM_PROMPT =
  "You extract fields from a US Form 1099-INT (Interest Income) for an F-1 " +
  "student's tax filing. The document may be a standalone 1099-INT or one " +
  "section of a broker's consolidated 1099 that also covers dividends and " +
  "broker transactions — only report on the 1099-INT section. If there is " +
  "no 1099-INT section anywhere in the document, set sectionPresent to " +
  "false and leave the other fields as 0/empty rather than guessing. " +
  "Extract only what's clearly printed; do not infer or guess a value that " +
  "isn't visible.";

const EXTRACTION_TOOL = {
  name: "record_f1099int_extraction",
  description: "Record the fields extracted from the 1099-INT document.",
  input_schema: {
    type: "object" as const,
    properties: {
      sectionPresent: {
        type: "boolean",
        description: "True if a 1099-INT section actually appears in the document, false if it doesn't.",
      },
      payerName: { type: "string", description: "The payer's (bank's) name." },
      payerEin: { type: "string", description: "The payer's federal ID number (EIN)." },
      box1InterestIncome: { type: "number", description: "Box 1: interest income." },
      box4FederalTaxWithheld: { type: "number", description: "Box 4: federal income tax withheld." },
      box8TaxExemptInterest: { type: "number", description: "Box 8: tax-exempt interest." },
      confidence: {
        type: "number",
        description: "Overall confidence (0-1) that every field above was read correctly.",
      },
    },
    required: [
      "sectionPresent",
      "payerName",
      "payerEin",
      "box1InterestIncome",
      "box4FederalTaxWithheld",
      "box8TaxExemptInterest",
      "confidence",
    ],
    additionalProperties: false,
  },
  strict: true,
};

export async function extractF1099Int(input: { f1099intBase64: string }): Promise<F1099IntExtraction> {
  return withConfidenceRetry(() => runExtraction(input));
}

async function runExtraction(input: { f1099intBase64: string }): Promise<F1099IntExtraction> {
  const response = await anthropic.messages.create({
    model: "claude-opus-4-8",
    max_tokens: 4096,
    thinking: { type: "adaptive" },
    system: SYSTEM_PROMPT,
    tools: [EXTRACTION_TOOL],
    tool_choice: { type: "tool", name: "record_f1099int_extraction" },
    messages: [
      {
        role: "user",
        content: [
          {
            type: "document",
            source: { type: "base64", media_type: "application/pdf", data: input.f1099intBase64 },
            title: "1099-INT",
          },
          {
            type: "text",
            text: "Extract the required fields from the 1099-INT document above.",
          },
        ],
      },
    ],
  });

  const toolUse = response.content.find((block) => block.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error("Claude did not return a 1099-INT extraction.");
  }

  return F1099IntExtractionSchema.parse(toolUse.input);
}
