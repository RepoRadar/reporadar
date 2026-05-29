import React from "react";
import {
  AbsoluteFill,
  Img,
  Sequence,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { loadFont } from "@remotion/google-fonts/Inter";
import { C, SCORE_GRADIENT } from "./theme";

const { fontFamily } = loadFont();
const MONO = "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";

export const FPS = 30;

// Scene timeline (frames). Keep in sync with the <Sequence> blocks below.
const SCENES = {
  intro: { from: 0, dur: 96 },
  problem: { from: 96, dur: 120 },
  search: { from: 216, dur: 180 },
  tune: { from: 396, dur: 192 },
  alerts: { from: 588, dur: 156 },
  ask: { from: 744, dur: 180 },
  deploy: { from: 924, dur: 156 },
  win: { from: 1080, dur: 240 },
} as const;

export const EXPLAINER_DURATION = SCENES.win.from + SCENES.win.dur; // 1320 = 44s

// --- Primitives -------------------------------------------------------------

const Bg: React.FC = () => (
  <AbsoluteFill style={{ background: C.bg }}>
    <AbsoluteFill
      style={{
        background:
          "radial-gradient(120% 55% at 50% 0%, rgba(34,197,94,0.12), transparent 60%)",
      }}
    />
  </AbsoluteFill>
);

// Per-scene cross-fade at the edges.
const Scene: React.FC<{ dur: number; children: React.ReactNode }> = ({
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
const Rise: React.FC<{ delay?: number; children: React.ReactNode }> = ({
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

const Eyebrow: React.FC<{ children: React.ReactNode }> = ({ children }) => (
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
    style={{ width: 14, height: 14, borderRadius: 7, background: "rgba(255,255,255,0.18)" }}
  />
);

// Floating browser window holding a real product screenshot, with a slow zoom.
const BrowserCard: React.FC<{ src: string; dur: number }> = ({ src, dur }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame, fps, config: { damping: 200 } });
  const scale = interpolate(frame, [0, dur], [1.0, 1.08]);
  return (
    <div
      style={{
        width: 940,
        borderRadius: 22,
        overflow: "hidden",
        border: `1px solid ${C.borderStrong}`,
        boxShadow: "0 40px 120px rgba(0,0,0,0.6)",
        background: C.surface,
        opacity: enter,
        transform: `translateY(${(1 - enter) * 70}px)`,
      }}
    >
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
        <div style={{ marginLeft: 14, color: C.dim, fontFamily: MONO, fontSize: 18 }}>
          reporadar.io
        </div>
      </div>
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

const ScoreRow: React.FC<{ label: string; pct: number; delay: number }> = ({
  label,
  pct,
  delay,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame: frame - delay, fps, config: { damping: 200 } });
  const w = interpolate(s, [0, 1], [0, pct]);
  return (
    <div style={{ marginBottom: 24, opacity: interpolate(s, [0, 0.15], [0, 1], { extrapolateLeft: "clamp" }) }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          fontFamily: MONO,
          fontSize: 26,
          color: C.muted,
          marginBottom: 10,
        }}
      >
        <span>{label}</span>
        <span style={{ color: C.fg }}>{Math.round(w)}</span>
      </div>
      <div style={{ height: 16, borderRadius: 8, background: "rgba(255,255,255,0.06)", overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${w}%`, background: SCORE_GRADIENT, borderRadius: 8 }} />
      </div>
    </div>
  );
};

// --- Scenes -----------------------------------------------------------------

const Intro: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame, fps, config: { damping: 200 } });
  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", gap: 44 }}>
      <Img
        src={staticFile("reporadar-mark.svg")}
        style={{
          width: 340,
          opacity: s,
          transform: `scale(${interpolate(s, [0, 1], [0.6, 1])})`,
          filter: "drop-shadow(0 0 50px rgba(34,197,94,0.45))",
        }}
      />
      <Rise delay={10}>
        <div style={{ fontSize: 100, fontWeight: 800, letterSpacing: -2 }}>
          <span style={{ color: C.fg }}>Repo</span>
          <span style={{ color: C.primary }}>Radar</span>
        </div>
      </Rise>
      <Rise delay={22}>
        <div style={{ fontSize: 40, color: C.muted }}>Stop scrolling. Start building.</div>
      </Rise>
    </AbsoluteFill>
  );
};

const Problem: React.FC = () => (
  <AbsoluteFill style={{ justifyContent: "center", padding: "0 90px", gap: 26 }}>
    <Rise>
      <div style={{ fontSize: 66, fontWeight: 800, color: C.fg, lineHeight: 1.1 }}>
        Hundreds of repos trend every day.
      </div>
    </Rise>
    <Rise delay={16}>
      <div style={{ fontSize: 66, fontWeight: 800, color: C.primary, lineHeight: 1.1 }}>
        Almost none matter to you.
      </div>
    </Rise>
    <Rise delay={34}>
      <div style={{ fontSize: 36, color: C.muted, marginTop: 12 }}>
        RepoRadar finds the few that do.
      </div>
    </Rise>
  </AbsoluteFill>
);

const PillarShot: React.FC<{
  n: number;
  title: string;
  sub: string;
  src: string;
  dur: number;
}> = ({ n, title, sub, src, dur }) => (
  <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", padding: "0 70px" }}>
    <div style={{ width: 940, marginBottom: 40 }}>
      <Rise>
        <Eyebrow>{`Pillar ${n}`}</Eyebrow>
      </Rise>
      <Rise delay={6}>
        <div style={{ fontSize: 62, fontWeight: 800, color: C.fg, lineHeight: 1.05, marginTop: 12 }}>
          {title}
        </div>
      </Rise>
      <Rise delay={14}>
        <div style={{ fontSize: 32, color: C.muted, marginTop: 16 }}>{sub}</div>
      </Rise>
    </div>
    <BrowserCard src={src} dur={dur} />
  </AbsoluteFill>
);

const Tune: React.FC = () => (
  <AbsoluteFill style={{ justifyContent: "center", padding: "0 90px" }}>
    <div style={{ marginBottom: 54 }}>
      <Rise>
        <Eyebrow>Pillar 2</Eyebrow>
      </Rise>
      <Rise delay={6}>
        <div style={{ fontSize: 62, fontWeight: 800, color: C.fg, marginTop: 12 }}>
          Ten dimensions. You tune them.
        </div>
      </Rise>
      <Rise delay={14}>
        <div style={{ fontSize: 32, color: C.muted, marginTop: 16 }}>
          Move the sliders, the ranking moves with you.
        </div>
      </Rise>
    </div>
    <div>
      <ScoreRow label="Documentation Quality" pct={92} delay={20} />
      <ScoreRow label="Community Engagement" pct={100} delay={28} />
      <ScoreRow label="Security & Trust" pct={65} delay={36} />
      <ScoreRow label="Shipping Velocity" pct={100} delay={44} />
      <ScoreRow label="Production Readiness" pct={49} delay={52} />
    </div>
  </AbsoluteFill>
);

const Alerts: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const sent = spring({ frame: frame - 64, fps, config: { damping: 200 } });
  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", padding: "0 90px", gap: 54 }}>
      <div style={{ textAlign: "center" }}>
        <Rise>
          <Eyebrow>Pillar 3</Eyebrow>
        </Rise>
        <Rise delay={6}>
          <div style={{ fontSize: 62, fontWeight: 800, color: C.fg, marginTop: 12 }}>
            Set a threshold. We watch for you.
          </div>
        </Rise>
      </div>
      <Rise delay={20}>
        <div
          style={{
            width: 860,
            padding: 40,
            borderRadius: 22,
            background: C.surface,
            border: `1px solid ${C.borderStrong}`,
          }}
        >
          <div style={{ fontFamily: MONO, fontSize: 30, color: C.dim, marginBottom: 20 }}>
            WHEN
          </div>
          <div style={{ fontSize: 46, fontWeight: 700, color: C.fg, lineHeight: 1.3 }}>
            a repo gains <span style={{ color: C.accent }}>+2,000 stars</span> in 3 days,
            scores high on <span style={{ color: C.primary }}>security</span>, in your topic
          </div>
          <div style={{ marginTop: 34, display: "flex", alignItems: "center", gap: 18, opacity: sent }}>
            <div
              style={{
                width: 46,
                height: 46,
                borderRadius: 23,
                background: C.primary,
                color: C.bg,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 28,
                fontWeight: 800,
              }}
            >
              ✓
            </div>
            <div style={{ fontSize: 34, color: C.muted }}>Email sent. No spam.</div>
          </div>
        </div>
      </Rise>
    </AbsoluteFill>
  );
};

const Deploy: React.FC = () => (
  <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", padding: "0 90px", gap: 44 }}>
    <div style={{ textAlign: "center" }}>
      <Rise>
        <Eyebrow>The winning move</Eyebrow>
      </Rise>
      <Rise delay={6}>
        <div style={{ fontSize: 60, fontWeight: 800, color: C.fg, marginTop: 12, lineHeight: 1.1 }}>
          Deploy a live, AI-rendered surface.
        </div>
      </Rise>
      <Rise delay={14}>
        <div style={{ fontSize: 32, color: C.muted, marginTop: 16 }}>
          One click. An agent reads the repo and builds a real interactive app.
        </div>
      </Rise>
    </div>
    <Rise delay={28}>
      <div style={{ display: "flex", alignItems: "center", gap: 30, fontFamily: MONO, fontSize: 42, color: C.fg }}>
        <span style={{ padding: "18px 30px", border: `1px solid ${C.borderStrong}`, borderRadius: 14, background: C.surface }}>
          repo
        </span>
        <span style={{ color: C.primary, fontSize: 56 }}>→</span>
        <span style={{ padding: "18px 30px", borderRadius: 14, background: SCORE_GRADIENT, color: C.bg, fontWeight: 800 }}>
          live app
        </span>
      </div>
    </Rise>
  </AbsoluteFill>
);

const Win: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const place = spring({ frame, fps, config: { damping: 200 } });
  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", padding: "0 80px", gap: 22, textAlign: "center" }}>
      <div style={{ transform: `scale(${interpolate(place, [0, 1], [0.7, 1])})`, opacity: place }}>
        <div style={{ fontSize: 160, fontWeight: 900, color: C.primary, lineHeight: 1, letterSpacing: -4 }}>
          2nd
        </div>
        <div style={{ fontSize: 46, fontWeight: 700, color: C.fg, marginTop: 6 }}>place, worldwide</div>
      </div>
      <Rise delay={18}>
        <div style={{ fontSize: 40, color: C.muted }}>302 teams · 17 cities · 3 countries on the podium</div>
      </Rise>
      <Rise delay={30}>
        <div style={{ fontSize: 32, color: C.dim }}>Generative UI Global Hackathon · May 9, 2026</div>
      </Rise>
      <Rise delay={48}>
        <div style={{ marginTop: 30, display: "flex", alignItems: "center", gap: 20 }}>
          <Img src={staticFile("reporadar-mark.svg")} style={{ width: 72 }} />
          <div style={{ fontSize: 62, fontWeight: 800 }}>
            <span style={{ color: C.fg }}>repo</span>
            <span style={{ color: C.primary }}>radar.io</span>
          </div>
        </div>
      </Rise>
      <Rise delay={64}>
        <div style={{ fontSize: 26, color: C.dim, fontFamily: MONO, marginTop: 26, letterSpacing: 1 }}>
          built with A2UI · AG-UI / CopilotKit · MCP
        </div>
      </Rise>
    </AbsoluteFill>
  );
};

// --- Composition ------------------------------------------------------------

export const RepoRadarExplainer: React.FC = () => {
  return (
    <AbsoluteFill style={{ fontFamily, background: C.bg }}>
      <Bg />
      <Sequence durationInFrames={SCENES.intro.dur}>
        <Scene dur={SCENES.intro.dur}>
          <Intro />
        </Scene>
      </Sequence>
      <Sequence from={SCENES.problem.from} durationInFrames={SCENES.problem.dur}>
        <Scene dur={SCENES.problem.dur}>
          <Problem />
        </Scene>
      </Sequence>
      <Sequence from={SCENES.search.from} durationInFrames={SCENES.search.dur}>
        <Scene dur={SCENES.search.dur}>
          <PillarShot
            n={1}
            title="Search any repo. Get a verdict."
            sub="Not ten tabs to open and guess at."
            src={staticFile("dashboard.png")}
            dur={SCENES.search.dur}
          />
        </Scene>
      </Sequence>
      <Sequence from={SCENES.tune.from} durationInFrames={SCENES.tune.dur}>
        <Scene dur={SCENES.tune.dur}>
          <Tune />
        </Scene>
      </Sequence>
      <Sequence from={SCENES.alerts.from} durationInFrames={SCENES.alerts.dur}>
        <Scene dur={SCENES.alerts.dur}>
          <Alerts />
        </Scene>
      </Sequence>
      <Sequence from={SCENES.ask.from} durationInFrames={SCENES.ask.dur}>
        <Scene dur={SCENES.ask.dur}>
          <PillarShot
            n={4}
            title="Ask any repo if it fits."
            sub="It answers against our scores and your stack."
            src={staticFile("chat.png")}
            dur={SCENES.ask.dur}
          />
        </Scene>
      </Sequence>
      <Sequence from={SCENES.deploy.from} durationInFrames={SCENES.deploy.dur}>
        <Scene dur={SCENES.deploy.dur}>
          <Deploy />
        </Scene>
      </Sequence>
      <Sequence from={SCENES.win.from} durationInFrames={SCENES.win.dur}>
        <Scene dur={SCENES.win.dur}>
          <Win />
        </Scene>
      </Sequence>
    </AbsoluteFill>
  );
};
