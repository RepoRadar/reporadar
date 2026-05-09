"use client";

import {
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  ResponsiveContainer,
} from "recharts";
import type { ScoredRepo } from "@/app/lib/types";

const AXES = [
  { key: "stars", label: "Stars" },
  { key: "forks", label: "Forks" },
  { key: "speed", label: "Speed" },
  { key: "ui", label: "UI" },
  { key: "complexity", label: "Complex" },
  { key: "community", label: "Comm" },
] as const;

const COLORS = [
  { stroke: "#f43f8a", fill: "#f43f8a" }, // primary pink
  { stroke: "#22d3ee", fill: "#22d3ee" }, // secondary cyan
  { stroke: "#fbbf24", fill: "#fbbf24" }, // accent amber
];

const log10n = (n: number, ceiling: number) =>
  Math.max(0, Math.min(100, (Math.log10(Math.max(1, n)) / Math.log10(ceiling)) * 100));

function profile(r: ScoredRepo) {
  return {
    stars: log10n(r.stars, 100000),
    forks: log10n(r.forks, 20000),
    speed: r.scores.speedToBuild * 100,
    ui: r.scores.uiPotential * 10,
    complexity: r.scores.complexity * 10,
    community: r.scores.communityEngagement * 100,
  };
}

export function SpiderRadar({ repos }: { repos: ScoredRepo[] }) {
  const slice = repos.slice(0, 3);
  const data = AXES.map((axis) => {
    const row: Record<string, number | string> = { axis: axis.label };
    slice.forEach((r, i) => {
      row[`r${i}`] = profile(r)[axis.key];
    });
    return row;
  });

  return (
    <div className="flex flex-col gap-2">
      <div
        className="aspect-square rounded-xl border p-1"
        style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}
      >
        <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
          <RadarChart data={data} outerRadius="72%" margin={{ top: 4, right: 12, bottom: 4, left: 12 }}>
            <PolarGrid stroke="rgba(255,255,255,0.10)" />
            <PolarAngleAxis
              dataKey="axis"
              tick={{ fill: "#b3b1c0", fontSize: 9, fontFamily: "ui-monospace, monospace" }}
            />
            {slice.map((_, i) => (
              <Radar
                key={i}
                dataKey={`r${i}`}
                stroke={COLORS[i].stroke}
                fill={COLORS[i].fill}
                fillOpacity={0.18}
                strokeWidth={1.5}
                isAnimationActive
                animationDuration={400}
              />
            ))}
          </RadarChart>
        </ResponsiveContainer>
      </div>
      <div className="flex flex-col gap-1">
        {slice.map((r, i) => (
          <div key={r.fullName} className="flex items-center gap-2 text-[10px] font-mono">
            <span
              className="inline-block h-2 w-2 rounded-full"
              style={{ background: COLORS[i].stroke, boxShadow: `0 0 6px ${COLORS[i].stroke}` }}
            />
            <span className="truncate" style={{ color: "var(--fg-muted)" }}>
              {r.fullName}
            </span>
          </div>
        ))}
        {slice.length === 0 && (
          <span className="text-[10px] font-mono" style={{ color: "var(--fg-dim)" }}>
            no repos yet
          </span>
        )}
      </div>
    </div>
  );
}
