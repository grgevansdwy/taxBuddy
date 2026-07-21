# Migrating the extraction layer from gpt-4o-mini → Amazon Nova Pro (Bedrock)

Implementation handoff. Everything here was validated against this repo and a real
Bedrock account during a benchmarking session. Follow it top to bottom.

---

## 1. Decision & why (context)

We benchmarked the document-extraction pipeline (`gpt-4o-mini`) against Bedrock
alternatives on 6 real documents including a 22-page Robinhood consolidated 1099
(stocks + crypto), scoring against the documents' own IRS-printed summary totals.

| model | base-doc accuracy | hard consolidated-1099 (B / DA) | $/1k docs | verdict |
|---|---|---|---|---|
| gpt-4o-mini (current) | ~100% | not retested | $0.72 | being replaced (moving to Bedrock) |
| **Amazon Nova Pro** | 98.7% | **100% / 100% exact, 0 throttle errors** | **$4.39** | **chosen** |
| Claude Haiku 4.5 | 98.7% | 100% / 100% (but throttles on Bedrock) | $6.93 | equal-accuracy fallback |
| Llama 4 Maverick | 93.6% | **65.7%** (silently dropped stock rows) | $1.26 | rejected — unreliable |
| Nova Lite / Micro | 93–95% | — | $0.19–0.33 | rejected — numeric hallucinations |

**Chosen: Amazon Nova Pro.** It matched Haiku's perfect accuracy on the hardest
document while being cheaper, faster, and — critically — the only top model with
**zero throttling errors** on the multi-page doc. Accuracy was the priority; Nova
Pro and Haiku are tied at the top, Nova Pro wins on operational reliability + cost.

> If you ever need to switch to Haiku, it's a one-line model-id change in the
> Bedrock client (`us.anthropic.claude-haiku-4-5-20251001-v1:0`) BUT Haiku uses a
> different request/response shape (Anthropic Messages body, not Converse) — see §7.

---

## 2. What is ALREADY done in the repo (do NOT redo)

These production fixes were made during the session and are committed in
`lib/ai/extractionSpecs.ts`, `lib/ai/extractFromMarkdown.ts`:

1. **1099-INT multi-account fix** — `f1099int` prompt now sums Box 1/4/8 across a
   payer's multiple accounts (a consolidated statement listing two account numbers
   used to under-report). Verified.
2. **Deterministic `i94.firstEntryDate`** — added `postProcess` to the i94 spec +
   a `spec.postProcess?.()` call in `extractFromMarkdown.ts`. `firstEntryDate` is
   now `min(arrival dates)` computed in code, NOT by the model. Verified 5/5 stable.
3. **W-2 blank-box hardening** — `w2` prompt now says blank money boxes (1–6) = `0`,
   blank state boxes = `null`. Verified across all models.

The throwaway benchmark harness lives in `eval/` (gitignored — its outputs contain
real tax PII). You can re-run it to validate the migration (see §8).

---

## 3. Bedrock / Nova Pro reference (validated facts)

- **Auth:** Bedrock **API key** (long-lived bearer token) in env var
  `AWS_BEARER_TOKEN_BEDROCK`. Sent as HTTP header `Authorization: Bearer <token>`.
  No AWS SigV4 / access-key/secret needed. (During the eval this token lived in
  `.env.eval`; for production put it in `.env`.)
- **Region:** `us-east-1` (confirmed working for this account/key).
- **Model id:** `us.amazon.nova-pro-v1:0` (US inference profile).
- **API:** Bedrock **Converse** (not InvokeModel). Endpoint:
  `https://bedrock-runtime.us-east-1.amazonaws.com/model/{encodeURIComponent(modelId)}/converse`
- **Structured output:** forced tool call. Put the existing JSON Schema in a
  `toolSpec.inputSchema.json`, force it with `toolChoice: { tool: { name } }`.
  Nova Pro supports forced tool choice. The model's answer is the `toolUse.input`
  object. Union types like `["string","null"]` are accepted.
- **`maxTokens` limit: 10000.** Use **9000** (headroom). This was enough for the
  densest transaction page in the Robinhood test. Do NOT request ≥10000 → HTTP 400.
- **Throttling:** firing many per-page requests concurrently returns HTTP 429
  ("Too many requests"). Mitigate with bounded concurrency + exponential backoff
  (both provided below). Nova Pro tolerated concurrency 2–3 cleanly.
- **Usage:** response `usage.inputTokens` / `usage.outputTokens`.
- **Pricing (approx, Bedrock on-demand):** $0.80 / $3.20 per 1M in/out tokens.

### Converse request/response shape (reference)

```jsonc
// POST body
{
  "system": [{ "text": "<system prompt>" }],
  "messages": [{ "role": "user", "content": [{ "text": "<instruction + document>" }] }],
  "inferenceConfig": { "maxTokens": 9000 },
  "toolConfig": {
    "tools": [{ "toolSpec": {
      "name": "record_w2_extraction",
      "description": "Return the extracted fields as a single structured object.",
      "inputSchema": { "json": { /* the existing spec.jsonSchema */ } }
    }}],
    "toolChoice": { "tool": { "name": "record_w2_extraction" } }
  }
}
// 200 response → output.message.content[] contains a { "toolUse": { "input": {...} } } block
// usage → { "inputTokens": N, "outputTokens": M }
```

---

## 4. Implementation — file by file

Signatures of `runMarkdownExtraction()` and `lookupSchoolContactInfo()` MUST stay
identical so their callers (`extractFromMarkdown.ts`, the extract routes) don't change.

### 4.1 NEW `lib/ai/bedrockClient.ts` — Nova Pro structured-output helper (with retry)

```ts
// One place for all Bedrock (Nova Pro) structured-output calls. Uses the Converse
// API with a forced tool call so the model must return an object matching the given
// JSON Schema. Retries on throttling / 5xx with exponential backoff.
const REGION = process.env.AWS_REGION ?? "us-east-1";
export const NOVA_PRO = "us.amazon.nova-pro-v1:0";

export async function bedrockStructured(input: {
  systemPrompt: string;
  toolName: string;                       // becomes the tool name; pass spec.jsonSchemaName
  jsonSchema: Record<string, unknown>;    // pass spec.jsonSchema unchanged
  userText: string;                       // instruction + document text
  maxTokens?: number;                     // default 9000 (Nova Pro limit is 10000)
  modelId?: string;                       // default Nova Pro
}): Promise<unknown> {
  const token = process.env.AWS_BEARER_TOKEN_BEDROCK;
  if (!token) throw new Error("AWS_BEARER_TOKEN_BEDROCK is not set.");

  const modelId = input.modelId ?? NOVA_PRO;
  const url = `https://bedrock-runtime.${REGION}.amazonaws.com/model/${encodeURIComponent(modelId)}/converse`;
  const body = {
    system: [{ text: input.systemPrompt }],
    messages: [{ role: "user", content: [{ text: input.userText }] }],
    inferenceConfig: { maxTokens: input.maxTokens ?? 9000 },
    toolConfig: {
      tools: [{ toolSpec: {
        name: input.toolName,
        description: "Return the extracted fields as a single structured object.",
        inputSchema: { json: input.jsonSchema },
      }}],
      toolChoice: { tool: { name: input.toolName } },
    },
  };

  // Up to 5 attempts; back off on 429 (throttling) and 5xx.
  let lastErr = "";
  for (let attempt = 0; attempt < 5; attempt++) {
    const res = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      const json = await res.json();
      const toolUse = (json.output?.message?.content ?? []).find((b: { toolUse?: unknown }) => b.toolUse)?.toolUse;
      if (!toolUse) throw new Error(`Bedrock returned no tool call (stop=${json.stopReason}).`);
      return toolUse.input;
    }
    lastErr = `${res.status}: ${(await res.text()).slice(0, 200)}`;
    if (res.status !== 429 && res.status < 500) break; // 400/403/404 won't fix on retry
    await new Promise((r) => setTimeout(r, 700 * (attempt + 1) * (attempt + 1) + Math.random() * 400));
  }
  throw new Error(`Bedrock ${modelId} failed (${lastErr}).`);
}
```

### 4.2 REWRITE `lib/ai/runMarkdownExtraction.ts`

Keep the `MarkdownDocument` interface and the exported signature exactly. Only the
LLM call changes (OpenAI chat.completions → `bedrockStructured`). Zod validation stays.

```ts
import type { ZodType } from "zod";
import { bedrockStructured } from "@/lib/ai/bedrockClient";

export interface MarkdownDocument {
  markdown: string;
  title: string;
}

// Same contract as before: forced structured output against a caller-supplied JSON
// schema over pre-parsed markdown, Zod re-validated on the way out. Now runs on
// Amazon Nova Pro via Bedrock (Converse + forced tool call) instead of gpt-4o-mini.
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

  const raw = await bedrockStructured({
    systemPrompt: input.systemPrompt,
    toolName: input.jsonSchemaName,
    jsonSchema: input.jsonSchema,
    userText: `${input.instruction}\n\n${documentText}`,
    maxTokens: 9000,
  });

  return input.schema.parse(raw);
}
```

Nothing downstream changes — `extractFromMarkdown.ts` and all
`app/api/documents/extract/*` routes keep working, including the `postProcess`
(i94) and the multi-account 1099-INT summing already in the specs.

### 4.3 Web search — REWRITE `lib/ai/lookupSchoolContactInfo.ts` (+ new `webSearch.ts`)

`gpt-4o-mini` did web search via OpenAI's built-in `web_search` tool (Responses
API). **Bedrock/Nova Pro has no server-side web search.** Replace it with:
external search API → feed results to Nova Pro → structured extraction. This is a
one-shot "search then extract", which is more deterministic and reliable than an
agentic loop (matches our accuracy-first goal).

**Pick a search provider.** Recommended: **Tavily** (built for LLMs, clean
snippets, simple REST, free tier). Alternatives: Brave Search API, Serper.dev,
Bing. Below uses Tavily; env var `TAVILY_API_KEY`.

NEW `lib/ai/webSearch.ts`:

```ts
// Thin wrapper over a web-search provider (Tavily). Returns clean text snippets
// for the model to read. Swap the provider here without touching callers.
export interface WebSearchResult {
  title: string;
  url: string;
  content: string;
}

export async function webSearch(query: string, opts?: { maxResults?: number }): Promise<WebSearchResult[]> {
  const key = process.env.TAVILY_API_KEY;
  if (!key) throw new Error("TAVILY_API_KEY is not set.");

  const res = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: key,
      query,
      max_results: opts?.maxResults ?? 6,
      search_depth: "basic",
    }),
  });
  if (!res.ok) throw new Error(`Tavily search failed (${res.status}): ${await res.text()}`);

  const json = (await res.json()) as { results?: { title: string; url: string; content: string }[] };
  return (json.results ?? []).map((r) => ({ title: r.title, url: r.url, content: r.content }));
}
```

REWRITE `lib/ai/lookupSchoolContactInfo.ts` (schema + exported signature unchanged):

```ts
import { z } from "zod";
import { bedrockStructured } from "@/lib/ai/bedrockClient";
import { webSearch } from "@/lib/ai/webSearch";

const SchoolContactLookupSchema = z.object({
  address: z.string(),
  phone: z.string(),
  dsoPhone: z.string(),
});
export type SchoolContactLookup = z.infer<typeof SchoolContactLookupSchema>;

const SCHOOL_CONTACT_SCHEMA = {
  type: "object",
  properties: {
    address: { type: "string", description: "Institution's official mailing address — street/building/box number, street, city, state, ZIP only. No institution name or campus disambiguator." },
    phone: { type: "string", description: "Institution's general phone number." },
    dsoPhone: { type: "string", description: "International student/programs office phone number." },
  },
  required: ["address", "phone", "dsoPhone"],
  additionalProperties: false,
} as const;

export async function lookupSchoolContactInfo(args: {
  schoolName: string;
  dsoName: string;
}): Promise<SchoolContactLookup> {
  // 1. Live web search for the facts the I-20 doesn't print (Form 8843 lines 9/10).
  const results = await webSearch(
    `${args.schoolName} international student office mailing address phone number registrar contact`,
    { maxResults: 6 },
  );
  const context = results
    .map((r, i) => `[${i + 1}] ${r.title}\n${r.url}\n${r.content}`)
    .join("\n\n");

  // 2. Nova Pro reads the results and returns the structured fields.
  const raw = await bedrockStructured({
    systemPrompt:
      "You extract publicly available US institution contact info for Form 8843 " +
      "from web search results. Use only facts supported by the results; return an " +
      "empty string for anything not clearly found. Do not guess.",
    toolName: "school_contact_lookup",
    jsonSchema: SCHOOL_CONTACT_SCHEMA,
    userText:
      `Institution: "${args.schoolName}"\n` +
      `Designated School Official (works in the international office): "${args.dsoName}"\n\n` +
      `Extract:\n` +
      `1. address — the institution's official mailing address (street/building/box number, street, city, state, ZIP ONLY; no institution name or campus disambiguator).\n` +
      `2. phone — the institution's general phone number.\n` +
      `3. dsoPhone — the phone number for the international student / programs office.\n` +
      `Return an empty string for any value not found.\n\n` +
      `Web search results:\n${context}`,
    maxTokens: 1000,
  });

  return SchoolContactLookupSchema.parse(raw);
}
```

Callers (`app/api/documents/extract/i20/route.ts`,
`app/api/dev/extract-preview/route.ts`) are unchanged — same signature, same
`SchoolContactLookup` return type.

### 4.4 Production robustness — bound concurrency on the per-page merge

`app/api/check/extract/route.ts` currently fans out with `Promise.all(pages.map(...))`
for `f1099b` / `f1099da`. On a 22-page consolidated 1099 that throttled every model
in testing (and a page whose retries all fail = silently dropped transactions). The
retry in `bedrockStructured` (§4.1) is the safety net; also cap concurrency.

NEW `lib/ai/concurrency.ts`:

```ts
// Bounded-concurrency map — avoids hammering Bedrock with N simultaneous requests
// (which returns HTTP 429). Preserves input order.
export async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const out = new Array<R>(items.length);
  let idx = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (idx < items.length) {
        const i = idx++;
        out[i] = await fn(items[i], i);
      }
    }),
  );
  return out;
}
```

In `app/api/check/extract/route.ts`, replace the two per-page `Promise.all(pages.map(...))`
calls (for `f1099b` and `f1099da`) with `mapWithConcurrency(pages, 3, (md) => extractFromMarkdown(...))`.
Keep the outer `Promise.all([intResult, divResult, bPages, daPages])` — but be aware
INT+DIV+B+DA run at once, so effective concurrency is ~3 (B) + 3 (DA) + 2. That's
fine for Nova Pro with the backoff net; lower the limit to 2 if you still see 429s.

---

## 5. Environment variables

Add to `.env` (production) — the Bedrock token currently only lives in `.env.eval`:

```
AWS_BEARER_TOKEN_BEDROCK=<the Bedrock API key>   # move/copy from .env.eval
AWS_REGION=us-east-1                              # optional; defaults to us-east-1
TAVILY_API_KEY=<sign up at tavily.com>           # for web search (or your provider)
```

`.env*` is already gitignored. `OPENAI_API_KEY` can be removed once cutover is
verified (or kept if you implement the optional fallback in §7).

---

## 6. Rollout order

1. Add `bedrockClient.ts`, `webSearch.ts`, `concurrency.ts`; set env vars.
2. Rewrite `runMarkdownExtraction.ts` → verify extraction on the 5 base docs (§8).
3. Rewrite `lookupSchoolContactInfo.ts` + provider key → verify the i20 route
   returns non-empty `address`/`phone`/`dsoPhone`.
4. Bound concurrency in `check/extract/route.ts` → verify a multi-page consolidated
   1099 doesn't 429 and returns complete transactions.
5. Remove the `openai` dependency + `openaiClient.ts` (or keep for fallback, §7).

---

## 7. Optional: provider flag (safe rollback) & Haiku fallback

For a reversible cutover, gate the provider behind `LLM_PROVIDER` (`bedrock` default,
`openai` to revert). In `runMarkdownExtraction.ts` and `lookupSchoolContactInfo.ts`,
branch on `process.env.LLM_PROVIDER`. Keep `openaiClient.ts` and the old call bodies
until you're confident, then delete.

To use **Haiku 4.5** instead of Nova Pro (equal accuracy, different wire format):
Haiku uses the Anthropic Messages body on the **InvokeModel** endpoint
(`/model/{id}/invoke`), not Converse. Body: `{ anthropic_version: "bedrock-2023-05-31",
max_tokens, system, tools:[{name,description,input_schema}], tool_choice:{type:"tool",
name}, messages:[{role:"user",content}] }`; answer is `content[].type==="tool_use"`→
`.input`; `max_tokens` can be higher (e.g. 16000). Add a second branch in
`bedrockClient.ts` for `modelId.includes("anthropic")`. Reference impl is in
`eval/lib/runners.mts` (`runBedrockClaude`).

---

## 8. Testing / verification

The `eval/` harness (gitignored) is the fastest way to sanity-check. It uses the
real specs and cached markdown of the 6 test docs. Useful commands from repo root:

```sh
# Re-verify the deterministic firstEntryDate through the REAL pipeline:
npx tsx eval/verify-i94.mts        # expect firstEntryDate=2018-06-06 every run

# Re-run the Robinhood transaction accuracy test (Nova Pro should be 100% B & DA):
npx tsx eval/bench-robinhood.mts   # 1099-B $64,393.51 and 1099-DA $4,734.51 exact
```

To test the **production** code path (not the eval runners) after rewriting
`runMarkdownExtraction.ts`, write a tiny script that calls
`extractFromMarkdown("w2", [{ title: "W-2", markdown }])` on `eval/cache/w2.md` and
check the boxes, or exercise the actual routes with the PDFs in `/Users/.../Desktop/tax`.

Ground-truth values for the test docs (for assertions):
- **W-2:** box1 `11914.80`, box2 `1296.68`, box3–6 `0`, box15State `IL`, box17 `507.64`,
  employer `UNIVERSITY OF ILLINOIS`, address `UNIVERSITY PAYROLL & BENEFITS`.
- **1099-INT Goldman:** box1 `7118.29` (two accounts summed). **Chase:** box1 `9621.08`, box4 `1298.15`.
- **i20:** earliestAdmissionDate `2023-07-15`, DSO `Beth Anne Clayton`.
- **i94:** firstEntryDate `2018-06-06` (computed in code).
- **Robinhood 1099-B:** proceeds `64393.51`, basis `62876.31`, wash `477.92`.
- **Robinhood 1099-DA (crypto):** proceeds `4734.51`, basis `4499.71`.

---

## 9. Open items / caveats

- **Nova Pro `maxTokens` = 9000** is enough for the densest test page, but a single
  page with an unusually huge transaction table could still truncate. If you ever
  see a page return fewer rows than expected, that page likely hit the token cap —
  the per-page split already mitigates this; splitting further is the escape hatch.
- **Web search quality depends on the provider.** Tavily/Brave return snippets, not
  full pages; if `dsoPhone` comes back empty often, increase `maxResults` or add a
  second targeted query (e.g. `"${schoolName}" international student services phone`).
- **Cost:** ~$4.39 per 1,000 documents on Nova Pro (vs $0.72 on gpt-4o-mini). Web
  search adds the provider's per-query cost. Accuracy was the deciding factor.
- **Do not use** Llama 4 Maverick/Scout, Nova Lite/Micro, Llama 3.1, or Mistral
  Small for this — all failed the accuracy/reliability bar in testing (details in §1).
```
