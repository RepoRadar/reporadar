import React from "react";
import {
  AbsoluteFill,
  Img,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { C } from "../theme";
import { BrowserCard, MONO, Rise } from "./primitives";

// A caption line that fades + rises in, holds, then fades out. Times are in
// frames relative to the scene. Used for the bookend voice-of-the-ad copy.
const Caption: React.FC<{
  from: number;
  to: number;
  children: React.ReactNode;
  size?: number;
  color?: string;
  weight?: number;
}> = ({ from, to, children, size = 64, color = C.fg, weight = 800 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const inS = spring({ frame: frame - from, fps, config: { damping: 200 } });
  const outS = interpolate(frame, [to - 10, to], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const op = Math.min(inS, outS);
  if (frame < from || frame > to + 2) return null;
  return (
    <div
      style={{
        fontSize: size,
        fontWeight: weight,
        color,
        lineHeight: 1.15,
        opacity: op,
        transform: `translateY(${(1 - inS) * 26}px)`,
        textAlign: "center",
      }}
    >
      {children}
    </div>
  );
};

// ===========================================================================
// ColdOpen (~4s at 30fps = 120 frames)
// The create-react-app chat screenshot in a browser frame, captions stack
// the hook: stars are loud, the README says deprecated, stars are not a vote
// for your stack.
// ===========================================================================
export const COLD_OPEN_DUR = 132;

export const ColdOpen: React.FC = () => {
  const frame = useCurrentFrame();
  // Slow push toward the score column / deprecated badge.
  const scale = interpolate(frame, [0, COLD_OPEN_DUR], [1.02, 1.12]);
  const shift = interpolate(frame, [0, COLD_OPEN_DUR], [0, -40]);

  // AUDIO: cold-open music sting here; a single low pulse on each caption.
  // AUDIO: subtle UI "tick" SFX when the "deprecated" caption hits.
  return (
    <AbsoluteFill style={{ background: C.bg }}>
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(120% 55% at 50% 0%, rgba(34,197,94,0.10), transparent 60%)",
        }}
      />
      {/* Screenshot, pushed in behind the captions and dimmed so text reads. */}
      <AbsoluteFill
        style={{
          justifyContent: "center",
          alignItems: "center",
          transform: `scale(${scale}) translateY(${shift}px)`,
        }}
      >
        <div style={{ position: "relative" }}>
          <BrowserCard
            src={staticFile("cra.png")}
            dur={COLD_OPEN_DUR}
            url="reporadar.io/chat/facebook/create-react-app"
            width={1000}
            zoom={false}
          />
          <AbsoluteFill style={{ background: "rgba(6,8,13,0.42)" }} />
        </div>
      </AbsoluteFill>

      {/* Stacked captions */}
      <AbsoluteFill
        style={{
          justifyContent: "center",
          alignItems: "center",
          padding: "0 80px",
        }}
      >
        <div style={{ height: 380, position: "relative", width: "100%" }}>
          <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
            <Caption from={6} to={48} size={132} color={C.fg} weight={900}>
              <span style={{ fontVariantNumeric: "tabular-nums" }}>103,000</span>
              <div style={{ fontSize: 48, color: C.muted, fontWeight: 700, marginTop: 8 }}>
                stars.
              </div>
            </Caption>
          </AbsoluteFill>
          <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
            <Caption from={50} to={92} size={62}>
              Its own README says:{" "}
              <span style={{ color: C.danger }}>deprecated.</span>
            </Caption>
          </AbsoluteFill>
          <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
            <Caption from={94} to={COLD_OPEN_DUR} size={56} color={C.muted} weight={700}>
              Stars are the crowd's vote.
              <div style={{ color: C.fg, marginTop: 10, fontWeight: 800 }}>
                Not a vote for your stack.
              </div>
            </Caption>
          </AbsoluteFill>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ===========================================================================
// Close (~4s)
// "Your taste + our tools", "Stop scrolling. Start building.", the mark,
// and reporadar.io.
// ===========================================================================
export const CLOSE_DUR = 120;

export const Close: React.FC = () => {
  // AUDIO: resolve the music here; final downbeat lands on the wordmark.
  return (
    <AbsoluteFill style={{ background: C.bg }}>
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(120% 60% at 50% 30%, rgba(34,197,94,0.14), transparent 62%)",
        }}
      />
      <AbsoluteFill
        style={{
          justifyContent: "center",
          alignItems: "center",
          gap: 30,
          textAlign: "center",
          padding: "0 80px",
        }}
      >
        <Rise>
          <div style={{ fontSize: 70, fontWeight: 800, color: C.fg }}>
            Your taste <span style={{ color: C.primary }}>+</span> our tools
          </div>
        </Rise>
        <Rise delay={16}>
          <div style={{ fontSize: 46, color: C.muted }}>
            Stop scrolling. Start building.
          </div>
        </Rise>
        <Rise delay={34}>
          <Img
            src={staticFile("reporadar-mark.svg")}
            style={{
              width: 200,
              marginTop: 24,
              filter: "drop-shadow(0 0 50px rgba(34,197,94,0.45))",
            }}
          />
        </Rise>
        <Rise delay={48}>
          <div
            style={{
              fontFamily: MONO,
              fontSize: 44,
              fontWeight: 700,
              marginTop: 8,
              letterSpacing: 1,
            }}
          >
            <span style={{ color: C.fg }}>repo</span>
            <span style={{ color: C.primary }}>radar.io</span>
          </div>
        </Rise>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
