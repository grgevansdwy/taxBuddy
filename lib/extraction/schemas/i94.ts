import { z } from "zod";

// Output contract for the I-94 + travel-history extraction spec in lib/ai/extractionSpecs.ts.
// Deliberately smaller than I94TravelRow/FilerProfile in lib/types.ts — just what's
// extractable from the two source documents; the rest of those types is filled in
// elsewhere (manual input, I-20 extraction, etc.).
export const I94ExtractionSchema = z.object({
  legalName: z.string(), // full legal name as printed on the I-94
  dob: z.string(), // ISO yyyy-mm-dd
  citizenship: z.string(), // country of citizenship as printed on the I-94
  visaClass: z.string(), // e.g. "F-1"
  firstEntryDate: z.string(), // ISO yyyy-mm-dd
  passportNumber: z.string(),
  travelHistory: z.array(
    z.object({
      date: z.string(), // ISO yyyy-mm-dd
      type: z.enum(["arrival", "departure"]),
    }),
  ),
  confidence: z.number().min(0).max(1),
});

export type I94Extraction = z.infer<typeof I94ExtractionSchema>;
