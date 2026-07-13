import type { TaxYearConfig } from "@/lib/types";

// Back-filing is disabled for now — only this tax year is supported (Stage 0, rule 1).
export const CURRENT_SUPPORTED_TAX_YEAR = 2025;

// 2025 federal figures (Rev. Proc. 2024-40). Nonresident aliens file as
// Single or Married Filing Separately — no other statuses apply to F-1
// students in this scope. mailing_address_843/filing_deadline_wages are
// unused until wages/FICA recovery is built (out of scope for now) but kept
// here since TaxYearConfig requires them.
export const TAX_YEAR_CONFIG: TaxYearConfig = {
  brackets_single: [
    [0, 11925, 0.1],
    [11925, 48475, 0.12],
    [48475, 103350, 0.22],
    [103350, 197300, 0.24],
    [197300, 250525, 0.32],
    [250525, 626350, 0.35],
    [626350, Infinity, 0.37],
  ],
  brackets_mfs: [
    [0, 11925, 0.1],
    [11925, 48475, 0.12],
    [48475, 103350, 0.22],
    [103350, 197300, 0.24],
    [197300, 250525, 0.32],
    [250525, 375800, 0.35],
    [375800, Infinity, 0.37],
  ],
  standard_deduction: 15000, // Single, 2025 — only usable when allows_standard_deduction (India treaty)
  nec_default_rate: 0.3,
  capital_gains_presence_days: 183,
  filing_deadline_wages: "2026-04-15",
  filing_deadline_no_wages: "2026-06-15",
  mailing_address_1040nr_refund: "Department of the Treasury, Internal Revenue Service, Austin, TX 73301-0215, USA",
  mailing_address_1040nr_payment: "Internal Revenue Service, P.O. Box 1303, Charlotte, NC 28201-1303, USA",
  mailing_address_843: "Department of the Treasury, Internal Revenue Service, Austin, TX 73301-0215, USA",
  payment_url: "https://www.irs.gov/payments/direct-pay",
};
