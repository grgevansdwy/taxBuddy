import { z } from "zod";
import { openai } from "@/lib/ai/openaiClient";
import { aiProvider } from "@/lib/ai/bedrockConfig";
import { agentCoreWebSearch } from "@/lib/ai/agentCoreWebSearch";
import { runNovaStructuredExtraction } from "@/lib/ai/bedrockClient";

// The I-20 only prints the institution name, DSO name, and the international
// student office's address (see lib/extraction/schemas/i20.ts). Form 8843
// lines 9/10 also need the institution's own mailing address/phone and the
// international office's phone number — none of which are on the I-20 — so this
// looks them up via live web search. Dispatches to OpenAI's web_search tool
// (default) or AgentCore Web Search + Nova on Bedrock (AI_PROVIDER=bedrock).
const SchoolContactLookupSchema = z.object({
  address: z.string(),
  phone: z.string(),
  dsoPhone: z.string(),
});

export type SchoolContactLookup = z.infer<typeof SchoolContactLookupSchema>;

const CONTACT_JSON_SCHEMA = {
  type: "object",
  properties: {
    address: {
      type: "string",
      description:
        "Institution's official mailing address — street/building/box number, street, city, state, ZIP only. No institution name or campus disambiguator.",
    },
    phone: { type: "string", description: "Institution's general phone number." },
    dsoPhone: { type: "string", description: "International student/programs office phone number." },
  },
  required: ["address", "phone", "dsoPhone"],
  additionalProperties: false,
} as const;

function buildInstruction(args: { schoolName: string; dsoName: string }): string {
  return (
    `Find this publicly available contact information for "${args.schoolName}", using the school's ` +
    `official website:\n` +
    `1. The institution's official mailing address (main campus or registrar address) — street/building/box ` +
    `number, street name, city, state, and ZIP ONLY. Do not include the institution's name or any campus ` +
    `disambiguator (e.g. "- Seattle") in this field; it's printed separately.\n` +
    `2. The institution's general phone number.\n` +
    `3. The phone number for the international student office / international programs office — the ` +
    `office that issues Form I-20s and where the Designated School Official "${args.dsoName}" works.\n\n` +
    `If a value truly can't be found, return an empty string for it rather than guessing.`
  );
}

export async function lookupSchoolContactInfo(args: {
  schoolName: string;
  dsoName: string;
}): Promise<SchoolContactLookup> {
  const instruction = buildInstruction(args);

  if (aiProvider === "bedrock") {
    // 1. Search Amazon's web index for the school's contact details.
    // Keep the query under the Web Search tool's 200-char cap even for long
    // institution names (over the cap → HTTP 400 from the gateway).
    const searchResults = await agentCoreWebSearch(
      `${args.schoolName} mailing address, general and international student office phone`
    );

    // 2. Extract the three fields from the search results with Nova.
    return runNovaStructuredExtraction({
      systemPrompt:
        "You extract institutional contact details from web search results. " +
        "Use only the provided results. Return an empty string for any value not found; never guess.",
      jsonSchemaName: "school_contact_lookup",
      jsonSchema: CONTACT_JSON_SCHEMA,
      userText: `${instruction}\n\nWEB SEARCH RESULTS:\n${searchResults}`,
      schema: SchoolContactLookupSchema,
    });
  }

  // Default path: OpenAI Responses API with the built-in web_search tool.
  const response = await openai.responses.create({
    model: "gpt-4o-mini",
    tools: [{ type: "web_search" }],
    input: instruction,
    text: {
      format: {
        type: "json_schema",
        name: "school_contact_lookup",
        schema: CONTACT_JSON_SCHEMA,
        strict: true,
      },
    },
  });

  if (!response.output_text) {
    throw new Error("Web search did not return school contact info.");
  }

  return SchoolContactLookupSchema.parse(JSON.parse(response.output_text));
}
