import { z } from "zod";

// Output contract for the I-20 extraction spec in lib/ai/extractionSpecs.ts.
// Maps onto SchoolInfo + the top-level sevisId field on FilerProfile in
// lib/types.ts — every field a Form I-20 (Certificate of Eligibility for
// Nonimmigrant Student Status) actually needs to feed downstream.
export const I20ExtractionSchema = z.object({
  schoolName: z.string(),
  schoolAddress: z.string(),
  schoolPhone: z.string(),
  dsoName: z.string(), // Designated School Official who signed the I-20
  sevisId: z.string(), // e.g. "N0012345678"
  confidence: z.number().min(0).max(1),
});

export type I20Extraction = z.infer<typeof I20ExtractionSchema>;
