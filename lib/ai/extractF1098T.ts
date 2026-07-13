import { anthropic } from "@/lib/ai/client";
import { withConfidenceRetry } from "@/lib/ai/withConfidenceRetry";
import { F1098TExtractionSchema, type F1098TExtraction } from "@/lib/extraction/schemas/f1098t";

const SYSTEM_PROMPT =
  "You extract fields from a US Form 1098-T (Tuition Statement) for an F-1 " +
  "student's tax filing. Extract only what's clearly printed in the document; " +
  "do not infer or guess a value that isn't visible.";

const EXTRACTION_TOOL = {
  name: "record_f1098t_extraction",
  description: "Record the fields extracted from the 1098-T document.",
  input_schema: {
    type: "object" as const,
    properties: {
      box1: {
        type: "number",
        description: "Box 1: payments received for qualified tuition and related expenses.",
      },
      box5: {
        type: "number",
        description: "Box 5: scholarships or grants.",
      },
      confidence: {
        type: "number",
        description: "Overall confidence (0-1) that every field above was read correctly.",
      },
    },
    required: ["box1", "box5", "confidence"],
    additionalProperties: false,
  },
  strict: true,
};

export async function extractF1098T(input: { f1098tBase64: string }): Promise<F1098TExtraction> {
  return withConfidenceRetry(() => runExtraction(input));
}

async function runExtraction(input: { f1098tBase64: string }): Promise<F1098TExtraction> {
  const response = await anthropic.messages.create({
    model: "claude-opus-4-8",
    max_tokens: 4096,
    thinking: { type: "adaptive" },
    system: SYSTEM_PROMPT,
    tools: [EXTRACTION_TOOL],
    tool_choice: { type: "tool", name: "record_f1098t_extraction" },
    messages: [
      {
        role: "user",
        content: [
          {
            type: "document",
            source: { type: "base64", media_type: "application/pdf", data: input.f1098tBase64 },
            title: "1098-T",
          },
          {
            type: "text",
            text: "Extract the required fields from the 1098-T document above.",
          },
        ],
      },
    ],
  });

  const toolUse = response.content.find((block) => block.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error("Claude did not return a 1098-T extraction.");
  }

  return F1098TExtractionSchema.parse(toolUse.input);
}
