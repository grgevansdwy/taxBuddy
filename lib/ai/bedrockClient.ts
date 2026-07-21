import {
  BedrockRuntimeClient,
  ConverseCommand,
  type Tool,
} from "@aws-sdk/client-bedrock-runtime";
import type { DocumentType } from "@smithy/types";
import type { ZodType } from "zod";
import { bedrockConfig, assertBedrockConfigured } from "@/lib/ai/bedrockConfig";

// Nova Lite on Bedrock — the gpt-4o-mini replacement for all structured
// extraction. The Converse API's forced tool use is Bedrock's way of getting
// strict JSON out of a model: we declare a single tool whose input schema IS
// the shape we want, force the model to "call" it, and read the arguments it
// filled in. Same idea as OpenAI's response_format json_schema, different
// plumbing. The caller's Zod schema still re-validates on the way out.
//
// Auth: the client picks up the Bedrock API key from the AWS_BEARER_TOKEN_BEDROCK
// env var automatically — no explicit credentials needed here.

let client: BedrockRuntimeClient | null = null;

function getClient(): BedrockRuntimeClient {
  assertBedrockConfigured();
  if (!client) {
    client = new BedrockRuntimeClient({ region: bedrockConfig.region });
  }
  return client;
}

export async function runNovaStructuredExtraction<T>(input: {
  systemPrompt: string;
  jsonSchemaName: string;
  jsonSchema: Record<string, unknown>;
  userText: string;
  schema: ZodType<T>;
}): Promise<T> {
  const tool: Tool = {
    toolSpec: {
      name: input.jsonSchemaName,
      description: "Return the extracted fields using this exact schema.",
      // Converse types the tool input schema as a smithy DocumentType; our
      // JSON Schema object is structurally a document.
      inputSchema: { json: input.jsonSchema as DocumentType },
    },
  };

  const response = await getClient().send(
    new ConverseCommand({
      modelId: bedrockConfig.novaModelId,
      system: [{ text: input.systemPrompt }],
      messages: [{ role: "user", content: [{ text: input.userText }] }],
      toolConfig: {
        tools: [tool],
        // Force the model to call our single tool, so the response is always
        // the structured object (never free text).
        toolChoice: { tool: { name: input.jsonSchemaName } },
      },
    })
  );

  const blocks = response.output?.message?.content ?? [];
  const toolUse = blocks.find((b) => "toolUse" in b)?.toolUse;
  if (!toolUse?.input) {
    throw new Error(
      `Nova did not return structured output for "${input.jsonSchemaName}".`
    );
  }

  // Converse hands back toolUse.input already parsed as an object — no JSON.parse.
  return input.schema.parse(toolUse.input);
}
