"use client";

import {
  CartesianGrid,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";
import type { ScoredRepo } from "@/app/lib/types";

export function RadarPlot({
  repos,
  selected,
  onSelect,
}: {
  repos: ScoredRepo[];
  selected?: string;
  onSelect?: (fullName: string) => void;
}) {
  const data = repos.map((r) => ({
    x: r.scores.complexity,
    y: r.scores.uiPotential,
    z: r.stars,
    name: r.fullName,
    isSelected: r.fullName === selected,
  }));

  return (
    <div className="h-72 w-full rounded-xl border border-white/10 bg-zinc-900/40 p-2">
      <ResponsiveContainer width="100%" height="100%">
        <ScatterChart margin={{ top: 16, right: 24, bottom: 24, left: 24 }}>
          <CartesianGrid stroke="#222" strokeDasharray="2 4" />
          <XAxis
            type="number"
            dataKey="x"
            domain={[0, 10]}
            tick={{ fill: "#666", fontSize: 10 }}
            stroke="#444"
            label={{ value: "complexity →", fill: "#666", fontSize: 10, position: "insideBottom", offset: -8 }}
          />
          <YAxis
            type="number"
            dataKey="y"
            domain={[0, 10]}
            tick={{ fill: "#666", fontSize: 10 }}
            stroke="#444"
            label={{ value: "ui potential →", fill: "#666", fontSize: 10, angle: -90, position: "insideLeft" }}
          />
          <ZAxis type="number" dataKey="z" range={[60, 400]} />
          <Tooltip
            contentStyle={{
              background: "#0a0a0a",
              border: "1px solid #2a2a2a",
              borderRadius: 8,
              fontSize: 11,
              fontFamily: "ui-monospace, monospace",
            }}
            cursor={{ stroke: "#444", strokeDasharray: "2 2" }}
            labelFormatter={() => ""}
          />
          <Scatter
            data={data}
            fill="#34d399"
            stroke="#34d399"
            shape={(props: unknown) => {
              const p = props as {
                cx: number;
                cy: number;
                payload: { name: string; isSelected: boolean };
              };
              return (
                <g
                  className="cursor-pointer"
                  onClick={() => onSelect?.(p.payload.name)}
                >
                  <circle
                    cx={p.cx}
                    cy={p.cy}
                    r={p.payload.isSelected ? 9 : 6}
                    fill={p.payload.isSelected ? "#34d399" : "#34d39988"}
                    stroke="#34d399"
                    strokeWidth={p.payload.isSelected ? 2 : 1}
                  />
                  <text
                    x={p.cx + 10}
                    y={p.cy + 3}
                    fill="#aaa"
                    fontSize={10}
                    fontFamily="ui-monospace, monospace"
                  >
                    {p.payload.name.split("/")[1]}
                  </text>
                </g>
              );
            }}
          />
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}
