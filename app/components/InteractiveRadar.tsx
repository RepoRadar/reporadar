"use client";

import { useEffect, useRef, useState } from "react";
import {
  DIMENSION_META,
  DIMENSION_ORDER,
  type Dimension,
  type DimensionWeights,
} from "@/app/lib/types";

// Dimension labels grew to full phrases per design feedback — bumped the
// canvas + padding so axis text doesn't clip at the edges.
const SIZE = 320;
const CENTER = SIZE / 2;
const RING_COUNT = 4;
const PADDING = 70; // headroom for axis labels around the polygon
const MAX_RADIUS = SIZE / 2 - PADDING;
const HANDLE_RADIUS = 6;

// Decagon angles — first axis at top, going clockwise.
const ANGLES = DIMENSION_ORDER.map((_, i) => -Math.PI / 2 + (i * 2 * Math.PI) / DIMENSION_ORDER.length);

function polar(weight: number, angleIdx: number) {
  const a = ANGLES[angleIdx];
  const r = Math.max(0, Math.min(1, weight)) * MAX_RADIUS;
  return { x: CENTER + r * Math.cos(a), y: CENTER + r * Math.sin(a) };
}

function labelPos(angleIdx: number) {
  const a = ANGLES[angleIdx];
  const r = MAX_RADIUS + 14;
  return { x: CENTER + r * Math.cos(a), y: CENTER + r * Math.sin(a) };
}

export function InteractiveRadar({
  weights,
  onChange,
}: {
  weights: DimensionWeights;
  onChange: (next: DimensionWeights) => void;
}) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [draggingDim, setDraggingDim] = useState<Dimension | null>(null);

  // Polygon path computed from current weights.
  const verts = DIMENSION_ORDER.map((dim, i) => polar(weights[dim], i));
  const poly = verts.map((v) => `${v.x},${v.y}`).join(" ");

  useEffect(() => {
    if (!draggingDim) return;
    const svg = svgRef.current;
    if (!svg) return;

    const handleMove = (e: PointerEvent) => {
      const rect = svg.getBoundingClientRect();
      const px = ((e.clientX - rect.left) / rect.width) * SIZE;
      const py = ((e.clientY - rect.top) / rect.height) * SIZE;
      const dx = px - CENTER;
      const dy = py - CENTER;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const w = Math.max(0, Math.min(1, dist / MAX_RADIUS));
      onChange({ ...weights, [draggingDim]: w });
    };

    const handleUp = () => setDraggingDim(null);

    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
    };
  }, [draggingDim, onChange, weights]);

  return (
    <div className="flex flex-col gap-2">
      <div
        className="aspect-square w-full rounded-xl border p-1"
        style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}
      >
        <svg
          ref={svgRef}
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          className="h-full w-full"
          style={{ touchAction: "none", overflow: "visible" }}
        >
          {/* Concentric rings */}
          {Array.from({ length: RING_COUNT }, (_, i) => {
            const r = ((i + 1) / RING_COUNT) * MAX_RADIUS;
            const ringPoly = ANGLES.map((a) => `${CENTER + r * Math.cos(a)},${CENTER + r * Math.sin(a)}`).join(" ");
            return (
              <polygon
                key={i}
                points={ringPoly}
                fill="none"
                stroke="rgba(255,255,255,0.08)"
                strokeWidth={1}
                strokeDasharray="2 3"
              />
            );
          })}

          {/* Spokes from center to each axis label */}
          {DIMENSION_ORDER.map((dim, i) => {
            const a = ANGLES[i];
            const x = CENTER + MAX_RADIUS * Math.cos(a);
            const y = CENTER + MAX_RADIUS * Math.sin(a);
            return (
              <line
                key={dim + "-spoke"}
                x1={CENTER}
                y1={CENTER}
                x2={x}
                y2={y}
                stroke="rgba(255,255,255,0.10)"
                strokeWidth={1}
              />
            );
          })}

          {/* Filled polygon for current weights */}
          <polygon
            points={poly}
            fill="rgba(34, 197, 94, 0.30)"
            stroke="rgba(34, 197, 94, 0.85)"
            strokeWidth={1.6}
            strokeLinejoin="round"
            style={{ transition: draggingDim ? "none" : "all 0.25s ease" }}
          />

          {/* Draggable vertex handles */}
          {DIMENSION_ORDER.map((dim, i) => {
            const v = verts[i];
            const active = draggingDim === dim;
            return (
              <g key={dim + "-handle"}>
                <circle
                  cx={v.x}
                  cy={v.y}
                  r={active ? HANDLE_RADIUS + 3 : HANDLE_RADIUS}
                  fill={active ? "#22c55e" : "rgba(34,197,94,0.85)"}
                  stroke="#08070d"
                  strokeWidth={1.5}
                  style={{
                    cursor: "grab",
                    filter: active
                      ? "drop-shadow(0 0 12px rgba(34,197,94,0.9))"
                      : "drop-shadow(0 0 4px rgba(34,197,94,0.45))",
                    transition: active ? "none" : "all 0.2s ease",
                  }}
                  onPointerDown={(e) => {
                    e.preventDefault();
                    (e.currentTarget as SVGCircleElement).setPointerCapture(e.pointerId);
                    setDraggingDim(dim);
                  }}
                />
              </g>
            );
          })}

          {/* Axis labels */}
          {DIMENSION_ORDER.map((dim, i) => {
            const p = labelPos(i);
            const a = ANGLES[i];
            // Anchor labels based on quadrant for clean positioning.
            const cos = Math.cos(a);
            const sin = Math.sin(a);
            const anchor = cos > 0.4 ? "start" : cos < -0.4 ? "end" : "middle";
            const baseline = sin > 0.4 ? "hanging" : sin < -0.4 ? "auto" : "middle";
            return (
              <text
                key={dim + "-label"}
                x={p.x}
                y={p.y}
                fill="#b3b1c0"
                fontSize="9"
                fontFamily="ui-monospace, monospace"
                textAnchor={anchor}
                dominantBaseline={baseline}
              >
                <title>{DIMENSION_META[dim].help}</title>
                {DIMENSION_META[dim].short}
              </text>
            );
          })}
        </svg>
      </div>
      <span className="text-[9px] leading-tight" style={{ color: "var(--fg-dim)" }}>
        Drag vertices to tune · 10 axes · higher = better
      </span>
    </div>
  );
}
