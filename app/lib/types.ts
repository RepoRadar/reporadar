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

// Per-dimension slider weights, each 0..1. The user tunes these via the
// "Tune your radar" sliders + the interactive hex. They drive scoreRepo's
// weighted average over each repo's 0..100 dimensions.
export type DimensionWeights = Record<
  | "momentum"
  | "velocity"
  | "maturity"
  | "community"
  | "recency"
  | "heat"
  | "productionReadiness"
  | "security"
  | "documentation"
  | "ecosystemPull",
  number
>;

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
  | "security"
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
  "security",
  "documentation",
  "ecosystemPull",
];

export const DIMENSION_META: Record<
  Dimension,
  { label: string; short: string; help: string }
> = {
  momentum: {
    label: "Trending Momentum",
    short: "Momentum",
    help: "How fast this repo is gaining attention right now. Higher = stars climbing fast in the last weeks.",
  },
  velocity: {
    label: "Shipping Velocity",
    short: "Velocity",
    help: "How actively the maintainers are shipping. Higher = more commits in the last 30 days.",
  },
  maturity: {
    label: "Project Maturity",
    short: "Maturity",
    help: "How established + stable the project is. Higher = older, with more releases and adoption signals.",
  },
  community: {
    label: "Community Engagement",
    short: "Community",
    help: "How alive the community is. Higher = more contributors, faster issue cadence.",
  },
  recency: {
    label: "Activity Recency",
    short: "Recency",
    help: "How recently anything happened. Higher = pushed within the last few days.",
  },
  heat: {
    label: "Engagement Heat",
    short: "Heat",
    help: "Engagement intensity. Higher = lots of forks + PRs relative to stars.",
  },
  productionReadiness: {
    label: "Production Readiness",
    short: "Production",
    help: "Production readiness signals. Higher = tests, CI, docs, security policy present.",
  },
  security: {
    label: "Security & Trust",
    short: "Security",
    help: "Security signals — explicit security tooling, active maintenance, low open-vuln pressure. Higher = safer to adopt.",
  },
  documentation: {
    label: "Documentation Quality",
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
