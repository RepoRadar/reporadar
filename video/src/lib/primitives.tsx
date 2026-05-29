import React from "react";
import {
  AbsoluteFill,
  Img,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { C } from "../theme";

// Shared monospace stack, matching RepoRadarExplainer.
export const MONO = "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";

// Background wash, identical to the explainer's <Bg />.
export const Bg: React.FC = () => (
  <AbsoluteFill style={{ background: C.bg }}>
    <AbsoluteFill
      style={{
        background:
          "radial-gradient(120% 55% at 50% 0%, rgba(34,197,94,0.12), transparent 60%)",
      }}
    />
  </AbsoluteFill>
);

// Per-scene cross-fade at the edges. Lifted from the explainer so every
// scene in the campaign shares the same entrance/exit feel.
export const Scene: React.FC<{ dur: number; children: React.ReactNode }> = ({
  dur,
  children,
}) => {
  const frame = useCurrentFrame();
  const fadeIn = interpolate(frame, [0, 12], [0, 1], {
    extrapolateRight: "clamp",
  });
  const fadeOut = interpolate(frame, [dur - 12, dur], [1, 0], {
    extrapolateLeft: "clamp",
  });
  return (
    <AbsoluteFill style={{ opacity: Math.min(fadeIn, fadeOut) }}>
      {children}
    </AbsoluteFill>
  );
};

// Spring-driven rise + fade entrance.
export const Rise: React.FC<{ delay?: number; children: React.ReactNode }> = ({
  delay = 0,
  children,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame: frame - delay, fps, config: { damping: 200 } });
  return (
    <div style={{ opacity: s, transform: `translateY(${(1 - s) * 40}px)` }}>
      {children}
    </div>
  );
};

export const Eyebrow: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => (
  <div
    style={{
      fontFamily: MONO,
      fontSize: 26,
      letterSpacing: 4,
      textTransform: "uppercase",
      color: C.primary,
    }}
  >
    {children}
  </div>
);

const Dot: React.FC = () => (
  <div
    style={{
      width: 14,
      height: 14,
      borderRadius: 7,
      background: "rgba(255,255,255,0.18)",
    }}
  />
);

// Floating browser window holding a real product screenshot.
// `zoom` adds the slow Ken Burns push used in the explainer; turn it off
// when the cursor needs stable pixel coordinates to point at.
export const BrowserCard: React.FC<{
  src: string;
  dur: number;
  chrome?: boolean;
  width?: number;
  url?: string;
  zoom?: boolean;
  zoomTo?: number;
}> = ({
  src,
  dur,
  chrome = true,
  width = 940,
  url = "reporadar.io",
  zoom = true,
  zoomTo = 1.08,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame, fps, config: { damping: 200 } });
  const scale = zoom ? interpolate(frame, [0, dur], [1.0, zoomTo]) : 1;
  return (
    <div
      style={{
        width,
        borderRadius: 22,
        overflow: "hidden",
        border: `1px solid ${C.borderStrong}`,
        boxShadow: "0 40px 120px rgba(0,0,0,0.6)",
        background: C.surface,
        opacity: enter,
        transform: `translateY(${(1 - enter) * 70}px)`,
      }}
    >
      {chrome ? (
        <div
          style={{
            height: 46,
            display: "flex",
            alignItems: "center",
            gap: 9,
            padding: "0 18px",
            background: C.surface2,
            borderBottom: `1px solid ${C.border}`,
          }}
        >
          <Dot />
          <Dot />
          <Dot />
          <div
            style={{
              marginLeft: 14,
              color: C.dim,
              fontFamily: MONO,
              fontSize: 18,
            }}
          >
            {url}
          </div>
        </div>
      ) : null}
      <div style={{ overflow: "hidden" }}>
        <Img
          src={src}
          style={{
            width: "100%",
            display: "block",
            transform: `scale(${scale})`,
            transformOrigin: "top center",
          }}
        />
      </div>
    </div>
  );
};

// Value-colored verdict: matches the app's score-bar rule.
// red below 40, amber 40 to 69, green at 70 and up.
export const verdictColor = (pct: number): string =>
  pct >= 70 ? C.primary : pct >= 40 ? C.accent : C.danger;
