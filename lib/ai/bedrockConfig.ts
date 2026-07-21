// Central config for the Bedrock migration. Every AI call site reads from
// here instead of touching process.env directly, so the cutover (and the
// eventual removal of OpenAI) is a single-file concern.
//
// Nothing here creates a client or makes a network call — it only reads env —
// so it compiles and imports fine before the credentials are filled in.

export type AiProvider = "bedrock" | "openai";

export const aiProvider: AiProvider =
  process.env.AI_PROVIDER === "openai" ? "openai" : "bedrock";

export const bedrockConfig = {
  region: process.env.AWS_REGION ?? "us-east-1",
  // Nova Lite — the gpt-4o-mini-tier model that runs all extraction.
  novaModelId: process.env.BEDROCK_NOVA_MODEL_ID ?? "amazon.nova-lite-v1:0",
  // Bedrock API key (bearer token) used for model inference.
  bearerToken: process.env.AWS_BEARER_TOKEN_BEDROCK ?? "",
} as const;

// AgentCore Web Search — used only by the school-contact lookup. Authenticates
// with IAM (SigV4), NOT the Bedrock bearer token.
export const agentCoreConfig = {
  region: process.env.AWS_REGION ?? "us-east-1",
  gatewayUrl: process.env.AGENTCORE_GATEWAY_URL ?? "",
  webSearchTarget: process.env.AGENTCORE_WEB_SEARCH_TARGET ?? "web-search",
  accessKeyId: process.env.AWS_ACCESS_KEY_ID ?? "",
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? "",
} as const;

// Throw early (at call time) with a clear message if a required value is still
// blank, rather than failing deep inside the AWS SDK with an opaque error.
export function assertBedrockConfigured(): void {
  if (!bedrockConfig.bearerToken) {
    throw new Error(
      "AWS_BEARER_TOKEN_BEDROCK is not set — needed for Nova Lite model calls."
    );
  }
}

export function assertAgentCoreConfigured(): void {
  const missing: string[] = [];
  if (!agentCoreConfig.gatewayUrl) missing.push("AGENTCORE_GATEWAY_URL");
  if (!agentCoreConfig.accessKeyId) missing.push("AWS_ACCESS_KEY_ID");
  if (!agentCoreConfig.secretAccessKey) missing.push("AWS_SECRET_ACCESS_KEY");
  if (missing.length > 0) {
    throw new Error(
      `AgentCore Web Search not configured — missing: ${missing.join(", ")}.`
    );
  }
}
