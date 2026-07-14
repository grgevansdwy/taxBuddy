import { z } from "zod";

// Output contract for the 1098-T extraction spec in lib/ai/extractionSpecs.ts.
// Maps 1:1 onto F1098TData in lib/types.ts.
export const F1098TExtractionSchema = z.object({
  box1: z.number(), // payments received for qualified tuition and related expenses
  box5: z.number(), // scholarships or grants
  confidence: z.number().min(0).max(1),
});

export type F1098TExtraction = z.infer<typeof F1098TExtractionSchema>;
