import { anthropic } from "@/lib/ai/client";
import { withConfidenceRetry } from "@/lib/ai/withConfidenceRetry";
import { I20ExtractionSchema, type I20Extraction } from "@/lib/extraction/schemas/i20";

const SYSTEM_PROMPT =
  "You extract fields from a US Form I-20 (Certificate of Eligibility for " +
  "Nonimmigrant Student Status) for an F-1 student's tax filing. Extract " +
  "only what's clearly printed in the document; do not infer or guess a " +
  "value that isn't visible.";

const EXTRACTION_TOOL = {
  name: "record_i20_extraction",
  description: "Record the fields extracted from the I-20 document.",
  input_schema: {
    type: "object" as const,
    properties: {
      schoolName: {
        type: "string",
        description: "The school/institution name shown on the I-20.",
      },
      schoolAddress: {
        type: "string",
        description: "The school's mailing address as printed on the I-20.",
      },
      schoolPhone: {
        type: "string",
        description: "The school's phone number as printed on the I-20.",
      },
      dsoName: {
        type: "string",
        description: "The name of the Designated School Official who signed the I-20.",
      },
      sevisId: {
        type: "string",
        description: "The SEVIS ID number, e.g. 'N0012345678'.",
      },
      confidence: {
        type: "number",
        description: "Overall confidence (0-1) that every field above was read correctly.",
      },
    },
    required: ["schoolName", "schoolAddress", "schoolPhone", "dsoName", "sevisId", "confidence"],
    additionalProperties: false,
  },
  strict: true,
};

export async function extractI20(input: { i20Base64: string }): Promise<I20Extraction> {
  return withConfidenceRetry(() => runExtraction(input));
}

async function runExtraction(input: { i20Base64: string }): Promise<I20Extraction> {
  const response = await anthropic.messages.create({
    model: "claude-opus-4-8",
    max_tokens: 4096,
    thinking: { type: "adaptive" },
    system: SYSTEM_PROMPT,
    tools: [EXTRACTION_TOOL],
    tool_choice: { type: "tool", name: "record_i20_extraction" },
    messages: [
      {
        role: "user",
        content: [
          {
            type: "document",
            source: { type: "base64", media_type: "application/pdf", data: input.i20Base64 },
            title: "I-20",
          },
          {
            type: "text",
            text: "Extract the required fields from the I-20 document above.",
          },
        ],
      },
    ],
  });

  const toolUse = response.content.find((block) => block.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error("Claude did not return an I-20 extraction.");
  }

  return I20ExtractionSchema.parse(toolUse.input);
}
