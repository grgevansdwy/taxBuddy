import { z } from "zod";

// Output contract for the W-2 extraction spec in lib/ai/extractionSpecs.ts.
// Maps 1:1 onto W2Data in lib/types.ts. One W-2 document → one record; a
// student with multiple employers extracts each separately.
export const W2ExtractionSchema = z.object({
  employerName: z.string(),
  employerEin: z.string(),
  employerAddress: z.string(),
  box1: z.number(), // wages, tips, other compensation
  box2: z.number(), // federal income tax withheld
  box3: z.number(), // social security wages
  box4: z.number(), // social security tax withheld
  box5: z.number(), // Medicare wages and tips
  box6: z.number(), // Medicare tax withheld
  box15State: z.string().nullable(), // state abbreviation, null if blank
  box17StateTaxWithheld: z.number().nullable(), // state income tax withheld, null if blank
  confidence: z.number().min(0).max(1),
});

export type W2Extraction = z.infer<typeof W2ExtractionSchema>;
