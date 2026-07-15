export function formatIsoDate(iso: string, fallback = ""): string {
  if (!iso) return fallback;
  const date = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return fallback;
  return new Intl.DateTimeFormat("en-US", { dateStyle: "long", timeZone: "UTC" }).format(date);
}

// MM/DD/YYYY — the format IRS forms print dates in. String-sliced rather than
// parsed as a Date to avoid any timezone rollover at midnight.
export function formatIsoDateSlashes(iso: string, fallback = ""): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso ?? "");
  if (!match) return fallback;
  const [, year, month, day] = match;
  return `${month}/${day}/${year}`;
}

// mm/dd/yy — some IRS form date fields (e.g. Schedule OI item G) are
// maxLength=8 and print a 2-digit year, unlike Form 8843's 4-digit fields.
export function formatIsoDateSlashesShortYear(iso: string, fallback = ""): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso ?? "");
  if (!match) return fallback;
  const [, year, month, day] = match;
  return `${month}/${day}/${year.slice(2)}`;
}

// IRS rules require consistency across the whole return: round every dollar
// amount to whole dollars everywhere, or keep cents everywhere, never mix.
// This app keeps cents (matches Glacier Tax Prep's convention, checked
// against a reference return). Always prints, including "0.00" — every call
// site here is a genuine computed conclusion, not a placeholder for
// something inapplicable, so there's nothing to hide by going blank.
export function formatUsd(amount: number): string {
  return amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Some IRS form TIN fields are digit-only comb fields with no room for
// dashes (e.g. Form 1040-NR's is maxLength=9) — strip formatting so the
// same profile.ssnOrItin value works everywhere, including forms whose TIN
// field does allow dashes (f8843's is maxLength=11).
export function formatSsnDigits(ssnOrItin: string | undefined): string {
  return (ssnOrItin ?? "").replace(/\D/g, "");
}

// IRS forms split a full legal name into "first name and middle initial" /
// "last name" fields — single-word names (no space) go entirely in the first
// field. Middle name(s) are abbreviated to a single initial each (e.g. "John
// Michael Smith" -> "John M." / "Smith"), matching what the form actually asks for.
export function splitLegalName(fullName: string | undefined): { firstNameAndInitial: string; lastName: string } {
  const nameParts = (fullName ?? "").trim().split(/\s+/).filter(Boolean);
  if (nameParts.length <= 1) {
    return { firstNameAndInitial: nameParts.join(" "), lastName: "" };
  }
  const [first, ...rest] = nameParts;
  const middleInitials = rest
    .slice(0, -1)
    .map((middle) => `${middle.charAt(0).toUpperCase()}.`)
    .join(" ");
  return {
    firstNameAndInitial: [first, middleInitials].filter(Boolean).join(" "),
    lastName: rest[rest.length - 1],
  };
}
