import {
  BedrockRuntimeClient,
  ConverseCommand,
  type Tool,
} from "@aws-sdk/client-bedrock-runtime";
import type { DocumentType } from "@smithy/types";
import type { ZodType } from "zod";
import { bedrockConfig, assertBedrockConfigured } from "@/lib/ai/bedrockConfig";

// Amazon Nova Pro on Bedrock — the gpt-4o-mini replacement for all structured
// extraction. The Converse API's forced tool use is Bedrock's way of getting
// strict JSON out of a model: we declare a single tool whose input schema IS
// the shape we want, force the model to "call" it, and read the arguments it
// filled in. Same idea as OpenAI's response_format json_schema, different
// plumbing. The caller's Zod schema still re-validates on the way out.
//
// Auth: the client picks up the Bedrock API key from the AWS_BEARER_TOKEN_BEDROCK
// env var automatically — no explicit credentials needed here.

// Nova Pro's Converse maxTokens ceiling is 10000 (>= 10000 → HTTP 400); 9000
// leaves headroom and was enough for the densest transaction page in testing
// (NOVA_PRO_MIGRATION.md §3).
const MAX_TOKENS = 9000;
// Firing many per-page requests concurrently returns HTTP 429; retry throttling
// and 5xx with exponential backoff so a transient throttle never silently drops
// a page's transactions (NOVA_PRO_MIGRATION.md §4.1).
const MAX_ATTEMPTS = 5;

function isRetryableError(err: unknown): boolean {
  const e = err as { name?: string; $metadata?: { httpStatusCode?: number } };
  const status = e?.$metadata?.httpStatusCode;
  if (status === 429 || (typeof status === "number" && status >= 500)) return true;
  return (
    e?.name === "ThrottlingException" ||
    e?.name === "TooManyRequestsException" ||
    e?.name === "ServiceUnavailableException" ||
    e?.name === "InternalServerException" ||
    e?.name === "ModelTimeoutException"
  );
}

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

  const command = new ConverseCommand({
    modelId: bedrockConfig.novaModelId,
    system: [{ text: input.systemPrompt }],
    messages: [{ role: "user", content: [{ text: input.userText }] }],
    inferenceConfig: { maxTokens: MAX_TOKENS },
    toolConfig: {
      tools: [tool],
      // Force the model to call our single tool, so the response is always
      // the structured object (never free text).
      toolChoice: { tool: { name: input.jsonSchemaName } },
    },
  });

  let lastError: unknown;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    try {
      const response = await getClient().send(command);

      const blocks = response.output?.message?.content ?? [];
      const toolUse = blocks.find((b) => "toolUse" in b)?.toolUse;
      if (!toolUse?.input) {
        throw new Error(
          `Nova did not return structured output for "${input.jsonSchemaName}".`
        );
      }

      // Converse hands back toolUse.input already parsed as an object — no JSON.parse.
      return input.schema.parse(toolUse.input);
    } catch (err) {
      lastError = err;
      // Only throttling / 5xx are worth retrying; schema, 4xx, and validation
      // errors won't fix themselves on a retry, so fail fast.
      if (!isRetryableError(err) || attempt === MAX_ATTEMPTS - 1) throw err;
      const backoffMs = 700 * (attempt + 1) * (attempt + 1) + Math.random() * 400;
      await new Promise((r) => setTimeout(r, backoffMs));
    }
  }
  // Unreachable (the loop either returns or throws), but satisfies the compiler.
  throw lastError;
}
