import { anthropic } from "@/lib/ai/client";
import { withConfidenceRetry } from "@/lib/ai/withConfidenceRetry";
import { I94ExtractionSchema, type I94Extraction } from "@/lib/extraction/schemas/i94";

const SYSTEM_PROMPT =
  "You extract fields from a US CBP I-94 record and travel history for an " +
  "F-1 student's tax eligibility check. Extract only what's clearly printed " +
  "in the documents; do not infer or guess a value that isn't visible.";

const EXTRACTION_TOOL = {
  name: "record_i94_extraction",
  description:
    "Record the fields extracted from the I-94 record and travel history documents.",
  input_schema: {
    type: "object" as const,
    properties: {
      visaClass: {
        type: "string",
        description: "The nonimmigrant visa/status class shown on the I-94, e.g. 'F-1'.",
      },
      firstEntryDate: {
        type: "string",
        description: "The earliest arrival date across the I-94 and travel history, as ISO yyyy-mm-dd.",
      },
      documentNumber: {
        type: "string",
        description: "The I-94 document/record number.",
      },
      travelHistory: {
        type: "array",
        description: "Every arrival/departure row from the travel history, in the order they appear.",
        items: {
          type: "object",
          properties: {
            date: { type: "string", description: "ISO yyyy-mm-dd" },
            type: { type: "string", enum: ["arrival", "departure"] },
          },
          required: ["date", "type"],
          additionalProperties: false,
        },
      },
      confidence: {
        type: "number",
        description: "Overall confidence (0-1) that every field above was read correctly.",
      },
    },
    required: ["visaClass", "firstEntryDate", "documentNumber", "travelHistory", "confidence"],
    additionalProperties: false,
  },
  strict: true,
};

export async function extractI94(input: {
  i94Base64: string;
  travelHistoryBase64: string;
}): Promise<I94Extraction> {
  return withConfidenceRetry(() => runExtraction(input));
}

async function runExtraction(input: {
  i94Base64: string;
  travelHistoryBase64: string;
}): Promise<I94Extraction> {
  const response = await anthropic.messages.create({
    model: "claude-opus-4-8",
    max_tokens: 4096,
    thinking: { type: "adaptive" },
    system: SYSTEM_PROMPT,
    tools: [EXTRACTION_TOOL],
    tool_choice: { type: "tool", name: "record_i94_extraction" },
    messages: [
      {
        role: "user",
        content: [
          {
            type: "document",
            source: { type: "base64", media_type: "application/pdf", data: input.i94Base64 },
            title: "I-94",
          },
          {
            type: "document",
            source: { type: "base64", media_type: "application/pdf", data: input.travelHistoryBase64 },
            title: "I-94 travel history",
          },
          {
            type: "text",
            text: "Extract the required fields from the I-94 record and travel history above.",
          },
        ],
      },
    ],
  });

  const toolUse = response.content.find((block) => block.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error("Claude did not return an I-94 extraction.");
  }

  return I94ExtractionSchema.parse(toolUse.input);
}
