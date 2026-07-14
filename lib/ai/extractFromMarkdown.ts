import { runMarkdownExtraction, type MarkdownDocument } from "@/lib/ai/runMarkdownExtraction";
import { EXTRACTION_SPECS, type ExtractionKind, type ExtractionKindResult } from "@/lib/ai/extractionSpecs";

// The one entry point for the markdown pipeline: look up the spec for a
// document kind, hand it to the shared gpt-4o-mini runner. Replaces what
// would otherwise be six near-identical extract<Type>FromMarkdown.ts files.
export async function extractFromMarkdown<K extends ExtractionKind>(
  kind: K,
  documents: MarkdownDocument[]
): Promise<ExtractionKindResult[K]> {
  const spec = EXTRACTION_SPECS[kind] as (typeof EXTRACTION_SPECS)[K];

  if (documents.length !== spec.documentTitles.length) {
    throw new Error(
      `"${kind}" extraction expects ${spec.documentTitles.length} document(s) (${spec.documentTitles.join(", ")}), got ${documents.length}.`
    );
  }

  return runMarkdownExtraction({
    systemPrompt: spec.systemPrompt,
    jsonSchemaName: spec.jsonSchemaName,
    jsonSchema: spec.jsonSchema,
    documents,
    instruction: spec.instruction,
    schema: spec.schema,
  });
}
