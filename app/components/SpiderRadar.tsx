"use client";

import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
} from "recharts";
import type { ScoredRepo } from "@/app/lib/types";

const AXES = [
  { key: "stars", label: "Stars", help: "Higher = more popular." },
  { key: "forks", label: "Forks", help: "Higher = more adoption." },
  { key: "speed", label: "Speed", help: "Higher = faster to ship." },
  { key: "ui", label: "UI", help: "Higher = more polished UI surface." },
  { key: "complexity", label: "Depth", help: "Higher = more substantive codebase." },
  { key: "community", label: "Comm", help: "Higher = more active community." },
] as const;

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
  const top = repos[0];
  const data = AXES.map((axis) => ({
    axis: axis.label,
    value: top ? profile(top)[axis.key] : 0,
    fullMark: 100,
  }));

  return (
    <div className="flex flex-col gap-2">
      <div
        className="aspect-square rounded-xl border p-1"
        style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}
      >
        <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
          <RadarChart data={data} outerRadius="72%" margin={{ top: 4, right: 12, bottom: 4, left: 12 }}>
            <PolarGrid
              stroke="rgba(255,255,255,0.18)"
              strokeDasharray="2 3"
              gridType="polygon"
              radialLines
            />
            <PolarAngleAxis
              dataKey="axis"
              tick={{ fill: "#b3b1c0", fontSize: 9, fontFamily: "ui-monospace, monospace" }}
            />
            <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
            <Radar
              dataKey="value"
              stroke="#f43f8a"
              fill="#f43f8a"
              fillOpacity={0.30}
              strokeWidth={1.8}
              isAnimationActive
              animationDuration={500}
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>
      <div className="flex flex-col gap-1">
        {top ? (
          <div className="flex items-center gap-2 text-[10px] font-mono">
            <span
              className="inline-block h-2 w-2 rounded-full"
              style={{ background: "var(--primary)", boxShadow: "0 0 6px var(--primary-glow)" }}
            />
            <span className="truncate" style={{ color: "var(--fg-muted)" }}>
              {top.fullName}
            </span>
          </div>
        ) : (
          <span className="text-[10px] font-mono" style={{ color: "var(--fg-dim)" }}>
            no repos yet
          </span>
        )}
        <span className="text-[9px] leading-tight" style={{ color: "var(--fg-dim)" }}>
          higher = better on every axis
        </span>
      </div>
    </div>
  );
}
