// Central config for the Bedrock migration. Every AI call site reads from
// here instead of touching process.env directly, so the cutover (and the
// eventual removal of OpenAI) is a single-file concern.
//
// Nothing here creates a client or makes a network call — it only reads env —
// so it compiles and imports fine before the credentials are filled in.

export type AiProvider = "bedrock" | "openai";

// Default is OpenAI (gpt-4o-mini). Set AI_PROVIDER=bedrock to opt into Nova Pro
// once the Bedrock credentials are configured in the target environment.
export const aiProvider: AiProvider =
  process.env.AI_PROVIDER === "bedrock" ? "bedrock" : "openai";

export const bedrockConfig = {
  region: process.env.AWS_REGION ?? "us-east-1",
  // Amazon Nova Pro (US inference profile) — the chosen gpt-4o-mini replacement
  // for all structured extraction. Nova Pro matched Claude Haiku's top accuracy
  // on the hardest consolidated-1099 test with zero throttling; Nova Lite/Micro
  // were rejected for numeric hallucinations on tax figures (see
  // NOVA_PRO_MIGRATION.md §1). To fall back to Haiku, see §7 — it needs a
  // different (InvokeModel/Messages) wire format, not just a model-id swap.
  novaModelId: process.env.BEDROCK_NOVA_MODEL_ID ?? "us.amazon.nova-pro-v1:0",
  // Bedrock API key (bearer token) used for model inference.
  bearerToken: process.env.AWS_BEARER_TOKEN_BEDROCK ?? "",
} as const;

// Human-readable "who is actually answering" label for the admin dashboard, so
// the deployed provider/model can be confirmed without shelling into the env.
// The Bedrock half is derived from the configured model id rather than hardcoded,
// because BEDROCK_NOVA_MODEL_ID can be pointed at Haiku (see §7 above).
export function activeModelLabel(): string {
  if (aiProvider === "openai") return "OpenAI + gpt-4o-mini";

  const id = bedrockConfig.novaModelId.toLowerCase();
  if (id.includes("haiku")) return "Bedrock + Claude Haiku";
  if (id.includes("nova")) return "Bedrock + Nova Pro";
  // Unrecognised id — show it verbatim rather than mislabelling it.
  return `Bedrock + ${bedrockConfig.novaModelId}`;
}

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
      "AWS_BEARER_TOKEN_BEDROCK is not set — needed for Nova Pro model calls."
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
