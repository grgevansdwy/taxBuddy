import type { ZodType } from "zod";
import {
  I94ExtractionSchema,
  type I94Extraction,
} from "@/lib/extraction/schemas/i94";
import {
  I20ExtractionSchema,
  type I20Extraction,
} from "@/lib/extraction/schemas/i20";
import {
  W2ExtractionSchema,
  type W2Extraction,
} from "@/lib/extraction/schemas/w2";
import {
  F1042SExtractionSchema,
  type F1042SExtraction,
} from "@/lib/extraction/schemas/f1042s";
import {
  F1099IntExtractionSchema,
  type F1099IntExtraction,
} from "@/lib/extraction/schemas/f1099int";
import {
  F1099DivExtractionSchema,
  type F1099DivExtraction,
} from "@/lib/extraction/schemas/f1099div";
import {
  F1099BExtractionSchema,
  type F1099BExtraction,
} from "@/lib/extraction/schemas/f1099b";

// Single source of truth for "what does extracting document type X need":
// system prompt + JSON schema + Zod schema + how many documents it expects.
// This is the only place any of that is defined — the markdown/gpt-4o-mini
// pipeline (lib/ai/runMarkdownExtraction.ts, lib/ai/extractFromMarkdown.ts)
// reads it via one generic dispatcher. Add a new document type by adding one
// entry here — nothing else needs to change.
export type ExtractionKind =
  | "i94"
  | "i20"
  | "w2"
  | "f1042s"
  | "f1099int"
  | "f1099div"
  | "f1099b";

export interface ExtractionKindResult {
  i94: I94Extraction;
  i20: I20Extraction;
  w2: W2Extraction;
  f1042s: F1042SExtraction;
  f1099int: F1099IntExtraction;
  f1099div: F1099DivExtraction;
  f1099b: F1099BExtraction;
}

interface ExtractionSpec<T> {
  systemPrompt: string;
  jsonSchemaName: string;
  jsonSchema: Record<string, unknown>;
  schema: ZodType<T>;
  instruction: string;
  documentTitles: string[];
}

export const EXTRACTION_SPECS: {
  [K in ExtractionKind]: ExtractionSpec<ExtractionKindResult[K]>;
} = {
  i94: {
    systemPrompt:
      "You extract fields from a US CBP I-94 record and travel history for an " +
      "F-1 student's tax filing — identity fields (name, date of birth, " +
      "citizenship) plus visa/entry data for the eligibility check. Extract " +
      "only what's clearly printed in the documents; do not infer or guess a " +
      "value that isn't visible.",
    jsonSchemaName: "record_i94_extraction",
    jsonSchema: {
      type: "object",
      properties: {
        legalName: {
          type: "string",
          description: "The traveler's full legal name as printed on the I-94.",
        },
        dob: {
          type: "string",
          description:
            "Date of birth as printed on the I-94, as ISO yyyy-mm-dd.",
        },
        citizenship: {
          type: "string",

          description: "Country of citizenship as printed on the I-94.",
        },
        visaClass: {
          type: "string",
          description:
            "The nonimmigrant visa/status class shown on the I-94. Please format it with a - (e.g. no F1, but F-1)",
        },
        firstEntryDate: {
          type: "string",
          description:
            "The earliest arrival date across the I-94 and travel history, as ISO yyyy-mm-dd. (Find the earliest date in the travel history)",
        },
        passportNumber: {
          type: "string",
          description: "Passport Number.",
        },
        travelHistory: {
          type: "array",
          description:
            "Every arrival/departure row from the travel history, in the order they appear.",
          items: {
            type: "object",
            properties: {
              date: { type: "string", description: "ISO yyyy-mm-dd" },
              type: { type: "string", enum: ["arrival", "departure"] },
            },
            required: ["date", "type"],
            additionalProperties: false,
          },
        },
        confidence: {
          type: "number",
          description:
            "Overall confidence (0-1) that every field above was read correctly.",
        },
      },
      required: [
        "legalName",
        "dob",
        "citizenship",
        "visaClass",
        "firstEntryDate",
        "passportNumber",
        "travelHistory",
        "confidence",
      ],
      additionalProperties: false,
    },
    schema: I94ExtractionSchema,
    instruction:
      "Extract the required fields from the I-94 record and travel history above.",
    documentTitles: ["I-94", "I-94 travel history"],
  },
  i20: {
    systemPrompt:
      "You extract fields from a US Form I-20 (Certificate of Eligibility for " +
      "Nonimmigrant Student Status) for an F-1 student's tax filing — school " +
      "identity fields only. Extract only what's clearly printed in the " +
      "document; do not infer or guess a value that isn't visible.",
    jsonSchemaName: "record_i20_extraction",
    jsonSchema: {
      type: "object",
      properties: {
        schoolName: {
          type: "string",
          description:
            "The school's name, as printed in the School Information section.",
        },
        dsoName: {
          type: "string",
          description:
            "The name of the Designated School Official (DSO) who signed the I-20, from the signature block.",
        },
        dsoAddress: {
          type: "string",
          description:
            "The address printed in the School Information section under 'School Address'. This is the " +
            "international student office's address, not necessarily the institution's general mailing address.",
        },
        confidence: {
          type: "number",
          description:
            "Overall confidence (0-1) that every field above was read correctly.",
        },
      },
      required: ["schoolName", "dsoName", "dsoAddress", "confidence"],
      additionalProperties: false,
    },
    schema: I20ExtractionSchema,
    instruction: "Extract the required fields from the I-20 document above.",
    documentTitles: ["I-20"],
  },
  w2: {
    systemPrompt:
      "You extract fields from a US Form W-2 (Wage and Tax Statement) for an " +
      "F-1 student's tax filing. Extract only what's clearly printed in the " +
      "document; do not infer or guess a value that isn't visible.",
    jsonSchemaName: "record_w2_extraction",
    jsonSchema: {
      type: "object",
      properties: {
        employerName: { type: "string", description: "Employer's name." },
        employerEin: {
          type: "string",
          description: "Employer's federal ID number (EIN).",
        },
        employerAddress: {
          type: "string",
          description: "Employer's full address.",
        },
        box1: {
          type: "number",
          description: "Box 1: wages, tips, other compensation.",
        },
        box2: {
          type: "number",
          description: "Box 2: federal income tax withheld.",
        },
        box3: { type: "number", description: "Box 3: social security wages." },
        box4: {
          type: "number",
          description: "Box 4: social security tax withheld.",
        },
        box5: {
          type: "number",
          description: "Box 5: Medicare wages and tips.",
        },
        box6: { type: "number", description: "Box 6: Medicare tax withheld." },
        box15State: {
          type: ["string", "null"],
          description: "Box 15: state abbreviation. Null if the box is blank.",
        },
        box17StateTaxWithheld: {
          type: ["number", "null"],
          description: "Box 17: state income tax withheld. Null if the box is blank.",
        },
        confidence: {
          type: "number",
          description:
            "Overall confidence (0-1) that every field above was read correctly.",
        },
      },
      required: [
        "employerName",
        "employerEin",
        "employerAddress",
        "box1",
        "box2",
        "box3",
        "box4",
        "box5",
        "box6",
        "box15State",
        "box17StateTaxWithheld",
        "confidence",
      ],
      additionalProperties: false,
    },
    schema: W2ExtractionSchema,
    instruction: "Extract the required fields from the W-2 document above.",
    documentTitles: ["W-2"],
  },
  f1042s: {
    systemPrompt:
      "You extract fields from a US Form 1042-S (Foreign Person's U.S. Source " +
      "Income Subject to Withholding) for an F-1 student's tax filing. Extract " +
      "only what's clearly printed in the document; do not infer or guess a " +
      "value that isn't visible.",
    jsonSchemaName: "record_f1042s_extraction",
    jsonSchema: {
      type: "object",
      properties: {
        incomeCode: {
          type: "string",
          description:
            "Box 1: income code, e.g. '16' for scholarship/fellowship grants.",
        },
        grossIncome: { type: "number", description: "Box 2: gross income." },
        exemptionCode: {
          type: ["string", "null"],
          description:
            "Box 3a: chapter 3 exemption code. Null if the box is blank or not exempt.",
        },
        exemptionRate: {
          type: ["number", "null"],
          description:
            "Box 3b: chapter 3 tax rate, e.g. 0.00 for a fully treaty-exempt amount. Null if blank.",
        },
        taxWithheld: {
          type: "number",
          description: "Box 7a: federal tax withheld.",
        },
        countryCode: {
          type: "string",
          description: "Box 12f: recipient's country code.",
        },
        withholdingCredit: {
          type: "number",
          description: "Box 10: total withholding credit.",
        },
        confidence: {
          type: "number",
          description:
            "Overall confidence (0-1) that every field above was read correctly.",
        },
      },
      required: [
        "incomeCode",
        "grossIncome",
        "exemptionCode",
        "exemptionRate",
        "taxWithheld",
        "countryCode",
        "withholdingCredit",
        "confidence",
      ],
      additionalProperties: false,
    },
    schema: F1042SExtractionSchema,
    instruction: "Extract the required fields from the 1042-S document above.",
    documentTitles: ["1042-S"],
  },
  f1099int: {
    systemPrompt:
      "You extract fields from a US Form 1099-INT (Interest Income) for an F-1 " +
      "student's tax filing. The document may be a standalone 1099-INT or one " +
      "section of a broker's consolidated 1099 that also covers dividends and " +
      "broker transactions — only report on the 1099-INT section. If there is " +
      "no 1099-INT section anywhere in the document, set sectionPresent to " +
      "false and leave the other fields as 0/empty rather than guessing. " +
      "Extract only what's clearly printed; do not infer or guess a value that " +
      "isn't visible.",
    jsonSchemaName: "record_f1099int_extraction",
    jsonSchema: {
      type: "object",
      properties: {
        sectionPresent: {
          type: "boolean",
          description:
            "True if a 1099-INT section actually appears in the document, false if it doesn't.",
        },
        payerName: {
          type: "string",
          description: "The payer's (bank's) name.",
        },
        payerEin: {
          type: "string",
          description: "The payer's federal ID number (EIN).",
        },
        box1InterestIncome: {
          type: "number",
          description: "Box 1: interest income.",
        },
        box4FederalTaxWithheld: {
          type: "number",
          description: "Box 4: federal income tax withheld.",
        },
        box8TaxExemptInterest: {
          type: "number",
          description: "Box 8: tax-exempt interest.",
        },
        confidence: {
          type: "number",
          description:
            "Overall confidence (0-1) that every field above was read correctly.",
        },
      },
      required: [
        "sectionPresent",
        "payerName",
        "payerEin",
        "box1InterestIncome",
        "box4FederalTaxWithheld",
        "box8TaxExemptInterest",
        "confidence",
      ],
      additionalProperties: false,
    },
    schema: F1099IntExtractionSchema,
    instruction:
      "Extract the required fields from the 1099-INT document above.",
    documentTitles: ["1099-INT"],
  },
  f1099div: {
    systemPrompt:
      "You extract fields from a US Form 1099-DIV (Dividends and Distributions) " +
      "for an F-1 student's tax filing. The document may be a standalone " +
      "1099-DIV or one section of a broker's consolidated 1099 that also " +
      "covers interest and broker transactions — only report on the 1099-DIV " +
      "section. If there is no 1099-DIV section anywhere in the document, set " +
      "sectionPresent to false and leave the other fields as 0/empty rather " +
      "than guessing. Extract only what's clearly printed; do not infer or " +
      "guess a value that isn't visible.",
    jsonSchemaName: "record_f1099div_extraction",
    jsonSchema: {
      type: "object",
      properties: {
        sectionPresent: {
          type: "boolean",
          description:
            "True if a 1099-DIV section actually appears in the document, false if it doesn't.",
        },
        payerName: { type: "string", description: "The payer's name." },
        payerEin: {
          type: "string",
          description: "The payer's federal ID number (EIN).",
        },
        box1aTotalOrdinaryDividends: {
          type: "number",
          description: "Box 1a: total ordinary dividends.",
        },
        box1bQualifiedDividends: {
          type: "number",
          description: "Box 1b: qualified dividends.",
        },
        box4FederalTaxWithheld: {
          type: "number",
          description: "Box 4: federal income tax withheld.",
        },
        confidence: {
          type: "number",
          description:
            "Overall confidence (0-1) that every field above was read correctly.",
        },
      },
      required: [
        "sectionPresent",
        "payerName",
        "payerEin",
        "box1aTotalOrdinaryDividends",
        "box1bQualifiedDividends",
        "box4FederalTaxWithheld",
        "confidence",
      ],
      additionalProperties: false,
    },
    schema: F1099DivExtractionSchema,
    instruction:
      "Extract the required fields from the 1099-DIV document above.",
    documentTitles: ["1099-DIV"],
  },
  f1099b: {
    systemPrompt:
      "You extract fields from a US Form 1099-B (Proceeds From Broker and " +
      "Barter Exchange Transactions) for an F-1 student's tax filing. The " +
      "document may be a standalone 1099-B or one section of a broker's " +
      "consolidated 1099 that also covers interest and dividends — only report " +
      "on the 1099-B section. If there is no 1099-B section anywhere in the " +
      "document, set sectionPresent to false and leave transactions empty " +
      "rather than guessing. Extract every transaction row exactly as printed; " +
      "do not infer or guess a value that isn't visible, and do not compute " +
      "gain/loss yourself.",
    jsonSchemaName: "record_f1099b_extraction",
    jsonSchema: {
      type: "object",
      properties: {
        sectionPresent: {
          type: "boolean",
          description:
            "True if a 1099-B section actually appears in the document, false if it doesn't.",
        },
        payerName: { type: "string", description: "The broker's name." },
        transactions: {
          type: "array",
          description:
            "Every transaction row on the document, in the order they appear.",
          items: {
            type: "object",
            properties: {
              description: {
                type: "string",
                description: "e.g. '100 sh. AAPL'.",
              },
              dateAcquired: {
                type: ["string", "null"],
                description:
                  "ISO yyyy-mm-dd. Null if reported as 'various' or inherited.",
              },
              dateSold: {
                type: "string",
                description: "ISO yyyy-mm-dd, box 1c.",
              },
              proceeds: { type: "number", description: "Box 1d: proceeds." },
              costBasis: {
                type: "number",
                description: "Box 1e: cost or other basis.",
              },
              isShortTerm: {
                type: "boolean",
                description: "Box 2: true if reported as short-term.",
              },
              box4FederalTaxWithheld: {
                type: "number",
                description: "Box 4: federal income tax withheld.",
              },
            },
            required: [
              "description",
              "dateAcquired",
              "dateSold",
              "proceeds",
              "costBasis",
              "isShortTerm",
              "box4FederalTaxWithheld",
            ],
            additionalProperties: false,
          },
        },
        confidence: {
          type: "number",
          description:
            "Overall confidence (0-1) that every field above was read correctly.",
        },
      },
      required: ["sectionPresent", "payerName", "transactions", "confidence"],
      additionalProperties: false,
    },
    schema: F1099BExtractionSchema,
    instruction: "Extract every transaction from the 1099-B document above.",
    documentTitles: ["1099-B"],
  },
};
