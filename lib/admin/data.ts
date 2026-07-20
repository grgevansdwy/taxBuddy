import { NextResponse } from "next/server";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdmin } from "@/lib/config/admin";

// Shared server-only helpers for the /api/admin/* routes. Everything here reads
// across all users and MUST stay server-only — createAdminClient() returns a
// service-role client that bypasses RLS.

export type AdminRange = "7d" | "30d" | "3m" | "1y" | "all";

const RANGE_DAYS: Record<Exclude<AdminRange, "all">, number> = {
  "7d": 7,
  "30d": 30,
  "3m": 91,
  "1y": 365,
};

export function parseRange(raw: string | null): AdminRange {
  if (raw === "7d" || raw === "30d" || raw === "3m" || raw === "1y" || raw === "all") {
    return raw;
  }
  return "30d";
}

// Cutoff for a range, or null for "all time".
export function rangeToSince(range: AdminRange): Date | null {
  if (range === "all") return null;
  const since = new Date();
  since.setDate(since.getDate() - RANGE_DAYS[range]);
  return since;
}

type AdminGuardOk = { ok: true; admin: SupabaseClient };
type AdminGuardFail = { ok: false; response: NextResponse };

// Gate an /api/admin/* route: confirm the *session* user is the admin (via the
// anon/session client), then hand back the service-role client. Fails closed if
// the service-role key isn't configured.
export async function requireAdmin(): Promise<AdminGuardOk | AdminGuardFail> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!isAdmin(user?.email)) {
    return {
      ok: false,
      response: NextResponse.json({ error: "forbidden" }, { status: 403 }),
    };
  }

  const admin = createAdminClient();
  if (!admin) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "admin client not configured" },
        { status: 500 }
      ),
    };
  }

  return { ok: true, admin };
}

// auth.admin.listUsers() pages at 50 by default — walk every page.
export async function listAllUsers(admin: SupabaseClient): Promise<User[]> {
  const users: User[] = [];
  const perPage = 200;
  for (let page = 1; ; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    users.push(...data.users);
    if (data.users.length < perPage) break;
  }
  return users;
}

// Names aren't captured at email signup, so resolve from the best available
// source: the I-94 legal name on the filing, then Google OAuth metadata, then
// a dash. profile_page is the filings.profile_page jsonb (FilerProfile shape).
export function resolveName(
  profilePage: unknown,
  userMetadata: Record<string, unknown> | undefined,
  email: string | undefined
): string {
  const legal = (profilePage as { legalName?: { value?: unknown } } | null)?.legalName?.value;
  if (typeof legal === "string" && legal.trim()) return legal.trim();

  const metaName = userMetadata?.full_name ?? userMetadata?.name;
  if (typeof metaName === "string" && metaName.trim()) return metaName.trim();

  return email ?? "—";
}
