import { NextResponse, type NextRequest } from "next/server";
import {
  listAllUsers,
  parseRange,
  rangeToSince,
  requireAdmin,
} from "@/lib/admin/data";

// Headline metrics for the selected window:
//   totalAccounts  = accounts created within the window (all-time = every account)
//   visits         = account_visits rows in the window
//   uniqueVisits   = distinct accounts among those rows
export async function GET(request: NextRequest) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;
  const { admin } = guard;

  const range = parseRange(request.nextUrl.searchParams.get("range"));
  const since = rangeToSince(range);
  const sinceIso = since?.toISOString();

  const users = await listAllUsers(admin);
  const totalAccounts = since
    ? users.filter((u) => u.created_at && new Date(u.created_at) >= since).length
    : users.length;

  let visitQuery = admin.from("account_visits").select("user_id");
  if (sinceIso) visitQuery = visitQuery.gte("created_at", sinceIso);
  const { data: visits, error } = await visitQuery;
  // Degrade gracefully before the account_visits migration is applied: report
  // zero visits rather than 500ing the whole dashboard.
  if (error) {
    return NextResponse.json({ totalAccounts, visits: 0, uniqueVisits: 0 });
  }

  const uniqueVisits = new Set((visits ?? []).map((v) => v.user_id)).size;

  return NextResponse.json({
    totalAccounts,
    visits: visits?.length ?? 0,
    uniqueVisits,
  });
}
