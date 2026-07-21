import { SignatureV4 } from "@aws-sdk/signature-v4";
import { Sha256 } from "@aws-crypto/sha256-js";
import { HttpRequest } from "@smithy/protocol-http";
import { agentCoreConfig, assertAgentCoreConfigured } from "@/lib/ai/bedrockConfig";

// AgentCore Web Search — Amazon's own web index, reached through the AgentCore
// Gateway over MCP (JSON-RPC). Unlike Nova model calls, this authenticates with
// IAM (SigV4) on the `bedrock-agentcore` service, not the Bedrock bearer token.
//
// ⚠️ CONFIRM AGAINST THE LIVE GATEWAY once it exists — three things depend on
// how your gateway is provisioned and can't be verified until then:
//   1. TOOL NAME: the web-search target may be exposed as "web-search" (the
//      value in AGENTCORE_WEB_SEARCH_TARGET) or a namespaced name like
//      "<target>___search". If tools/call 404s, list tools first (tools/list)
//      and use the exact name it returns.
//   2. ARGUMENTS: the search tool's input field is assumed to be `query`.
//   3. RESPONSE: assumed MCP result.content[] with text blocks. We concatenate
//      all text back and let Nova extract from it, so exact JSON structure is
//      forgiving — but if results come back empty, log the raw body and adjust.
// Docs: https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/gateway-target-connector-web-search-tool.html

const SERVICE = "bedrock-agentcore";

async function sigV4Post(payload: unknown): Promise<string> {
  assertAgentCoreConfigured();

  const url = new URL(agentCoreConfig.gatewayUrl);
  const signer = new SignatureV4({
    service: SERVICE,
    region: agentCoreConfig.region,
    credentials: {
      accessKeyId: agentCoreConfig.accessKeyId,
      secretAccessKey: agentCoreConfig.secretAccessKey,
    },
    sha256: Sha256,
  });

  const request = new HttpRequest({
    method: "POST",
    protocol: url.protocol,
    hostname: url.hostname,
    path: url.pathname,
    headers: {
      host: url.hostname,
      "content-type": "application/json",
      // MCP streamable-HTTP transport can answer with either JSON or SSE.
      accept: "application/json, text/event-stream",
    },
    body: JSON.stringify(payload),
  });

  const signed = await signer.sign(request);
  const res = await fetch(url.toString(), {
    method: "POST",
    headers: signed.headers as Record<string, string>,
    body: signed.body as string,
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`AgentCore Gateway ${res.status}: ${text.slice(0, 500)}`);
  }
  return text;
}

// MCP streamable HTTP may return a raw JSON body or an SSE stream of
// `data: {...}` lines. Pull the JSON-RPC result object out of either.
function parseMcpBody(body: string): unknown {
  const trimmed = body.trim();
  if (trimmed.startsWith("{")) return JSON.parse(trimmed);

  // SSE: take the last non-empty `data:` payload.
  const dataLines = trimmed
    .split("\n")
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice("data:".length).trim())
    .filter(Boolean);
  const last = dataLines[dataLines.length - 1];
  if (!last) throw new Error("AgentCore Gateway returned no parseable body.");
  return JSON.parse(last);
}

// Flatten whatever the tool returned into a single text blob for Nova to read.
function resultToText(parsed: unknown): string {
  const content = (parsed as { result?: { content?: unknown[] } })?.result?.content;
  if (!Array.isArray(content)) return JSON.stringify(parsed);
  return content
    .map((block) => {
      const b = block as { type?: string; text?: string };
      if (b.type === "text" && typeof b.text === "string") return b.text;
      return JSON.stringify(block);
    })
    .join("\n\n");
}

// Run a web search and return the results as text (titles, snippets, URLs).
export async function agentCoreWebSearch(query: string): Promise<string> {
  const payload = {
    jsonrpc: "2.0",
    id: 1,
    method: "tools/call",
    params: {
      name: agentCoreConfig.webSearchTarget, // see CONFIRM note (1)
      arguments: { query }, // see CONFIRM note (2)
    },
  };

  const body = await sigV4Post(payload);
  return resultToText(parseMcpBody(body)); // see CONFIRM note (3)
}
