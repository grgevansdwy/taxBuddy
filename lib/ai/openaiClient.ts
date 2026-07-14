import OpenAI from "openai";

// Reads OPENAI_API_KEY from the environment automatically. The only LLM
// client left in the extraction layer — every document type now goes
// through LlamaParse (PDF -> markdown) then this client (markdown -> fields).
export const openai = new OpenAI();
