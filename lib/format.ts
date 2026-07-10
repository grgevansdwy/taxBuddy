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
