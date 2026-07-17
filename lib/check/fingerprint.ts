import { createHmac, randomUUID } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";

// Privacy-preserving abuse dedup for the no-auth /check funnel. The problem:
// the funnel runs paid LlamaParse + OpenAI calls with no login, so we want
// "one free check per person" — but storing who a person IS (name, SSN,
// documents) would be a serious liability on an unauthenticated endpoint.
//
// The solution: identify a person only by a KEYED, one-way fingerprint of
// their SSN/ITIN. The SSN is the stable, unique tax identity that appears on
// every relevant document, but its keyspace is tiny (~10^9), so a plain
// SHA-256 would be trivially reversible by brute force. Peppering it through
// HMAC-SHA256 with a server-only secret makes the stored digest irreversible
// and un-linkable to any real SSN or person. We persist ONLY that digest.

const SSN_PATTERN = /\b(\d{3})-(\d{2})-(\d{4})\b/;

// Reduce an SSN/ITIN to 9 digits. Returns null if it isn't 9 digits (so we
// never fingerprint a partial/garbage value and accidentally collide people).
export function normalizeSsn(raw: string | null | undefined): string | null {
  const digits = (raw ?? "").replace(/\D/g, "");
  return digits.length === 9 ? digits : null;
}

// Pull an SSN/ITIN out of parsed document markdown. Only the dashed 3-2-4
// form is matched — that's how SSNs print on a W-2/1042-S, and it can't be
// confused with an EIN (2-7 grouping). Returns null when none is visible
// (e.g. a 1099 that masks the recipient TIN), in which case that document
// simply doesn't participate in dedup.
export function extractSsnFromMarkdown(markdown: string): string | null {
  const match = SSN_PATTERN.exec(markdown);
  return match ? match[1] + match[2] + match[3] : null;
}

// The stored identity. HMAC-SHA256(normalized SSN) under the server pepper.
// Returns null when the SSN is unusable or the pepper isn't configured — both
// mean "can't fingerprint", which callers treat as "skip dedup" (fail open).
export function fingerprintSsn(rawSsn: string | null | undefined): string | null {
  const normalized = normalizeSsn(rawSsn);
  const secret = process.env.CHECK_FINGERPRINT_SECRET;
  if (!normalized || !secret) return null;
  return createHmac("sha256", secret).update(normalized).digest("hex");
}

// ---------------- Session id ----------------
// A random opaque id the CLIENT owns (generated once, persisted in
// localStorage) and sends on every /api/check/* request via this header. It is
// NOT tied to any identity and NOT a security token — its only job is to group
// one browser's own uploads so a legitimate session with several same-SSN
// documents (W-2 + 1042-S + 1099, or Step-1 docs + the Step-2 return) doesn't
// flag ITSELF as a repeat. Client ownership is deliberate: the multi-file Step-1
// uploads fire in parallel, so a server-set cookie would race (each concurrent
// request minting a different id and then self-blocking). It can't be used to
// bypass the block — that's keyed on the SSN fingerprint, which the server
// computes from the document. The repeat-use signal is the same fingerprint
// appearing under a DIFFERENT session id (a new browser re-running the funnel).
export const CHECK_SESSION_HEADER = "x-check-session";

// The caller's session id, or a fresh one for non-browser callers (each such
// request is then independent — fine, since the race only matters for the
// browser's parallel uploads, which always send the header).
export function getSessionId(request: Request): string {
  return request.headers.get(CHECK_SESSION_HEADER) || randomUUID();
}

export type DedupOutcome = "ok" | "blocked" | "skipped";

// The one dedup decision. Given a fingerprint and the caller's session id:
//   • blocked  — this SSN was already used under a different session (repeat).
//   • ok       — first use, or same session as before; records it and proceeds.
//   • skipped  — no fingerprint / admin client / table (dedup unavailable);
//                fail OPEN so a misconfig never takes the funnel down.
export async function checkAndRecordFingerprint(
  fingerprint: string | null,
  sessionId: string,
  client: SupabaseClient | null = createAdminClient()
): Promise<DedupOutcome> {
  if (!fingerprint) return "skipped";
  const admin = client;
  if (!admin) return "skipped";

  const { data, error } = await admin
    .from("check_fingerprints")
    .select("session_id")
    .eq("fingerprint", fingerprint);

  if (error) {
    // Table missing / transient DB error: don't punish the user for our infra.
    console.error("check dedup lookup failed:", error.message);
    return "skipped";
  }

  if (data?.some((row) => row.session_id !== sessionId)) return "blocked";

  if (!data?.length) {
    const { error: insertError } = await admin
      .from("check_fingerprints")
      .insert({ fingerprint, session_id: sessionId });
    if (insertError) console.error("check dedup insert failed:", insertError.message);
  }

  return "ok";
}
