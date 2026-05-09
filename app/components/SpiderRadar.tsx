"use client";

import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
} from "recharts";
import { DIMENSION_META, DIMENSION_ORDER } from "@/app/lib/types";
import type { ScoredRepo } from "@/app/lib/types";

export function SpiderRadar({ repos }: { repos: ScoredRepo[] }) {
  const top = repos[0];
  const data = DIMENSION_ORDER.map((dim) => ({
    axis: DIMENSION_META[dim].short,
    fullName: DIMENSION_META[dim].label,
    value: top ? top.dimensions[dim] : 0,
    fullMark: 100,
  }));

  return (
    <div className="flex flex-col gap-2">
      <div
        className="aspect-square rounded-xl border p-1"
        style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}
      >
        <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
          <RadarChart
            data={data}
            outerRadius="70%"
            margin={{ top: 6, right: 14, bottom: 6, left: 14 }}
          >
            <PolarGrid
              stroke="rgba(255,255,255,0.18)"
              strokeDasharray="2 3"
              gridType="polygon"
              radialLines
            />
            <PolarAngleAxis
              dataKey="axis"
              tick={{ fill: "#b3b1c0", fontSize: 8.5, fontFamily: "ui-monospace, monospace" }}
            />
            <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
            <Radar
              dataKey="value"
              stroke="#f43f8a"
              fill="#f43f8a"
              fillOpacity={0.32}
              strokeWidth={1.8}
              isAnimationActive
              animationDuration={500}
              dot={{ r: 2, fill: "#f43f8a", stroke: "#08070d", strokeWidth: 1 }}
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
            <span className="truncate" style={{ color: "var(--fg-muted)" }} title={top.fullName}>
              {top.fullName}
            </span>
          </div>
        ) : (
          <span className="text-[10px] font-mono" style={{ color: "var(--fg-dim)" }}>
            no repos yet
          </span>
        )}
        <span className="text-[9px] leading-tight" style={{ color: "var(--fg-dim)" }}>
          10 axes · higher = better
        </span>
      </div>
    </div>
  );
}
