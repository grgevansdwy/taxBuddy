import { anthropic } from "@/lib/ai/client";
import { withConfidenceRetry } from "@/lib/ai/withConfidenceRetry";
import { F1099BExtractionSchema, type F1099BExtraction } from "@/lib/extraction/schemas/f1099b";

const SYSTEM_PROMPT =
  "You extract fields from a US Form 1099-B (Proceeds From Broker and " +
  "Barter Exchange Transactions) for an F-1 student's tax filing. The " +
  "document may be a standalone 1099-B or one section of a broker's " +
  "consolidated 1099 that also covers interest and dividends — only report " +
  "on the 1099-B section. If there is no 1099-B section anywhere in the " +
  "document, set sectionPresent to false and leave transactions empty " +
  "rather than guessing. Extract every transaction row exactly as printed; " +
  "do not infer or guess a value that isn't visible, and do not compute " +
  "gain/loss yourself.";

const EXTRACTION_TOOL = {
  name: "record_f1099b_extraction",
  description: "Record the fields extracted from the 1099-B document.",
  input_schema: {
    type: "object" as const,
    properties: {
      sectionPresent: {
        type: "boolean",
        description: "True if a 1099-B section actually appears in the document, false if it doesn't.",
      },
      payerName: { type: "string", description: "The broker's name." },
      transactions: {
        type: "array",
        description: "Every transaction row on the document, in the order they appear.",
        items: {
          type: "object",
          properties: {
            description: { type: "string", description: "e.g. '100 sh. AAPL'." },
            dateAcquired: {
              type: ["string", "null"],
              description: "ISO yyyy-mm-dd. Null if reported as 'various' or inherited.",
            },
            dateSold: { type: "string", description: "ISO yyyy-mm-dd, box 1c." },
            proceeds: { type: "number", description: "Box 1d: proceeds." },
            costBasis: { type: "number", description: "Box 1e: cost or other basis." },
            isShortTerm: { type: "boolean", description: "Box 2: true if reported as short-term." },
            box4FederalTaxWithheld: { type: "number", description: "Box 4: federal income tax withheld." },
          },
          required: [
            "description",
            "dateAcquired",
            "dateSold",
            "proceeds",
            "costBasis",
            "isShortTerm",
            "box4FederalTaxWithheld",
          ],
          additionalProperties: false,
        },
      },
      confidence: {
        type: "number",
        description: "Overall confidence (0-1) that every field above was read correctly.",
      },
    },
    required: ["sectionPresent", "payerName", "transactions", "confidence"],
    additionalProperties: false,
  },
  strict: true,
};

export async function extractF1099B(input: { f1099bBase64: string }): Promise<F1099BExtraction> {
  return withConfidenceRetry(() => runExtraction(input));
}

async function runExtraction(input: { f1099bBase64: string }): Promise<F1099BExtraction> {
  const response = await anthropic.messages.create({
    model: "claude-opus-4-8",
    max_tokens: 4096,
    thinking: { type: "adaptive" },
    system: SYSTEM_PROMPT,
    tools: [EXTRACTION_TOOL],
    tool_choice: { type: "tool", name: "record_f1099b_extraction" },
    messages: [
      {
        role: "user",
        content: [
          {
            type: "document",
            source: { type: "base64", media_type: "application/pdf", data: input.f1099bBase64 },
            title: "1099-B",
          },
          {
            type: "text",
            text: "Extract every transaction from the 1099-B document above.",
          },
        ],
      },
    ],
  });

  const toolUse = response.content.find((block) => block.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error("Claude did not return a 1099-B extraction.");
  }

  return F1099BExtractionSchema.parse(toolUse.input);
}
