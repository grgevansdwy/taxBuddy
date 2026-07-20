import { NextResponse, type NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  listAllUsers,
  parseRange,
  rangeToSince,
  requireAdmin,
  type AdminRange,
} from "@/lib/admin/data";

// Time-bucketed series powering the growth chart. Granularity adapts to the
// window so the line stays readable: daily for 7d/30d, weekly for 3m/1y,
// monthly for all-time. Empty buckets are zero-filled so lines stay continuous.

type Granularity = "day" | "week" | "month";

interface Bucket {
  start: Date;
  end: Date;
}

function granularityFor(range: AdminRange): Granularity {
  if (range === "7d" || range === "30d") return "day";
  if (range === "3m" || range === "1y") return "week";
  return "month";
}

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function advance(d: Date, granularity: Granularity): Date {
  const x = new Date(d);
  if (granularity === "day") x.setDate(x.getDate() + 1);
  else if (granularity === "week") x.setDate(x.getDate() + 7);
  else x.setMonth(x.getMonth() + 1);
  return x;
}

function buildBuckets(start: Date, now: Date, granularity: Granularity): Bucket[] {
  const buckets: Bucket[] = [];
  let cursor =
    granularity === "month" ? startOfMonth(start) : startOfDay(start);
  // Cap the count so a pathological range can't blow up the response.
  for (let i = 0; i < 400 && cursor <= now; i++) {
    const end = advance(cursor, granularity);
    buckets.push({ start: cursor, end });
    cursor = end;
  }
  return buckets;
}

export async function GET(request: NextRequest) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;
  const admin: SupabaseClient = guard.admin;

  const range = parseRange(request.nextUrl.searchParams.get("range"));
  const granularity = granularityFor(range);
  const now = new Date();
  const since = rangeToSince(range);

  const users = await listAllUsers(admin);
  const signupDates = users
    .map((u) => (u.created_at ? new Date(u.created_at) : null))
    .filter((d): d is Date => d !== null)
    .sort((a, b) => a.getTime() - b.getTime());

  // Window start: the range cutoff, or (for all-time) the earliest signup.
  const windowStart = since ?? signupDates[0] ?? startOfDay(now);
  const buckets = buildBuckets(windowStart, now, granularity);

  // Visits within the window (or all for all-time).
  let visitQuery = admin
    .from("account_visits")
    .select("user_id, created_at");
  if (since) visitQuery = visitQuery.gte("created_at", since.toISOString());
  const { data: visitData, error } = await visitQuery;
  // Degrade gracefully before the account_visits migration is applied: the
  // chart still plots account growth, with zeroed visit series.
  const visits = error ? [] : visitData;

  const series = buckets.map((bucket) => {
    const inBucket = (visits ?? []).filter((v) => {
      const t = new Date(v.created_at).getTime();
      return t >= bucket.start.getTime() && t < bucket.end.getTime();
    });
    const newAccounts = signupDates.filter(
      (d) => d.getTime() >= bucket.start.getTime() && d.getTime() < bucket.end.getTime()
    ).length;
    const cumulativeAccounts = signupDates.filter(
      (d) => d.getTime() < bucket.end.getTime()
    ).length;
    return {
      date: bucket.start.toISOString(),
      visits: inBucket.length,
      uniqueVisits: new Set(inBucket.map((v) => v.user_id)).size,
      newAccounts,
      cumulativeAccounts,
    };
  });

  return NextResponse.json({ granularity, series });
}
