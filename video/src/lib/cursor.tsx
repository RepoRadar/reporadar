import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";

export type CursorPoint = { x: number; y: number };

// A single hop in a cursor path: arrive at `to` starting on frame `at`,
// optionally "click" (a quick press scale) when `click` is true.
export type CursorStop = CursorPoint & { at: number; click?: boolean };

// Simple arrow pointer drawn as an SVG, no external asset needed.
// The hotspot (the actual pointing pixel) is the top-left tip at (0,0),
// so callers can target exact screen coordinates.
const Pointer: React.FC<{ pressed: number }> = ({ pressed }) => (
  <svg
    width={40}
    height={40}
    viewBox="0 0 24 24"
    style={{
      display: "block",
      transform: `scale(${1 - pressed * 0.18})`,
      transformOrigin: "0 0",
      filter: "drop-shadow(0 4px 8px rgba(0,0,0,0.55))",
    }}
  >
    <path
      d="M2 2 L2 19 L7 14.5 L10.2 21.5 L13 20.2 L9.8 13.3 L16 13 Z"
      fill="#fafafa"
      stroke="#06080d"
      strokeWidth={1.4}
      strokeLinejoin="round"
    />
  </svg>
);

// Animated cursor that springs between a list of stops. Targets are in
// the same coordinate space as whatever container you render it inside
// (use an AbsoluteFill wrapper sized to 1080x1920 for screen coords).
export const Cursor: React.FC<{
  stops: CursorStop[];
  start?: CursorPoint;
}> = ({ stops, start }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const first = stops[0];
  let x = start?.x ?? first.x;
  let y = start?.y ?? first.y;
  let press = 0;

  let prev: CursorPoint = { x: start?.x ?? first.x, y: start?.y ?? first.y };
  for (const stop of stops) {
    const t = spring({
      frame: frame - stop.at,
      fps,
      config: { damping: 26, stiffness: 90, mass: 0.9 },
    });
    x = interpolate(t, [0, 1], [prev.x, stop.x]);
    y = interpolate(t, [0, 1], [prev.y, stop.y]);
    if (stop.click) {
      // Quick press-and-release ~10 frames after arrival.
      const c = frame - (stop.at + 14);
      press = interpolate(c, [0, 4, 8], [0, 1, 0], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      });
    }
    prev = { x: stop.x, y: stop.y };
  }

  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        transform: `translate(${x}px, ${y}px)`,
        pointerEvents: "none",
        zIndex: 50,
      }}
    >
      {/* Click ripple */}
      {press > 0 ? (
        <div
          style={{
            position: "absolute",
            left: 2,
            top: 2,
            width: 44,
            height: 44,
            marginLeft: -22,
            marginTop: -22,
            borderRadius: "50%",
            border: "2px solid rgba(34,197,94,0.9)",
            opacity: press,
            transform: `scale(${1 + (1 - press) * 1.4})`,
          }}
        />
      ) : null}
      <Pointer pressed={press} />
    </div>
  );
};

// Helper: how far through a hop's spring we are (0..1), so other elements
// (a slider fill, a typed field) can react to the cursor "grabbing" them.
export const stopProgress = (
  frame: number,
  fps: number,
  at: number
): number =>
  spring({
    frame: frame - at,
    fps,
    config: { damping: 26, stiffness: 90, mass: 0.9 },
  });
