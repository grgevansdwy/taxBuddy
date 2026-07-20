import { NextResponse } from "next/server";
import { listAllUsers, requireAdmin, resolveName } from "@/lib/admin/data";

// Directory of every account for the admin table (email + name + stage + joined
// date). Not windowed — the table is a full directory; the metric cards handle
// the time-range counts. Newest accounts first.
export async function GET() {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;
  const { admin } = guard;

  const users = await listAllUsers(admin);

  const { data: filings, error } = await admin
    .from("filings")
    .select("user_id, stage, profile_page");
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const filingByUser = new Map(
    (filings ?? []).map((f) => [f.user_id as string, f])
  );

  const accounts = users
    .map((u) => {
      const filing = filingByUser.get(u.id);
      return {
        id: u.id,
        email: u.email ?? "—",
        name: resolveName(filing?.profile_page, u.user_metadata, u.email),
        stage: (filing?.stage as string) ?? null,
        createdAt: u.created_at ?? null,
      };
    })
    .sort((a, b) => {
      const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return tb - ta;
    });

  return NextResponse.json({ accounts });
}
