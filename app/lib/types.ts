export type Repo = {
  fullName: string;        // owner/repo
  description: string | null;
  stars: number;
  forks: number;
  openIssues: number;
  recentCommits: number;   // commits in last 30d (estimate)
  readmeLength: number;    // chars
  topics: string[];
  language: string | null;
  htmlUrl: string;
  pushedAt: string;        // ISO
  createdAt?: string;      // ISO, when available
};

export type AxisWeights = {
  speedToBuild: number;        // 0..1
  communityEngagement: number; // 0..1
  jobPotential: number;        // 0..1
};

// The 10 PRD dimensions, each 0..100, higher = better for the user.
// See PRD §7. These are what the SpiderRadar renders, what the filter
// chips toggle on, and what the sort priorities choose between.
export type Dimension =
  | "momentum"
  | "velocity"
  | "maturity"
  | "community"
  | "recency"
  | "heat"
  | "productionReadiness"
  | "licenseSafety"
  | "documentation"
  | "ecosystemPull";

export type Dimensions = Record<Dimension, number>;

export const DIMENSION_ORDER: Dimension[] = [
  "momentum",
  "velocity",
  "maturity",
  "community",
  "recency",
  "heat",
  "productionReadiness",
  "licenseSafety",
  "documentation",
  "ecosystemPull",
];

export const DIMENSION_META: Record<
  Dimension,
  { label: string; short: string; help: string }
> = {
  momentum: {
    label: "Momentum",
    short: "Mom",
    help: "How fast this repo is gaining attention right now. Higher = stars climbing fast in the last weeks.",
  },
  velocity: {
    label: "Velocity",
    short: "Vel",
    help: "How actively the maintainers are shipping. Higher = more commits in the last 30 days.",
  },
  maturity: {
    label: "Maturity",
    short: "Mat",
    help: "How established + stable the project is. Higher = older, with more releases and adoption signals.",
  },
  community: {
    label: "Community",
    short: "Comm",
    help: "How alive the community is. Higher = more contributors, faster issue cadence.",
  },
  recency: {
    label: "Recency",
    short: "Rec",
    help: "How recently anything happened. Higher = pushed within the last few days.",
  },
  heat: {
    label: "Heat",
    short: "Heat",
    help: "Engagement intensity. Higher = lots of forks + PRs relative to stars.",
  },
  productionReadiness: {
    label: "Prod",
    short: "Prod",
    help: "Production readiness signals. Higher = tests, CI, docs, security policy present.",
  },
  licenseSafety: {
    label: "License",
    short: "Lic",
    help: "Permissive-license safety for commercial use. Higher = MIT/Apache-style; lower = copyleft or unclear.",
  },
  documentation: {
    label: "Docs",
    short: "Docs",
    help: "Documentation quality. Higher = long README, examples, docs site.",
  },
  ecosystemPull: {
    label: "Ecosystem",
    short: "Eco",
    help: "Downstream pull. Higher = lots of dependents, downloads, wide adoption.",
  },
};

export type ScoredRepo = Repo & {
  scores: {
    speedToBuild: number;        // 0..1
    communityEngagement: number; // 0..1
    jobPotential: number;        // 0..1
    complexity: number;          // 0..10 (display)
    uiPotential: number;         // 0..10 (display)
    overall: number;             // 0..1 (weighted average)
  };
  dimensions: Dimensions;        // 0..100 per the 10 PRD axes
  agentSummary?: string;
};
