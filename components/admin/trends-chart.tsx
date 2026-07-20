"use client";

import { useMemo, useRef, useState } from "react";

// Self-contained inline-SVG multi-line trends chart — no charting dependency.
// Three per-period count series share one y-axis (single-axis rule): visits,
// unique visitors, new accounts. Palette is the validated dataviz categorical
// slots 1–3; magenta (slot 3) is below 3:1 on the light surface, so the relief
// rule is satisfied by the always-present legend + direct end-labels.

export type Granularity = "day" | "week" | "month";

export interface TrendPoint {
  date: string;
  visits: number;
  uniqueVisits: number;
  newAccounts: number;
  cumulativeAccounts: number;
}

const SERIES = [
  { key: "visits", label: "Visits", varName: "--series-1" },
  { key: "uniqueVisits", label: "Unique visitors", varName: "--series-2" },
  { key: "newAccounts", label: "New accounts", varName: "--series-3" },
] as const;

const VB_W = 820;
const VB_H = 300;
const PAD = { top: 16, right: 96, bottom: 32, left: 44 };
const PLOT_W = VB_W - PAD.left - PAD.right;
const PLOT_H = VB_H - PAD.top - PAD.bottom;

function niceMax(raw: number): number {
  if (raw <= 4) return 4;
  const pow = Math.pow(10, Math.floor(Math.log10(raw)));
  const n = raw / pow;
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
  return step * pow;
}

function formatDate(iso: string, granularity: Granularity): string {
  const d = new Date(iso);
  if (granularity === "month") {
    return d.toLocaleDateString(undefined, { month: "short", year: "2-digit" });
  }
  return d.toLocaleDateString(undefined, { month: "numeric", day: "numeric" });
}

export function TrendsChart({
  series = [],
  granularity,
}: {
  series: TrendPoint[];
  granularity: Granularity;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [hover, setHover] = useState<number | null>(null);

  const n = series.length;

  const { xFor, yFor, ticks } = useMemo(() => {
    const max = Math.max(
      1,
      ...series.flatMap((p) => [p.visits, p.uniqueVisits, p.newAccounts])
    );
    const yMax = niceMax(max);
    const xFor = (i: number) =>
      PAD.left + (n <= 1 ? PLOT_W / 2 : (i / (n - 1)) * PLOT_W);
    const yFor = (v: number) => PAD.top + PLOT_H - (v / yMax) * PLOT_H;
    const tickCount = 4;
    const ticks = Array.from({ length: tickCount + 1 }, (_, k) =>
      Math.round((yMax / tickCount) * k)
    );
    return { xFor, yFor, ticks };
  }, [series, n]);

  if (n === 0) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
        No activity in this range yet.
      </div>
    );
  }

  // X-axis labels: show at most ~8 evenly spaced ticks so they don't collide.
  const labelStride = Math.max(1, Math.ceil(n / 8));

  function handleMove(e: React.MouseEvent<SVGSVGElement>) {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    const x = ratio * VB_W;
    const i = Math.round(((x - PAD.left) / PLOT_W) * (n - 1));
    setHover(Math.min(n - 1, Math.max(0, i)));
  }

  const hoverPoint = hover != null ? series[hover] : null;

  return (
    <div
      className="viz-root relative w-full"
      style={
        {
          "--series-1": "#2a78d6",
          "--series-2": "#008300",
          "--series-3": "#e87ba4",
        } as React.CSSProperties
      }
    >
      {/* Dark-mode steps of the same three hues, validated against the dark
          surface. Media query covers the OS setting; the data-theme scope covers
          the app's theme toggle and must win both ways. */}
      <style>{`
        :root[data-theme="dark"] .viz-root { --series-1:#3987e5; --series-2:#008300; --series-3:#d55181; }
        @media (prefers-color-scheme: dark) {
          :root:not([data-theme="light"]) .viz-root { --series-1:#3987e5; --series-2:#008300; --series-3:#d55181; }
        }
      `}</style>

      <svg
        ref={svgRef}
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        className="w-full"
        style={{ height: "auto" }}
        role="img"
        aria-label="Trends of visits, unique visitors, and new accounts over time"
        onMouseMove={handleMove}
        onMouseLeave={() => setHover(null)}
      >
        {/* Y gridlines + labels */}
        {ticks.map((t) => {
          const y = yFor(t);
          return (
            <g key={t}>
              <line
                x1={PAD.left}
                x2={PAD.left + PLOT_W}
                y1={y}
                y2={y}
                stroke="currentColor"
                className="text-border"
                strokeWidth={1}
              />
              <text
                x={PAD.left - 8}
                y={y + 4}
                textAnchor="end"
                className="fill-muted-foreground"
                fontSize={11}
              >
                {t}
              </text>
            </g>
          );
        })}

        {/* X labels */}
        {series.map((p, i) =>
          i % labelStride === 0 || i === n - 1 ? (
            <text
              key={p.date}
              x={xFor(i)}
              y={VB_H - 10}
              textAnchor="middle"
              className="fill-muted-foreground"
              fontSize={11}
            >
              {formatDate(p.date, granularity)}
            </text>
          ) : null
        )}

        {/* Hover crosshair */}
        {hover != null && (
          <line
            x1={xFor(hover)}
            x2={xFor(hover)}
            y1={PAD.top}
            y2={PAD.top + PLOT_H}
            stroke="currentColor"
            className="text-muted-foreground"
            strokeWidth={1}
            strokeDasharray="3 3"
          />
        )}

        {/* Series lines + end labels */}
        {SERIES.map((s) => {
          const color = `var(${s.varName})`;
          const pts = series.map((p, i) => `${xFor(i)},${yFor(p[s.key])}`).join(" ");
          const lastI = n - 1;
          const lastVal = series[lastI][s.key];
          return (
            <g key={s.key}>
              <polyline
                points={pts}
                fill="none"
                stroke={color}
                strokeWidth={2}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
              {/* Direct end-label (secondary encoding / relief for slot 3) */}
              <circle cx={xFor(lastI)} cy={yFor(lastVal)} r={3.5} fill={color} />
              <text
                x={xFor(lastI) + 8}
                y={yFor(lastVal) + 4}
                fontSize={11}
                fill={color}
              >
                {s.label}
              </text>
              {/* Hover marker */}
              {hover != null && (
                <circle
                  cx={xFor(hover)}
                  cy={yFor(series[hover][s.key])}
                  r={4}
                  fill={color}
                  stroke="var(--surface-ring, #fff)"
                  strokeWidth={1.5}
                />
              )}
            </g>
          );
        })}
      </svg>

      {/* Tooltip */}
      {hoverPoint && hover != null && (
        <div
          className="pointer-events-none absolute top-2 z-10 -translate-x-1/2 rounded-md border border-border bg-popover px-3 py-2 text-xs shadow-md"
          style={{ left: `${(xFor(hover) / VB_W) * 100}%` }}
        >
          <div className="mb-1 font-medium text-foreground">
            {formatDate(hoverPoint.date, granularity)}
          </div>
          {SERIES.map((s) => (
            <div key={s.key} className="flex items-center gap-2 tabular-nums">
              <span
                className="inline-block h-2 w-2 rounded-full"
                style={{ background: `var(${s.varName})` }}
              />
              <span className="text-muted-foreground">{s.label}</span>
              <span className="ml-auto font-medium text-foreground">
                {hoverPoint[s.key]}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Legend (always present for >= 2 series) */}
      <div className="mt-2 flex flex-wrap gap-4 pl-11 text-xs text-muted-foreground">
        {SERIES.map((s) => (
          <span key={s.key} className="flex items-center gap-1.5">
            <span
              className="inline-block h-2.5 w-2.5 rounded-full"
              style={{ background: `var(${s.varName})` }}
            />
            {s.label}
          </span>
        ))}
      </div>
    </div>
  );
}
