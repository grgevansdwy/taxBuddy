import { z } from "zod";

// Output contract for the I-20 extraction tool call in lib/ai/extractI20.ts.
// Maps onto SchoolInfo + sevisId in FilerProfile (lib/types.ts).
export const I20ExtractionSchema = z.object({
  schoolName: z.string(),
  schoolAddress: z.string(),
  schoolPhone: z.string(),
  dsoName: z.string(), // Designated School Official, signs the I-20
  sevisId: z.string(), // "N0012345678" format
  confidence: z.number().min(0).max(1),
});

export type I20Extraction = z.infer<typeof I20ExtractionSchema>;
