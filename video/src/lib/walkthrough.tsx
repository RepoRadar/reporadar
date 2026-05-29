import React from "react";
import {
  interpolate,
  random,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { C, SCORE_GRADIENT } from "../theme";
import { MONO, verdictColor } from "./primitives";

// ===========================================================================
// SliderDrag
// A single tuning slider whose fill animates from `from` to `to`. The thumb
// sits centered on the rail (matching the app's "Slide to tune" contract).
// The rail uses the green/blue/yellow/red gradient because it encodes the
// user's weighting, not a verdict (per the UI contracts).
// Pass `progress` (0..1) to drive it from a cursor hop; otherwise it springs
// in on `delay`.
// ===========================================================================
export const SliderDrag: React.FC<{
  label: string;
  from: number;
  to: number;
  delay?: number;
  progress?: number;
  width?: number;
}> = ({ label, from, to, delay = 0, progress, width = 760 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const auto = spring({ frame: frame - delay, fps, config: { damping: 200 } });
  const p = progress ?? auto;
  const value = interpolate(p, [0, 1], [from, to]);
  const railH = 16;
  const thumb = 34;
  return (
    <div style={{ width, marginBottom: 30 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          fontFamily: MONO,
          fontSize: 26,
          color: C.muted,
          marginBottom: 12,
        }}
      >
        <span>{label}</span>
        <span style={{ color: C.fg }}>{Math.round(value)}</span>
      </div>
      <div style={{ position: "relative", height: thumb }}>
        {/* rail track */}
        <div
          style={{
            position: "absolute",
            top: (thumb - railH) / 2,
            left: 0,
            right: 0,
            height: railH,
            borderRadius: railH / 2,
            background: "rgba(255,255,255,0.06)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              height: "100%",
              width: `${value}%`,
              background: SCORE_GRADIENT,
              borderRadius: railH / 2,
            }}
          />
        </div>
        {/* thumb, vertically centered on the rail */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: `calc(${value}% - ${thumb / 2}px)`,
            width: thumb,
            height: thumb,
            borderRadius: "50%",
            background: C.fg,
            border: `3px solid ${C.bg}`,
            boxShadow: "0 4px 14px rgba(0,0,0,0.6)",
          }}
        />
      </div>
    </div>
  );
};

// ===========================================================================
// RankCard / RankList
// Compact repo cards that re-rank as the user tunes. Used to show the payoff
// of moving the sliders: the order visibly changes.
// ===========================================================================
export type Repo = { name: string; lang: string; stars: string; score: number };

const RankCard: React.FC<{
  repo: Repo;
  rank: number;
  y: number;
  highlight?: boolean;
}> = ({ repo, rank, y, highlight }) => (
  <div
    style={{
      position: "absolute",
      left: 0,
      right: 0,
      top: y,
      transition: "none",
      transform: "translateZ(0)",
      display: "flex",
      alignItems: "center",
      gap: 22,
      padding: "22px 28px",
      borderRadius: 16,
      background: highlight ? "rgba(34,197,94,0.10)" : C.surface,
      border: `1px solid ${highlight ? C.primary : C.border}`,
      boxShadow: highlight ? "0 0 0 1px rgba(34,197,94,0.4)" : "none",
    }}
  >
    <div
      style={{
        fontFamily: MONO,
        fontSize: 30,
        fontWeight: 800,
        color: C.dim,
        width: 48,
      }}
    >
      {rank}
    </div>
    <div style={{ flex: 1, minWidth: 0 }}>
      <div
        style={{
          fontSize: 30,
          fontWeight: 700,
          color: C.fg,
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {repo.name}
      </div>
      <div style={{ fontSize: 22, color: C.dim, fontFamily: MONO, marginTop: 4 }}>
        {repo.lang} · ★ {repo.stars}
      </div>
    </div>
    {/* match-score bar, value-colored verdict */}
    <div style={{ width: 150 }}>
      <div
        style={{
          height: 12,
          borderRadius: 6,
          background: "rgba(255,255,255,0.06)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${repo.score}%`,
            background: verdictColor(repo.score),
            borderRadius: 6,
          }}
        />
      </div>
      <div
        style={{
          fontFamily: MONO,
          fontSize: 20,
          color: verdictColor(repo.score),
          marginTop: 8,
          textAlign: "right",
        }}
      >
        {repo.score}
      </div>
    </div>
  </div>
);

// Animates between two orderings of the same repos. `t` (0..1) blends the
// vertical positions so cards slide past each other as the ranking changes.
export const RankList: React.FC<{
  before: Repo[];
  after: Repo[];
  t: number;
  rowH?: number;
}> = ({ before, after, t, rowH = 116 }) => {
  // Map each repo name to its index + score in before/after.
  const byBefore = new Map(before.map((r, i) => [r.name, { i, r }]));
  const byAfter = new Map(after.map((r, i) => [r.name, { i, r }]));
  return (
    <div style={{ position: "relative", height: rowH * before.length }}>
      {after.map((repo) => {
        const b = byBefore.get(repo.name);
        const a = byAfter.get(repo.name);
        const bi = b?.i ?? 0;
        const ai = a?.i ?? 0;
        const y = interpolate(t, [0, 1], [bi * rowH, ai * rowH]);
        const rank = Math.round(interpolate(t, [0, 1], [bi + 1, ai + 1]));
        // Score animates with the tuning too, so the bars match the order.
        const score = Math.round(
          interpolate(t, [0, 1], [b?.r.score ?? repo.score, repo.score])
        );
        return (
          <RankCard
            key={repo.name}
            repo={{ ...repo, score }}
            rank={rank}
            y={y}
            highlight={t > 0.6 && ai === 0}
          />
        );
      })}
    </div>
  );
};

// ===========================================================================
// TypeEmail
// An email field that types in character by character, then shows a
// "check your inbox" confirmation. `progress` 0..1 controls typing; the
// confirm fades in once typing finishes.
// ===========================================================================
export const TypeEmail: React.FC<{
  email: string;
  typeStart: number;
  typeDur: number;
  confirmAt: number;
  width?: number;
}> = ({ email, typeStart, typeDur, confirmAt, width = 760 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const typed = Math.round(
    interpolate(frame, [typeStart, typeStart + typeDur], [0, email.length], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    })
  );
  const text = email.slice(0, typed);
  const caretOn = Math.floor(frame / 8) % 2 === 0 && typed < email.length;
  const confirm = spring({
    frame: frame - confirmAt,
    fps,
    config: { damping: 200 },
  });
  const done = typed >= email.length;
  return (
    <div style={{ width }}>
      <div
        style={{
          fontFamily: MONO,
          fontSize: 24,
          color: C.dim,
          marginBottom: 14,
          letterSpacing: 1,
        }}
      >
        WHERE TO SEND IT
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          height: 84,
          padding: "0 26px",
          borderRadius: 14,
          background: C.surface,
          border: `1px solid ${done ? C.primary : C.borderStrong}`,
          fontFamily: MONO,
          fontSize: 34,
          color: C.fg,
        }}
      >
        <span>{text}</span>
        <span
          style={{
            display: "inline-block",
            width: 3,
            height: 38,
            marginLeft: 2,
            background: C.primary,
            opacity: caretOn ? 1 : 0,
          }}
        />
        {!text ? (
          <span style={{ color: C.dim }}>you@team.dev</span>
        ) : null}
      </div>
      <div
        style={{
          marginTop: 26,
          display: "flex",
          alignItems: "center",
          gap: 16,
          opacity: confirm,
          transform: `translateY(${(1 - confirm) * 14}px)`,
        }}
      >
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: 22,
            background: C.primary,
            color: C.bg,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 26,
            fontWeight: 800,
          }}
        >
          ✓
        </div>
        <div style={{ fontSize: 32, color: C.muted }}>
          Check your inbox to confirm. No spam.
        </div>
      </div>
    </div>
  );
};

// ===========================================================================
// AlertArrives
// A notification card that slides in from the right, like an email landing.
// ===========================================================================
export const AlertArrives: React.FC<{
  at: number;
  title: string;
  body: string;
  meta: string;
  width?: number;
}> = ({ at, title, body, meta, width = 820 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const slide = spring({
    frame: frame - at,
    fps,
    config: { damping: 22, stiffness: 80 },
  });
  const x = interpolate(slide, [0, 1], [width + 80, 0]);
  return (
    <div
      style={{
        width,
        transform: `translateX(${x}px)`,
        opacity: interpolate(slide, [0, 0.2], [0, 1], {
          extrapolateRight: "clamp",
        }),
        borderRadius: 20,
        background: C.surface,
        border: `1px solid ${C.borderStrong}`,
        boxShadow: "0 30px 90px rgba(0,0,0,0.6)",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 14,
          padding: "20px 26px",
          background: C.surface2,
          borderBottom: `1px solid ${C.border}`,
        }}
      >
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            background: C.primary,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 20,
          }}
        >
          📡
        </div>
        <div
          style={{
            fontFamily: MONO,
            fontSize: 22,
            color: C.muted,
            letterSpacing: 1,
          }}
        >
          RepoRadar alert
        </div>
        <div
          style={{
            marginLeft: "auto",
            fontFamily: MONO,
            fontSize: 20,
            color: C.dim,
          }}
        >
          now
        </div>
      </div>
      <div style={{ padding: 30 }}>
        <div
          style={{
            fontSize: 40,
            fontWeight: 800,
            color: C.fg,
            lineHeight: 1.2,
          }}
        >
          {title}
        </div>
        <div style={{ fontSize: 30, color: C.muted, marginTop: 16, lineHeight: 1.4 }}>
          {body}
        </div>
        <div
          style={{
            fontFamily: MONO,
            fontSize: 24,
            color: C.accent,
            marginTop: 20,
          }}
        >
          {meta}
        </div>
      </div>
    </div>
  );
};

// ===========================================================================
// Payoff
// A users counter climbing, a clean revenue line going up and to the right,
// and a subtle confetti burst. Tasteful, no money rain.
// ===========================================================================
const Confetti: React.FC<{ at: number; count?: number }> = ({
  at,
  count = 28,
}) => {
  const frame = useCurrentFrame();
  const t = frame - at;
  if (t < 0) return null;
  const palette = [C.primary, C.secondary, C.accent, C.fg];
  return (
    <>
      {new Array(count).fill(0).map((_, i) => {
        const seed = i + 1;
        const angle = random(`a${seed}`) * Math.PI * 2;
        const dist = 220 + random(`d${seed}`) * 360;
        const dur = 40 + random(`t${seed}`) * 26;
        const p = interpolate(t, [0, dur], [0, 1], {
          extrapolateRight: "clamp",
        });
        const ease = 1 - Math.pow(1 - p, 2);
        const dx = Math.cos(angle) * dist * ease;
        const dy = Math.sin(angle) * dist * ease + p * p * 160; // gravity
        const rot = random(`r${seed}`) * 720 * p;
        const size = 8 + random(`s${seed}`) * 10;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: "50%",
              top: "38%",
              width: size,
              height: size * 0.5,
              background: palette[i % palette.length],
              borderRadius: 2,
              opacity: interpolate(p, [0, 0.1, 0.8, 1], [0, 1, 1, 0]),
              transform: `translate(${dx}px, ${dy}px) rotate(${rot}deg)`,
            }}
          />
        );
      })}
    </>
  );
};

export const Payoff: React.FC<{
  usersFrom?: number;
  usersTo?: number;
  countDur?: number;
  confettiAt?: number;
}> = ({
  usersFrom = 0,
  usersTo = 12480,
  countDur = 70,
  confettiAt = 48,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame, fps, config: { damping: 200 } });
  const users = Math.round(
    interpolate(frame, [10, 10 + countDur], [usersFrom, usersTo], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    })
  );
  // Revenue line: a smooth up-and-to-the-right curve, drawn progressively.
  const W = 760;
  const H = 300;
  const pts = new Array(40).fill(0).map((_, i) => {
    const x = (i / 39) * W;
    // gentle accelerating curve
    const yNorm = Math.pow(i / 39, 1.7);
    const y = H - yNorm * (H - 30) - 20;
    return [x, y] as const;
  });
  const drawn = interpolate(frame, [18, 18 + countDur], [0, pts.length], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const shown = pts.slice(0, Math.max(2, Math.round(drawn)));
  const path = shown
    .map((p, i) => `${i === 0 ? "M" : "L"}${p[0].toFixed(1)},${p[1].toFixed(1)}`)
    .join(" ");
  const last = shown[shown.length - 1];
  const areaPath = `${path} L${last[0].toFixed(1)},${H} L0,${H} Z`;

  return (
    <div
      style={{
        opacity: enter,
        transform: `translateY(${(1 - enter) * 30}px)`,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 54,
      }}
    >
      <Confetti at={confettiAt} />
      <div style={{ textAlign: "center" }}>
        <div
          style={{
            fontSize: 132,
            fontWeight: 900,
            color: C.primary,
            lineHeight: 1,
            letterSpacing: -3,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {users.toLocaleString("en-US")}
        </div>
        <div style={{ fontSize: 36, color: C.muted, marginTop: 10 }}>
          builders tuning their radar
        </div>
      </div>

      <div
        style={{
          width: W + 80,
          padding: 40,
          borderRadius: 22,
          background: C.surface,
          border: `1px solid ${C.border}`,
        }}
      >
        <div
          style={{
            fontFamily: MONO,
            fontSize: 24,
            color: C.dim,
            letterSpacing: 1,
            marginBottom: 18,
          }}
        >
          REVENUE
        </div>
        <svg width={W} height={H} style={{ display: "block" }}>
          <defs>
            <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgba(34,197,94,0.35)" />
              <stop offset="100%" stopColor="rgba(34,197,94,0)" />
            </linearGradient>
          </defs>
          {/* baseline grid */}
          {[0.25, 0.5, 0.75].map((g) => (
            <line
              key={g}
              x1={0}
              y1={H * g}
              x2={W}
              y2={H * g}
              stroke="rgba(255,255,255,0.06)"
              strokeWidth={1}
            />
          ))}
          <path d={areaPath} fill="url(#rev)" />
          <path
            d={path}
            fill="none"
            stroke={C.primary}
            strokeWidth={5}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx={last[0]} cy={last[1]} r={9} fill={C.primary} />
        </svg>
      </div>
    </div>
  );
};
