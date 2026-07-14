import { z } from "zod";

// Output contract for the I-20 extraction spec in lib/ai/extractionSpecs.ts.
// Only the 3 fields actually printed on a Form I-20: school name, DSO name,
// and the international student office's address (labeled "School Address"
// on the form, but it's the DSO's office, not the institution's mailing
// address). The institution's address/phone and the DSO office's phone
// aren't on the I-20 at all — see lib/ai/lookupSchoolContactInfo.ts, which
// fills those in via web search and merges into SchoolInfo (lib/types.ts).
export const I20ExtractionSchema = z.object({
  schoolName: z.string(),
  dsoName: z.string(), // Designated School Official who signed the I-20
  dsoAddress: z.string(), // international student office address, printed as "School Address"
  confidence: z.number().min(0).max(1),
});

export type I20Extraction = z.infer<typeof I20ExtractionSchema>;
