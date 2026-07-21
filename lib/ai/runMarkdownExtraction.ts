import type { ZodType } from "zod";
import { openai } from "@/lib/ai/openaiClient";
import { aiProvider } from "@/lib/ai/bedrockConfig";
import { runNovaStructuredExtraction } from "@/lib/ai/bedrockClient";

export interface MarkdownDocument {
  markdown: string;
  title: string;
}

// The one extraction call shape every document type shares: forced structured
// output against a caller-supplied JSON schema, over pre-parsed markdown text,
// Zod re-validated on the way out. Dispatches to Nova Lite on Bedrock (default)
// or OpenAI gpt-4o-mini (rollback) based on AI_PROVIDER. See
// lib/ai/extractionSpecs.ts for the per-type prompt/schema and
// lib/ai/extractFromMarkdown.ts for the single dispatcher that ties them together.
export async function runMarkdownExtraction<T>(input: {
  systemPrompt: string;
  jsonSchemaName: string;
  jsonSchema: Record<string, unknown>;
  documents: MarkdownDocument[];
  instruction: string;
  schema: ZodType<T>;
}): Promise<T> {
  const documentText = input.documents
    .map((doc) => `# ${doc.title}\n\n${doc.markdown}`)
    .join("\n\n---\n\n");

  const userText = `${input.instruction}\n\n${documentText}`;

  if (aiProvider === "bedrock") {
    return runNovaStructuredExtraction({
      systemPrompt: input.systemPrompt,
      jsonSchemaName: input.jsonSchemaName,
      jsonSchema: input.jsonSchema,
      userText,
      schema: input.schema,
    });
  }

  // Rollback path: OpenAI gpt-4o-mini.
  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: input.systemPrompt },
      { role: "user", content: userText },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: input.jsonSchemaName,
        schema: input.jsonSchema,
        strict: true,
      },
    },
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error(`OpenAI did not return content for "${input.jsonSchemaName}".`);
  }

  return input.schema.parse(JSON.parse(content));
}
