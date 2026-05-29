import React from "react";
import {
  AbsoluteFill,
  Sequence,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { loadFont } from "@remotion/google-fonts/Inter";
import { C } from "./theme";
import { Bg, BrowserCard, Eyebrow, MONO, Rise, Scene } from "./lib/primitives";
import { Cursor, stopProgress } from "./lib/cursor";
import {
  AlertArrives,
  Payoff,
  RankList,
  Repo,
  SliderDrag,
  TypeEmail,
} from "./lib/walkthrough";
import { CLOSE_DUR, COLD_OPEN_DUR, ColdOpen, Close } from "./lib/bookends";

const { fontFamily } = loadFont();

export const FPS = 30;

// Hero film timeline (frames). Keep in sync with the <Sequence> blocks.
const S = {
  cold: { from: 0, dur: COLD_OPEN_DUR }, // hook
  tune: { from: 132, dur: 210 }, // drag sliders, re-rank
  alert: { from: 342, dur: 222 }, // set an alert, type email, confirm
  later: { from: 564, dur: 66 }, // "3 days later"
  arrive: { from: 630, dur: 126 }, // alert email slides in
  ask: { from: 756, dur: 180 }, // ask / implement beat
  payoff: { from: 936, dur: 168 }, // users + revenue + confetti
  close: { from: 1104, dur: CLOSE_DUR },
} as const;

export const HERO_DURATION = S.close.from + S.close.dur; // 1224 = 40.8s

// ---------------------------------------------------------------------------
// Scene 2 — Tune: the cursor drags two sliders and the ranking re-sorts.
// ---------------------------------------------------------------------------
const reposBefore: Repo[] = [
  { name: "trend-magnet", lang: "TypeScript", stars: "61.2k", score: 58 },
  { name: "edge-router", lang: "Rust", stars: "12.8k", score: 71 },
  { name: "secure-kit", lang: "Go", stars: "8.1k", score: 83 },
  { name: "legacy-ui", lang: "JavaScript", stars: "44.0k", score: 39 },
];
const reposAfter: Repo[] = [
  { name: "secure-kit", lang: "Go", stars: "8.1k", score: 91 },
  { name: "edge-router", lang: "Rust", stars: "12.8k", score: 78 },
  { name: "trend-magnet", lang: "TypeScript", stars: "61.2k", score: 49 },
  { name: "legacy-ui", lang: "JavaScript", stars: "44.0k", score: 31 },
];

const TuneScene: React.FC<{ dur: number }> = ({ dur }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Two slider drags driven by cursor hops.
  const drag1 = stopProgress(frame, fps, 30); // Security up
  const drag2 = stopProgress(frame, fps, 78); // Trending down
  // Re-rank blends in once both sliders have moved.
  const reSort = interpolate(frame, [96, 150], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Slider rail geometry (screen coords for the cursor to land on).
  // Sliders are rendered in the left column; thumbs sit ~at these x for
  // the target value. Approximate, good enough for a draft.
  const cursorStops = [
    { x: 230, y: 470, at: 8 }, // approach security slider
    { x: 760, y: 470, at: 30, click: true }, // drag it right
    { x: 250, y: 640, at: 60 }, // approach trending slider
    { x: 470, y: 640, at: 78, click: true }, // drag it left
  ];

  return (
    <AbsoluteFill style={{ padding: "120px 80px 0", flexDirection: "column" }}>
      <Rise>
        <Eyebrow>Tune it to you</Eyebrow>
      </Rise>
      <Rise delay={6}>
        <div
          style={{
            fontSize: 58,
            fontWeight: 800,
            color: C.fg,
            marginTop: 12,
            lineHeight: 1.05,
          }}
        >
          Drag the sliders.
          <br />
          The ranking follows.
        </div>
      </Rise>

      <div style={{ marginTop: 56 }}>
        <SliderDrag
          label="Security & Trust"
          from={35}
          to={95}
          progress={drag1}
        />
        <SliderDrag
          label="Trending Momentum"
          from={90}
          to={28}
          progress={drag2}
        />
      </div>

      <div style={{ marginTop: 40 }}>
        <RankList before={reposBefore} after={reposAfter} t={reSort} />
      </div>

      <Cursor stops={cursorStops} start={{ x: 540, y: 1100 }} />
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------------------
// Scene 3 — Set an alert: cursor clicks a toggle, types an email, confirms.
// ---------------------------------------------------------------------------
const AlertSetupScene: React.FC<{ dur: number }> = ({ dur }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const toggle = spring({ frame: frame - 40, fps, config: { damping: 18 } });

  const cursorStops = [
    { x: 540, y: 560, at: 8 }, // move to the toggle
    { x: 800, y: 560, at: 30, click: true }, // flip "alert me"
    { x: 230, y: 980, at: 70, click: true }, // click into the email field
  ];

  return (
    <AbsoluteFill style={{ padding: "120px 80px 0", flexDirection: "column" }}>
      <Rise>
        <Eyebrow>Then walk away</Eyebrow>
      </Rise>
      <Rise delay={6}>
        <div
          style={{
            fontSize: 58,
            fontWeight: 800,
            color: C.fg,
            marginTop: 12,
            lineHeight: 1.05,
          }}
        >
          Set one alert. We watch
          <br />
          the firehose for you.
        </div>
      </Rise>

      {/* Rule card with a toggle the cursor flips. */}
      <Rise delay={14}>
        <div
          style={{
            marginTop: 50,
            width: 820,
            padding: 34,
            borderRadius: 18,
            background: C.surface,
            border: `1px solid ${C.borderStrong}`,
            display: "flex",
            alignItems: "center",
            gap: 26,
          }}
        >
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: MONO, fontSize: 22, color: C.dim }}>
              WHEN
            </div>
            <div
              style={{
                fontSize: 34,
                fontWeight: 700,
                color: C.fg,
                marginTop: 8,
                lineHeight: 1.3,
              }}
            >
              a repo in <span style={{ color: C.primary }}>my topic</span> breaks
              out and scores high on{" "}
              <span style={{ color: C.accent }}>security</span>
            </div>
          </div>
          {/* toggle */}
          <div
            style={{
              width: 88,
              height: 48,
              borderRadius: 24,
              padding: 5,
              background: `rgba(34,197,94,${interpolate(toggle, [0, 1], [0.12, 1])})`,
              display: "flex",
              alignItems: "center",
            }}
          >
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: 19,
                background: C.fg,
                transform: `translateX(${interpolate(toggle, [0, 1], [0, 40])}px)`,
              }}
            />
          </div>
        </div>
      </Rise>

      <div style={{ marginTop: 56 }}>
        <TypeEmail
          email="you@team.dev"
          typeStart={88}
          typeDur={56}
          confirmAt={158}
        />
      </div>

      <Cursor stops={cursorStops} start={{ x: 540, y: 1200 }} />
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------------------
// Scene 4 — Time jump title card.
// ---------------------------------------------------------------------------
const LaterScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame, fps, config: { damping: 200 } });
  return (
    <AbsoluteFill
      style={{ justifyContent: "center", alignItems: "center", gap: 16 }}
    >
      <div
        style={{
          fontFamily: MONO,
          fontSize: 30,
          letterSpacing: 6,
          color: C.dim,
          textTransform: "uppercase",
          opacity: s,
        }}
      >
        3 days later
      </div>
      <div
        style={{
          width: interpolate(s, [0, 1], [0, 220]),
          height: 3,
          background: C.primary,
          borderRadius: 2,
        }}
      />
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------------------
// Scene 5 — The alert lands.
// ---------------------------------------------------------------------------
const ArriveScene: React.FC = () => (
  <AbsoluteFill
    style={{
      justifyContent: "center",
      alignItems: "center",
      padding: "0 80px",
      gap: 48,
    }}
  >
    {/* AUDIO: soft notification chime as the card slides in. */}
    <AlertArrives
      at={16}
      title="A repo just broke out in your topic"
      body="secure-kit gained +2,100 stars in 3 days and scores 91 on Security & Trust."
      meta="Matches your alert · Open in RepoRadar →"
    />
    <Rise delay={70}>
      <div style={{ fontSize: 38, color: C.muted, textAlign: "center" }}>
        You did not refresh anything.
      </div>
    </Rise>
  </AbsoluteFill>
);

// ---------------------------------------------------------------------------
// Scene 6 — Ask / implement beat, reusing the security chat screenshot.
// ---------------------------------------------------------------------------
const AskScene: React.FC<{ dur: number }> = ({ dur }) => (
  <AbsoluteFill
    style={{ justifyContent: "center", alignItems: "center", padding: "0 60px" }}
  >
    <div style={{ width: 960, marginBottom: 36 }}>
      <Rise>
        <Eyebrow>Then ask, before you commit</Eyebrow>
      </Rise>
      <Rise delay={6}>
        <div
          style={{
            fontSize: 56,
            fontWeight: 800,
            color: C.fg,
            marginTop: 12,
            lineHeight: 1.05,
          }}
        >
          A high score is not a fit.
        </div>
      </Rise>
      <Rise delay={14}>
        <div style={{ fontSize: 30, color: C.muted, marginTop: 14 }}>
          Ask how it fits your app. It found three better matches instead.
        </div>
      </Rise>
    </div>
    <BrowserCard
      src={staticFile("ask-security.png")}
      dur={dur}
      chrome={false}
      width={960}
      zoom
      zoomTo={1.06}
    />
  </AbsoluteFill>
);

// ---------------------------------------------------------------------------
// Scene 7 — Payoff.
// ---------------------------------------------------------------------------
const PayoffScene: React.FC = () => (
  <AbsoluteFill
    style={{ justifyContent: "center", alignItems: "center", padding: "0 70px" }}
  >
    <div style={{ marginBottom: 30, textAlign: "center" }}>
      <Rise>
        <Eyebrow>What it adds up to</Eyebrow>
      </Rise>
    </div>
    {/* AUDIO: music lifts here; confetti burst lands on the downbeat. */}
    <Payoff usersTo={12480} confettiAt={40} />
  </AbsoluteFill>
);

// ---------------------------------------------------------------------------
// Composition.
// ---------------------------------------------------------------------------
export const HeroFilm: React.FC = () => {
  return (
    <AbsoluteFill style={{ fontFamily, background: C.bg }}>
      <Bg />

      <Sequence durationInFrames={S.cold.dur}>
        {/* ColdOpen carries its own background + framing. */}
        <ColdOpen />
      </Sequence>

      <Sequence from={S.tune.from} durationInFrames={S.tune.dur}>
        <Scene dur={S.tune.dur}>
          <TuneScene dur={S.tune.dur} />
        </Scene>
      </Sequence>

      <Sequence from={S.alert.from} durationInFrames={S.alert.dur}>
        <Scene dur={S.alert.dur}>
          <AlertSetupScene dur={S.alert.dur} />
        </Scene>
      </Sequence>

      <Sequence from={S.later.from} durationInFrames={S.later.dur}>
        <Scene dur={S.later.dur}>
          <LaterScene />
        </Scene>
      </Sequence>

      <Sequence from={S.arrive.from} durationInFrames={S.arrive.dur}>
        <Scene dur={S.arrive.dur}>
          <ArriveScene />
        </Scene>
      </Sequence>

      <Sequence from={S.ask.from} durationInFrames={S.ask.dur}>
        <Scene dur={S.ask.dur}>
          <AskScene dur={S.ask.dur} />
        </Scene>
      </Sequence>

      <Sequence from={S.payoff.from} durationInFrames={S.payoff.dur}>
        <Scene dur={S.payoff.dur}>
          <PayoffScene />
        </Scene>
      </Sequence>

      <Sequence from={S.close.from} durationInFrames={S.close.dur}>
        {/* Close carries its own background. */}
        <Close />
      </Sequence>
    </AbsoluteFill>
  );
};
