# AWS configuration (Bedrock + AgentCore)

Reference for how this project talks to AWS. The document-extraction layer runs on
**Amazon Nova Pro (Bedrock)** and the I-20 school-contact web search runs on an
**Amazon Bedrock AgentCore Gateway** with the managed Web Search connector.

> Migration background/rationale: `NOVA_PRO_MIGRATION.md`. This file is the
> current *operational* config; that file is the historical handoff.

> ⚠️ **Secrets are NOT in this file.** All credentials live in `.env` (gitignored).
> This file lists env-var *names* and non-secret infra identifiers only. Keep this
> repo private — it contains the AWS account id and gateway ARN.

---

## 1. What runs where

| Capability | Service | Model / tool | Auth |
|---|---|---|---|
| Document extraction (W-2, 1099-INT/DIV/B/DA, i94, i20, 1042-S…) | Bedrock **Converse** | Nova Pro `us.amazon.nova-pro-v1:0` | Bedrock API key (bearer) |
| I-20 → Form 8843 school contact lookup | AgentCore **Gateway** (MCP) → **Web Search** connector, then Nova Pro extract | tool `websearch___WebSearch` | AWS **IAM / SigV4** |

Everything is **region-locked to `us-east-1`** (the Nova Pro US inference profile and
the Web Search connector are both us-east-1 only).

Provider is switchable: **`AI_PROVIDER=bedrock`** (default) or **`openai`** (rollback
to gpt-4o-mini + OpenAI web_search). See `lib/ai/bedrockConfig.ts`.

---

## 2. Environment variables (set in `.env`)

| Var | Purpose | Notes |
|---|---|---|
| `AI_PROVIDER` | `bedrock` (default) or `openai` (rollback) | read in `bedrockConfig.ts` |
| `AWS_BEARER_TOKEN_BEDROCK` | Nova Pro (Bedrock) auth — bearer token | takes precedence over IAM keys for Bedrock model calls |
| `AWS_REGION` | defaults to `us-east-1` | keep us-east-1 |
| `BEDROCK_NOVA_MODEL_ID` | optional model override | default `us.amazon.nova-pro-v1:0`; do NOT switch to Nova Lite/Micro (rejected for numeric hallucinations) |
| `AGENTCORE_GATEWAY_URL` | Gateway MCP endpoint | `https://taxbuddy-dkxeuq2jqm.gateway.bedrock-agentcore.us-east-1.amazonaws.com/mcp` |
| `AGENTCORE_WEB_SEARCH_TARGET` | tool name for `tools/call` | **`websearch___WebSearch`** — NOT `web-search` (that 404s) |
| `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` | SigV4 creds to invoke the gateway | IAM user with `bedrock-agentcore:InvokeGateway` |
| `AWS_SESSION_TOKEN` | only if using temporary/SSO creds | not needed with a permanent IAM-user key |
| `OPENAI_API_KEY` | rollback path (`AI_PROVIDER=openai`) | kept for reversible cutover |

---

## 3. Bedrock (Nova Pro) — infra facts

- **Model id:** `us.amazon.nova-pro-v1:0` (US inference profile).
- **API:** Converse, forced tool call for structured output (`toolChoice: { tool }`).
- **`maxTokens`: 9000** (Nova Pro ceiling is 10000; ≥10000 → HTTP 400).
- **Throttling:** concurrent per-page calls return HTTP 429 → `bedrockClient.ts` retries
  429/5xx with exponential backoff, and `concurrency.ts` caps per-page fan-out to 3.
- **Auth precedence:** even with `AWS_ACCESS_KEY_ID`/`SECRET` present (for AgentCore),
  Bedrock model calls still use `AWS_BEARER_TOKEN_BEDROCK` — verified, no conflict.

---

## 4. AgentCore Gateway — infra facts

- **Account:** `891376942131` · **Region:** `us-east-1`
- **Gateway id:** `taxbuddy-dkxeuq2jqm`
- **Gateway ARN:** `arn:aws:bedrock-agentcore:us-east-1:891376942131:gateway/taxbuddy-dkxeuq2jqm`
- **MCP URL:** `https://taxbuddy-dkxeuq2jqm.gateway.bedrock-agentcore.us-east-1.amazonaws.com/mcp`
- **Inbound auth:** IAM (SigV4). *(Not OAuth/JWT — the client signs with SigV4.)*
- **Gateway service role:** `AmazonBedrockAgentCoreGatewayDefaultServiceRole1784611484696`
- **Target:** MCP target named `websearch`, Web Search **connector** (`connectorId: web-search`).
- **Exposed tool:** `websearch___WebSearch` (`<target>___WebSearch` namespacing).
  Input: `query` (required, **≤200 chars**) + optional `maxResults` (1–25, default 10).
  Response: MCP `content[].text` holding a JSON string `{results:[{text,url,title,publishedDate}]}`.

### IAM policy on the invoking user
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": "bedrock-agentcore:InvokeGateway",
      "Resource": "arn:aws:bedrock-agentcore:us-east-1:891376942131:gateway/taxbuddy-dkxeuq2jqm"
    }
  ]
}
```

---

## 5. Code map

| File | Role |
|---|---|
| `lib/ai/bedrockConfig.ts` | central config — reads every env var above; `AI_PROVIDER` flag; `assert*Configured()` guards |
| `lib/ai/bedrockClient.ts` | Nova Pro Converse call, forced tool use, retry/backoff, `maxTokens` |
| `lib/ai/runMarkdownExtraction.ts` | dispatch: Bedrock (default) vs OpenAI (rollback) |
| `lib/ai/agentCoreWebSearch.ts` | SigV4-signed MCP `tools/call` to the gateway |
| `lib/ai/lookupSchoolContactInfo.ts` | school lookup = web search → Nova Pro extract (Bedrock) / OpenAI web_search (rollback) |
| `lib/ai/extractTransactionsPerPage.ts` + `lib/ai/concurrency.ts` | bounded (3) per-page fan-out for multi-page 1099s |

---

## 6. Verification scripts (`eval/`, gitignored)

Run from repo root with `npx tsx`. They make real (paid) AWS calls.

```sh
npx tsx eval/probe-agentcore.mts      # tools/list — confirm gateway auth + tool name
npx tsx eval/verify-school-lookup.mts # full I-20 lookup: AgentCore search → Nova extract
npx tsx eval/verify-i94.mts           # Nova extraction path + deterministic firstEntryDate
npx tsx eval/verify-prod-migration.mts# W-2 + 1099-INT through the production path
npx tsx eval/verify-reconcile.mts     # capital-gains reconciliation logic (no network)
```

---

## 7. Gotchas

- **Tool name is namespaced.** After any gateway/target change, re-run
  `probe-agentcore.mts` and update `AGENTCORE_WEB_SEARCH_TARGET` — the raw
  `web-search` name will 404.
- **200-char query cap** on the web search — the school-lookup query in
  `lookupSchoolContactInfo.ts` is kept short for this reason.
- **Region us-east-1 only** for both Nova Pro (US profile) and the Web Search connector.
- **Never downgrade** to Nova Lite/Micro or Llama — rejected for tax-number accuracy.
- **Web-search result quality varies** run to run; the returned address/phone are
  model-extracted from snippets and should be spot-checked, not trusted blindly.
- **Node ≥20.12** needed to run the vitest golden suite (`styleText`); `tsx` scripts
  run fine on older Node.
