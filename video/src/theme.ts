// RepoRadar design tokens, mirrored from app/globals.css so the video
// matches the product exactly.
export const C = {
  bg: "#06080d",
  surface: "#10141b",
  surface2: "#181d28",
  border: "rgba(255,255,255,0.10)",
  borderStrong: "rgba(255,255,255,0.18)",
  fg: "#fafafa",
  muted: "#b3bbc8",
  dim: "#6b7384",
  primary: "#22c55e",
  secondary: "#3b82f6",
  accent: "#eab308",
  danger: "#ef4444",
} as const;

// The green/blue/yellow/red language used by the sliders and score bars.
export const SCORE_GRADIENT = `linear-gradient(90deg, ${C.primary} 0%, ${C.secondary} 40%, ${C.accent} 72%, ${C.danger} 100%)`;
