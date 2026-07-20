"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { TrendsChart, type Granularity, type TrendPoint } from "./trends-chart";
import { AccountDetailDialog } from "./account-detail-dialog";

const RANGES = [
  { key: "7d", label: "7 days" },
  { key: "30d", label: "30 days" },
  { key: "3m", label: "3 months" },
  { key: "1y", label: "1 year" },
  { key: "all", label: "All time" },
] as const;

type RangeKey = (typeof RANGES)[number]["key"];

// account_visits/auth timestamps are full ISO timestamptz strings — format the
// calendar date only.
function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

interface Overview {
  totalAccounts: number;
  visits: number;
  uniqueVisits: number;
}

interface AccountRow {
  id: string;
  email: string;
  name: string;
  stage: string | null;
  createdAt: string | null;
}

function MetricCard({ label, value }: { label: string; value: number | null }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-3xl font-semibold tabular-nums text-foreground">
          {value == null ? "—" : value.toLocaleString()}
        </p>
      </CardContent>
    </Card>
  );
}

export function AdminDashboard() {
  const [range, setRange] = useState<RangeKey>("30d");
  const [overview, setOverview] = useState<Overview | null>(null);
  const [trends, setTrends] = useState<{ granularity: Granularity; series: TrendPoint[] } | null>(null);
  const [accounts, setAccounts] = useState<AccountRow[] | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let ignore = false;
    // Data updates land in these callbacks (post-await), so stale numbers are
    // shown briefly on range change rather than flashing a spinner.
    Promise.all([
      fetch(`/api/admin/overview?range=${range}`).then((res) => res.json()),
      fetch(`/api/admin/trends?range=${range}`).then((res) => res.json()),
    ])
      .then(([ov, tr]) => {
        if (ignore) return;
        setOverview(ov && typeof ov.visits === "number" ? ov : null);
        // Guard against an error-shaped response (e.g. before the migration):
        // only accept a payload that actually carries a series array.
        setTrends(Array.isArray(tr?.series) ? tr : { granularity: "day", series: [] });
      })
      .catch(() => !ignore && setError("Failed to load metrics."));
    return () => {
      ignore = true;
    };
  }, [range]);

  useEffect(() => {
    fetch("/api/admin/accounts")
      .then((res) => res.json())
      .then((json) => setAccounts(json.accounts))
      .catch(() => setError("Failed to load accounts."));
  }, []);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* Range selector */}
      <div className="flex flex-wrap items-center gap-2">
        {RANGES.map((r) => (
          <button
            key={r.key}
            onClick={() => setRange(r.key)}
            className={
              range === r.key
                ? "rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground"
                : "rounded-md border border-border px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-muted"
            }
          >
            {r.label}
          </button>
        ))}
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {/* Metric cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <MetricCard label="New accounts" value={overview?.totalAccounts ?? null} />
        <MetricCard label="Account visits" value={overview?.visits ?? null} />
        <MetricCard label="Unique visitors" value={overview?.uniqueVisits ?? null} />
      </div>

      {/* Trends chart */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-foreground">
            Trends
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!trends ? (
            <div className="flex h-64 items-center justify-center">
              <Spinner />
            </div>
          ) : (
            <TrendsChart series={trends.series} granularity={trends.granularity} />
          )}
        </CardContent>
      </Card>

      {/* Accounts table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-foreground">
            Accounts{" "}
            {accounts && (
              <span className="text-muted-foreground">({accounts.length})</span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!accounts ? (
            <div className="flex h-24 items-center justify-center">
              <Spinner />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="px-3 py-2 font-medium">Name</th>
                    <th className="px-3 py-2 font-medium">Email</th>
                    <th className="px-3 py-2 font-medium">Stage</th>
                    <th className="px-3 py-2 font-medium">Joined</th>
                  </tr>
                </thead>
                <tbody>
                  {accounts.map((a) => (
                    <tr
                      key={a.id}
                      onClick={() => setSelected(a.id)}
                      className="cursor-pointer border-b border-border last:border-0 hover:bg-muted/50"
                    >
                      <td className="px-3 py-2.5 font-medium text-foreground">{a.name}</td>
                      <td className="px-3 py-2.5 text-muted-foreground">{a.email}</td>
                      <td className="px-3 py-2.5">
                        {a.stage ? (
                          <Badge variant="outline">{a.stage}</Badge>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 tabular-nums text-muted-foreground">
                        {fmtDate(a.createdAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {selected && (
        <AccountDetailDialog
          key={selected}
          accountId={selected}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}
