import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Service-role Supabase client for server-only work that has no user session —
// specifically the no-auth /check funnel's abuse-dedup ledger
// (public.check_fingerprints), which the anon key can't touch because that
// table's RLS has no policies. NEVER import this into anything that runs in the
// browser: the service-role key bypasses RLS entirely.
//
// Returns null (rather than throwing) when the key isn't configured, so the
// funnel degrades to "no dedup" instead of 500ing in a dev/preview env that
// hasn't set the secret.
let cached: SupabaseClient | null = null;

export function createAdminClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return null;
  if (cached) return cached;
  cached = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cached;
}
